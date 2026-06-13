import uvicorn
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from config          import HOST, PORT, DEBUG, RESPONSE_BUFFER
from database        import setup
from models          import (
    ChatRequest, ChatResponse,
    PromptEngineerRequest, PromptEngineerResponse,
    SessionInfo, UsageSummary
)
from checkpoint      import Checkpoint
from budget          import Budget
from optimizer       import optimize
from prompt_engineer import engineer_prompt
from router          import call_api


app = FastAPI(
    title="TokenBridge API",
    description="Token-efficient AI proxy with prompt engineering and checkpoint support.",
    version="2.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
async def on_startup():
    setup()
    print(f"[Server] TokenBridge v2.0 running at http://localhost:{PORT}")
    print(f"[Server] Docs at http://localhost:{PORT}/docs")


@app.get("/")
async def root():
    return {"status": "ok", "app": "TokenBridge", "version": "2.0.0"}


@app.post("/prompt/engineer", response_model=PromptEngineerResponse)
async def prompt_engineer(req: PromptEngineerRequest):
    if not req.raw_prompt.strip():
        raise HTTPException(status_code=400, detail="raw_prompt cannot be empty.")
    try:
        result = engineer_prompt(req.raw_prompt, req.api_key)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Prompt engineering failed: {str(e)}")
    return PromptEngineerResponse(**result)


@app.post("/chat", response_model=ChatResponse)
async def chat(req: ChatRequest):
    checkpoint = Checkpoint(req.session_id)
    budget     = Budget(req.session_id, req.token_budget)
    history    = checkpoint.load()
    history.append({"role": "user", "content": req.message})
    optimized, estimated_tokens = optimize(history, req.api_key)
    if not budget.has_enough(estimated_tokens + RESPONSE_BUFFER):
        checkpoint.save(history, req.provider)
        raise HTTPException(
            status_code=429,
            detail={
                "error":      "budget_exceeded",
                "message":    "Token budget reached. Your conversation is saved.",
                "session_id": req.session_id,
                "remaining":  budget.remaining()
            }
        )
    try:
        reply, tokens_used = await call_api(
            messages=optimized,
            api_key=req.api_key,
            provider=req.provider
        )
    except Exception as e:
        checkpoint.save(history, req.provider)
        raise HTTPException(status_code=500, detail=f"AI API error: {str(e)}")
    history.append({"role": "assistant", "content": reply})
    checkpoint.save(history, req.provider)
    budget.log_usage(tokens_used, call_type="chat")
    return ChatResponse(
        reply=reply,
        session_id=req.session_id,
        tokens_this_call=tokens_used,
        tokens_remaining=budget.remaining(),
        total_used=budget.used_so_far(),
        checkpoint_saved=True
    )


@app.get("/session/{session_id}", response_model=SessionInfo)
async def get_session(session_id: str):
    checkpoint = Checkpoint(session_id)
    messages   = checkpoint.load()
    if not messages:
        raise HTTPException(status_code=404, detail=f"No checkpoint found for session {session_id}.")
    return SessionInfo(
        session_id=session_id,
        message_count=len(messages),
        messages=messages
    )


@app.get("/usage/{session_id}", response_model=UsageSummary)
async def get_usage(session_id: str, token_budget: int = 50000):
    budget = Budget(session_id, token_budget)
    data   = budget.summary()
    return UsageSummary(**data)


@app.delete("/session/{session_id}")
async def delete_session(session_id: str):
    Checkpoint(session_id).delete()
    return {"message": f"Session {session_id} cleared."}


if __name__ == "__main__":
    uvicorn.run("main:app", host=HOST, port=PORT, reload=DEBUG)
