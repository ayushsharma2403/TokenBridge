"""
main.py — FastAPI server

This is the entry point. Run this file to start the server:
    python main.py

Then visit http://localhost:8000/docs to see and test all endpoints.
"""

import uvicorn
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

# Our own modules
from database   import setup
from checkpoint import Checkpoint
from budget     import Budget
from optimizer  import optimize
from router     import call_api


# ------------------------------------------------------------------
# App setup
# ------------------------------------------------------------------

app = FastAPI(
    title="TokenBridge API",
    description="Token-efficient AI proxy with checkpoint support",
    version="1.0.0"
)

# Allow the frontend (running on a different port) to talk to this server
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],    # fine for local dev — tighten this before production
    allow_methods=["*"],
    allow_headers=["*"],
)


# ------------------------------------------------------------------
# Request & response models
# All incoming JSON must match the Request model.
# All outgoing JSON will match the Response model.
# ------------------------------------------------------------------

class ChatRequest(BaseModel):
    session_id:   str
    message:      str
    api_key:      str
    provider:     str = "claude"    # "claude" or "openai"
    token_budget: int = 50000       # user's self-set limit

class ChatResponse(BaseModel):
    reply:            str
    session_id:       str
    tokens_this_call: int
    tokens_remaining: int
    total_used:       int
    checkpoint_saved: bool

class SessionInfo(BaseModel):
    session_id:    str
    message_count: int
    messages:      list


# ------------------------------------------------------------------
# Startup
# ------------------------------------------------------------------

@app.on_event("startup")
async def on_startup():
    setup()     # creates DB tables if they don't exist
    print("[Server] TokenBridge is running at http://localhost:8000")
    print("[Server] API docs available at http://localhost:8000/docs")


# ------------------------------------------------------------------
# Routes
# ------------------------------------------------------------------

@app.get("/")
async def root():
    return {"status": "ok", "message": "TokenBridge API is running"}


@app.post("/chat", response_model=ChatResponse)
async def chat(req: ChatRequest):
    """
    The main endpoint. Full flow:
        1. Load checkpoint (empty list if new session)
        2. Append user's message
        3. Optimize (compress history if it's too long)
        4. Check if the user has enough budget
        5. Call the AI API
        6. Append AI reply to history
        7. Save checkpoint
        8. Return response with token stats
    """

    checkpoint = Checkpoint(req.session_id)
    budget     = Budget(req.session_id, req.token_budget)

    # Step 1–2: load and append
    history = checkpoint.load()
    history.append({"role": "user", "content": req.message})

    # Step 3: compress if needed
    optimized, estimated_tokens = optimize(history, req.api_key)

    # Step 4: budget check before making the API call
    # We add 600 as a buffer for the assistant's response tokens
    if not budget.has_enough(estimated_tokens + 600):
        checkpoint.save(history, req.provider)  # save progress first!
        raise HTTPException(
            status_code=429,
            detail={
                "error":      "budget_exceeded",
                "message":    "You've reached your token budget. Your conversation is saved — resume anytime.",
                "session_id": req.session_id,
                "remaining":  budget.remaining()
            }
        )

    # Step 5: call the AI
    try:
        reply, tokens_used = await call_api(
            messages=optimized,
            api_key=req.api_key,
            provider=req.provider
        )
    except Exception as e:
        # Save progress even if the API call fails
        checkpoint.save(history, req.provider)
        raise HTTPException(status_code=500, detail=f"AI API error: {str(e)}")

    # Step 6–7: update history and save checkpoint
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
    """
    Loads a saved checkpoint so the user can resume where they left off.
    Returns 404 if no checkpoint exists for that session ID.
    """
    checkpoint = Checkpoint(session_id)
    messages   = checkpoint.load()

    if not messages:
        raise HTTPException(
            status_code=404,
            detail=f"No checkpoint found for session '{session_id}'."
        )

    return SessionInfo(
        session_id=session_id,
        message_count=len(messages),
        messages=messages
    )


@app.get("/usage/{session_id}")
async def get_usage(session_id: str, token_budget: int = 50000):
    """Returns a token usage summary — for the frontend token meter."""
    budget = Budget(session_id, token_budget)
    return budget.summary()


@app.delete("/session/{session_id}")
async def delete_session(session_id: str):
    """Clears a session checkpoint. Use when starting completely fresh."""
    Checkpoint(session_id).delete()
    return {"message": f"Session '{session_id}' has been cleared."}


# ------------------------------------------------------------------
# Run
# ------------------------------------------------------------------

if __name__ == "__main__":
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8000,
        reload=True     # auto-restarts when you save a file (dev mode)
    )
