import uvicorn
from fastapi import FastAPI, HTTPException, Header
from fastapi.responses import RedirectResponse
from urllib.parse import quote
from fastapi.middleware.cors import CORSMiddleware
from typing import Optional

from config          import HOST, PORT, DEBUG, RESPONSE_BUFFER
from database        import setup
from models          import (
    ChatRequest, ChatResponse,
    PromptEngineerRequest, PromptEngineerResponse,
    SessionInfo, UsageSummary,
    RegisterRequest, LoginRequest, PhoneAuthRequest,
    ForgotPasswordRequest, ResetPasswordRequest, AuthResponse
)
from checkpoint      import Checkpoint
from budget          import Budget
from optimizer       import optimize
from prompt_engineer import engineer_prompt
from router          import call_api, detect_provider
from tokenvault      import log, session_stats, global_stats
from auth            import (
    register_user, login_user,
    get_user_from_token,
    generate_reset_token, reset_password
)
from oauth           import get_google_login_url, handle_google_callback
from email_service   import send_reset_email
from firebase_auth   import login_with_phone


app = FastAPI(
    title="TokenBridge API",
    description="Token-efficient AI proxy with auth, TokenVault, and Gemini support.",
    version="3.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
async def on_startup():
    setup()
    print(f"[Server] TokenBridge v3.0 running at http://localhost:{PORT}")
    print(f"[Server] Docs at http://localhost:{PORT}/docs")


def get_current_user(authorization: Optional[str] = None) -> dict:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Not authenticated.")
    token = authorization.split(" ")[1]
    user  = get_user_from_token(token)
    if not user:
        raise HTTPException(status_code=401, detail="Invalid or expired token.")
    return user


@app.get("/")
async def root():
    return {"status": "ok", "app": "TokenBridge", "version": "3.0.0"}


# -------------------------------------------------------
# Auth endpoints
# -------------------------------------------------------

@app.post("/auth/register", response_model=AuthResponse)
async def register(req: RegisterRequest):
    result = register_user(req.name, req.email, req.password)
    if "error" in result:
        raise HTTPException(status_code=400, detail=result["error"])
    from auth import create_token
    token = create_token(result["user_id"])
    return AuthResponse(token=token, **result)


@app.post("/auth/login", response_model=AuthResponse)
async def login(req: LoginRequest):
    result = login_user(req.email, req.password, req.remember_me)
    if "error" in result:
        raise HTTPException(status_code=401, detail=result["error"])
    return AuthResponse(**result)


@app.post("/auth/phone", response_model=AuthResponse)
async def auth_phone(req: PhoneAuthRequest):
    result = login_with_phone(req.firebase_token)
    if "error" in result:
        raise HTTPException(status_code=400, detail=result["error"])
    return AuthResponse(**result)


@app.get("/auth/google")
async def google_login():
    url = get_google_login_url()
    return {"url": url}


@app.get("/auth/google/callback")
async def google_callback(code: str):
    result = await handle_google_callback(code)
    if "error" in result:
        err_msg = quote(str(result.get("error", "Google login failed")))
        return RedirectResponse(f"http://localhost:5500/login.html?error={err_msg}")
    token   = result["token"]
    user_id = result["user_id"]
    name    = quote(str(result["name"]))
    email   = quote(str(result["email"]))
    return RedirectResponse(
        f"http://localhost:5500/index.html?token={token}&user_id={user_id}&name={name}&email={email}"
    )


@app.post("/auth/forgot-password")
async def forgot_password(req: ForgotPasswordRequest):
    reset_token = generate_reset_token(req.email)
    if reset_token:
        conn = __import__("database").connect()
        c    = conn.cursor()
        c.execute("SELECT name FROM users WHERE email = %s", (req.email,))
        row  = c.fetchone()
        c.close()
        conn.close()
        name = row[0] if row else "User"
        send_reset_email(req.email, name, reset_token)
    return {"message": "If that email exists, a reset link has been sent."}


@app.post("/auth/reset-password")
async def reset_pwd(req: ResetPasswordRequest):
    result = reset_password(req.token, req.new_password)
    if "error" in result:
        raise HTTPException(status_code=400, detail=result["error"])
    return result


@app.get("/auth/me")
async def get_me(authorization: Optional[str] = Header(None)):
    return get_current_user(authorization)


# -------------------------------------------------------
# Prompt Engineering
# -------------------------------------------------------

@app.post("/prompt/engineer", response_model=PromptEngineerResponse)
async def prompt_engineer(req: PromptEngineerRequest):
    if not req.raw_prompt.strip():
        raise HTTPException(status_code=400, detail="raw_prompt cannot be empty.")
    try:
        result = engineer_prompt(req.raw_prompt, req.api_key)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Prompt engineering failed: {str(e)}")
    return PromptEngineerResponse(**result)


# -------------------------------------------------------
# Chat
# -------------------------------------------------------

@app.post("/chat", response_model=ChatResponse)
async def chat(req: ChatRequest, authorization: Optional[str] = Header(None)):
    user       = get_current_user(authorization)
    checkpoint = Checkpoint(req.session_id)
    budget     = Budget(req.session_id, req.token_budget)
    history    = checkpoint.load()
    history.append({"role": "user", "content": req.message})

    tokens_before               = sum(len(str(m["content"])) for m in history) // 4
    optimized, estimated_tokens = optimize(history, req.api_key)
    tokens_saved                = max(0, tokens_before - estimated_tokens)

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
        provider                           = detect_provider(req.api_key, req.provider)
        reply, input_tokens, output_tokens = await call_api(
            messages=optimized,
            api_key=req.api_key,
            provider=provider
        )
    except Exception as e:
        checkpoint.save(history, req.provider)
        raise HTTPException(status_code=500, detail=f"AI API error: {str(e)}")

    total_tokens = input_tokens + output_tokens
    history.append({"role": "assistant", "content": reply})
    checkpoint.save(history, provider)
    budget.log_usage(total_tokens, call_type="chat")

    log(
        session_id=req.session_id,
        provider=provider,
        input_tokens=input_tokens,
        output_tokens=output_tokens,
        call_type="chat",
        tokens_saved=tokens_saved,
        saving_source="optimizer"
    )

    return ChatResponse(
        reply=reply,
        session_id=req.session_id,
        tokens_this_call=total_tokens,
        tokens_remaining=budget.remaining(),
        total_used=budget.used_so_far(),
        checkpoint_saved=True
    )


# -------------------------------------------------------
# Session management
# -------------------------------------------------------

@app.get("/session/{session_id}", response_model=SessionInfo)
async def get_session(session_id: str, authorization: Optional[str] = Header(None)):
    get_current_user(authorization)
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
async def get_usage(session_id: str, token_budget: int = 50000,
                    authorization: Optional[str] = Header(None)):
    get_current_user(authorization)
    budget = Budget(session_id, token_budget)
    return UsageSummary(**budget.summary())


@app.delete("/session/{session_id}")
async def delete_session(session_id: str, authorization: Optional[str] = Header(None)):
    get_current_user(authorization)
    Checkpoint(session_id).delete()
    return {"message": f"Session {session_id} cleared."}


# -------------------------------------------------------
# TokenVault
# -------------------------------------------------------

@app.get("/tokenvault/{session_id}")
async def tokenvault_session(session_id: str, authorization: Optional[str] = Header(None)):
    get_current_user(authorization)
    return session_stats(session_id)


@app.get("/tokenvault")
async def tokenvault_global(authorization: Optional[str] = Header(None)):
    get_current_user(authorization)
    return global_stats()



from pydantic import BaseModel as _BaseModel

class _EmailCheck(_BaseModel):
    email: str

@app.post("/auth/check-email")
async def check_email_exists(req: _EmailCheck):
    from database import connect
    conn = connect()
    c    = conn.cursor()
    c.execute("SELECT id FROM users WHERE email = %s", (req.email,))
    exists = c.fetchone() is not None
    c.close()
    conn.close()
    return {"exists": exists}

import os
from fastapi.staticfiles import StaticFiles

frontend_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "frontend"))
if os.path.exists(frontend_dir):
    app.mount("/", StaticFiles(directory=frontend_dir, html=True), name="frontend")

if __name__ == "__main__":
    uvicorn.run("main:app", host=HOST, port=PORT, reload=DEBUG)


