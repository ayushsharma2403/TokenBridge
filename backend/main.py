import os
import uvicorn
from fastapi import FastAPI, HTTPException, Header, UploadFile, File, Form, Request
from fastapi.responses import RedirectResponse, Response, FileResponse
from urllib.parse import quote
from fastapi.middleware.cors import CORSMiddleware
from typing import Optional

frontend_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "frontend"))

from config          import HOST, PORT, DEBUG, RESPONSE_BUFFER, APP_URL, CLAUDE_MODEL, OPENAI_MODEL, GEMINI_MODEL

_default_origins = [APP_URL, "http://localhost:8000", "http://127.0.0.1:8000", "http://localhost:5500", "http://127.0.0.1:5500", "http://localhost:3000"]
ALLOWED_ORIGINS = list({o.strip() for o in (os.getenv("ALLOWED_ORIGINS", "").split(",") + _default_origins) if o.strip()})

from database        import setup
from models          import (
    ChatRequest, ChatResponse,
    PromptEngineerRequest, PromptEngineerResponse,
    SessionInfo, SessionUpdateRequest, UsageSummary, ModelLimits,
    KeyValidationRequest, KeyValidationResponse,
    RegisterRequest, LoginRequest, PhoneAuthRequest,
    EmailOtpSendRequest, EmailOtpVerifyRequest,
    ForgotPasswordRequest, ResetPasswordRequest, ResetPasswordWithOtpRequest, AuthResponse
)
from checkpoint      import Checkpoint
from budget          import Budget
from optimizer       import optimize
from prompt_engineer import engineer_prompt
from router          import call_api, detect_provider, validate_api_key
from tokenvault      import log, session_stats, global_stats, COSTS
from auth            import (
    register_user, login_user,
    get_user_from_token,
    generate_reset_token, reset_password, update_password_by_email,
    change_user_password, update_user_profile
)
from oauth           import get_google_login_url, handle_google_callback
from email_service   import send_reset_email, send_otp_email
from firebase_auth   import login_with_phone
from pydantic        import BaseModel


app = FastAPI(
    title="TokenBridge API",
    description="Token-efficient AI proxy with auth, TokenVault, and Gemini support.",
    version="3.0.0"
)

# CORS middleware with environment-driven allowlist & dev fallback
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.middleware("http")
async def no_cache_static_middleware(request, call_next):
    response = await call_next(request)
    path = request.url.path
    if path == "/" or any(path.endswith(ext) for ext in [".html", ".js", ".css"]):
        response.headers["Cache-Control"] = "no-cache, no-store, must-revalidate"
        response.headers["Pragma"] = "no-cache"
        response.headers["Expires"] = "0"
    return response


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
    index_file = os.path.join(frontend_path, "index.html")
    if os.path.exists(index_file):
        return FileResponse(index_file)
    return {"status": "ok", "app": "TokenBridge", "version": "3.0.0"}


@app.get("/health")
async def health():
    return {"status": "ok", "app": "TokenBridge", "version": "3.0.0"}


# -------------------------------------------------------
# Auth endpoints
# -------------------------------------------------------

@app.post("/auth/register", response_model=AuthResponse)
async def register(req: RegisterRequest):
    email = req.email.strip().lower()
    # Check if registered with email OTP
    rec = PENDING_EMAIL_OTPS.get(email)
    if rec and not rec.get("verified"):
        raise HTTPException(status_code=400, detail="Please verify your email with OTP first.")

    result = register_user(req.name, email, req.password, dob=req.dob)
    if "error" in result:
        raise HTTPException(status_code=400, detail=result["error"])
    
    # Registration completed successfully -> clear OTP record
    PENDING_EMAIL_OTPS.pop(email, None)

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
    result = login_with_phone(req.firebase_token, req.name, dob=req.dob)
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
        return RedirectResponse(f"{APP_URL}/login.html?error={err_msg}")
    token   = result["token"]
    user_id = result["user_id"]
    name    = quote(str(result["name"]))
    email   = quote(str(result["email"]))
    return RedirectResponse(
        f"{APP_URL}/index.html?token={token}&user_id={user_id}&name={name}&email={email}"
    )


@app.post("/auth/forgot-password")
async def forgot_password(req: ForgotPasswordRequest):
    reset_token = generate_reset_token(req.email)
    if reset_token:
        from database import connect
        conn = connect()
        c    = conn.cursor()
        c.execute("SELECT name FROM users WHERE email = %s", (req.email,))
        row  = c.fetchone()
        c.close()
        conn.close()
        name = row[0] if row else "User"
        send_reset_email(req.email, name, reset_token)
    return {"message": "If that email exists, a reset link has been sent."}


@app.post("/auth/forgot-password-otp")
async def forgot_password_otp(req: ForgotPasswordRequest, request: Request):
    """Generates and sends a 6-digit OTP to the registered user email for password reset."""
    client_ip = request.client.host if request.client else "unknown"
    if _is_rate_limited(client_ip):
        raise HTTPException(status_code=429, detail="Too many requests. Please try again shortly.")

    import time, random
    email = req.email.strip().lower()
    if not email or "@" not in email:
        raise HTTPException(status_code=400, detail="Invalid email address.")

    from database import connect
    conn = connect()
    c = conn.cursor()
    c.execute("SELECT id, name FROM users WHERE email = %s AND is_active = TRUE", (email,))
    user = c.fetchone()
    c.close()
    conn.close()

    if not user:
        raise HTTPException(status_code=404, detail="No registered account found with this email.")

    otp_code = "".join([str(random.randint(0, 9)) for _ in range(6)])
    expires_at = time.time() + 600  # 10 minutes

    PENDING_EMAIL_OTPS[email] = {
        "otp": otp_code,
        "expires_at": expires_at,
        "mode": "reset_password"
    }

    user_name = user[1] if user else "User"
    sent = send_otp_email(email, otp_code, user_name=user_name, purpose="reset")
    if not sent:
        raise HTTPException(status_code=500, detail="Failed to send reset code email. Please verify SMTP settings.")

    return {"sent": True, "message": f"Password reset code sent to {email}"}


@app.post("/auth/reset-password-otp")
async def reset_password_with_otp(req: ResetPasswordWithOtpRequest):
    """Verifies the OTP and updates the user's password."""
    import time
    email = req.email.strip().lower()
    otp   = req.otp.strip()
    new_pwd = req.new_password

    if len(new_pwd) < 8:
        raise HTTPException(status_code=400, detail="Password must be at least 8 characters.")

    record = PENDING_EMAIL_OTPS.get(email)
    if not record:
        raise HTTPException(status_code=400, detail="No reset code was requested for this email.")

    if time.time() > record["expires_at"]:
        PENDING_EMAIL_OTPS.pop(email, None)
        raise HTTPException(status_code=400, detail="Reset code has expired. Please request a new one.")

    if record["otp"] != otp:
        raise HTTPException(status_code=400, detail="Invalid reset code. Please try again.")

    # Apply password update
    res = update_password_by_email(email, new_pwd)
    if "error" in res:
        raise HTTPException(status_code=400, detail=res["error"])

    PENDING_EMAIL_OTPS.pop(email, None)
    return {"message": "Password has been successfully reset. You can now log in."}


@app.post("/auth/reset-password")
async def reset_pwd(req: ResetPasswordRequest):
    result = reset_password(req.token, req.new_password)
    if "error" in result:
        raise HTTPException(status_code=400, detail=result["error"])
    return result



@app.get("/auth/me")
async def get_me(authorization: Optional[str] = Header(None)):
    return get_current_user(authorization)


class ProfileUpdateRequest(BaseModel):
    name: Optional[str] = None
    dob: Optional[str] = None
    age: Optional[int] = None
    subscription_tier: Optional[str] = None
    language: Optional[str] = None

@app.post("/auth/profile")
async def update_profile_endpoint(req: ProfileUpdateRequest, authorization: Optional[str] = Header(None)):
    user = get_current_user(authorization)
    # If dob is provided and age is not explicitly set, calculate age
    age = req.age
    if req.dob and req.dob.strip() and not age:
        try:
            from datetime import datetime
            born = datetime.strptime(req.dob.strip(), "%Y-%m-%d")
            today = datetime.today()
            age = today.year - born.year - ((today.month, today.day) < (born.month, born.day))
        except Exception:
            pass

    if age is not None and age < 18:
        raise HTTPException(status_code=400, detail="Access restricted: You must be at least 18 years old.")

    updated = update_user_profile(
        user_id=user["user_id"],
        name=req.name,
        dob=req.dob,
        age=age,
        subscription_tier=req.subscription_tier,
        language=req.language
    )
    return updated


class ChangePasswordRequest(BaseModel):
    old_password: Optional[str] = ""
    new_password: str

@app.post("/auth/change-password")
async def change_password_endpoint(req: ChangePasswordRequest, authorization: Optional[str] = Header(None)):
    user = get_current_user(authorization)
    if len(req.new_password) < 8:
        raise HTTPException(status_code=400, detail="New password must be at least 8 characters.")
    res = change_user_password(user["user_id"], req.old_password or "", req.new_password)
    if "error" in res:
        raise HTTPException(status_code=400, detail=res["error"])
    return res


@app.get("/auth/daily-usage")
async def get_daily_usage(authorization: Optional[str] = Header(None)):
    user = get_current_user(authorization)
    user_id = user["user_id"]
    from database import connect
    from datetime import datetime, timedelta
    conn = connect()
    c = conn.cursor()

    # Query last 7 days of daily token usage for this user
    c.execute("""
        SELECT DATE(logged_at) as usage_date,
               provider,
               COALESCE(SUM(total_tokens), 0) as tokens,
               COALESCE(SUM(cost_usd), 0.0) as cost,
               COALESCE(SUM(tokens_saved), 0) as saved,
               COUNT(*) as calls
        FROM tokenvault
        WHERE (user_id = %s OR (user_id IS NULL AND logged_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)))
        GROUP BY DATE(logged_at), provider
        ORDER BY usage_date DESC
        LIMIT 30
    """, (user_id,))
    rows = c.fetchall()

    # Today's specific totals
    today_str = datetime.now().strftime("%Y-%m-%d")
    today_tokens = 0
    today_cost = 0.0
    today_saved = 0
    today_calls = 0

    daily_map = {}
    for row in rows:
        d_str = str(row[0])
        prov = row[1]
        toks = int(row[2])
        cst = round(float(row[3]), 6)
        svd = int(row[4])
        cls = int(row[5])

        if d_str == today_str:
            today_tokens += toks
            today_cost += cst
            today_saved += svd
            today_calls += cls

        if d_str not in daily_map:
            daily_map[d_str] = {"date": d_str, "total_tokens": 0, "cost_usd": 0.0, "tokens_saved": 0, "calls": 0, "by_provider": {}}
        daily_map[d_str]["total_tokens"] += toks
        daily_map[d_str]["cost_usd"] = round(daily_map[d_str]["cost_usd"] + cst, 6)
        daily_map[d_str]["tokens_saved"] += svd
        daily_map[d_str]["calls"] += cls
        daily_map[d_str]["by_provider"][prov] = {"tokens": toks, "cost_usd": cst, "calls": cls}

    c.close()
    conn.close()

    # Daily quota limit based on subscription tier
    tier = user.get("subscription_tier") or "Free"
    tier_limits = {
        "Free": 50000,
        "Pro": 500000,
        "Enterprise": 2000000
    }
    daily_quota = tier_limits.get(tier, 50000)

    return {
        "user_id": user_id,
        "subscription_tier": tier,
        "daily_quota": daily_quota,
        "today": {
            "date": today_str,
            "tokens_used": today_tokens,
            "tokens_remaining": max(0, daily_quota - today_tokens),
            "quota_percent": round(min(100.0, (today_tokens / daily_quota) * 100), 1) if daily_quota > 0 else 0,
            "cost_usd": round(today_cost, 6),
            "tokens_saved": today_saved,
            "calls": today_calls
        },
        "history": list(daily_map.values())
    }


class EmailCheck(BaseModel):
    email: str

import time as _time
_CHECK_EMAIL_RATE_LIMIT = {}  # { ip: [timestamps] }

def _is_rate_limited(ip: str, max_requests: int = 10, window_seconds: int = 60) -> bool:
    now = _time.time()
    timestamps = _CHECK_EMAIL_RATE_LIMIT.get(ip, [])
    timestamps = [t for t in timestamps if now - t < window_seconds]
    timestamps.append(now)
    _CHECK_EMAIL_RATE_LIMIT[ip] = timestamps
    return len(timestamps) > max_requests

@app.post("/auth/check-email")
async def check_email_exists(req: EmailCheck, request: Request):
    client_ip = request.client.host if request.client else "unknown"
    if _is_rate_limited(client_ip):
        raise HTTPException(status_code=429, detail="Too many requests. Please try again shortly.")

    from database import connect
    conn = connect()
    c    = conn.cursor()
    c.execute("SELECT id FROM users WHERE email = %s", (req.email,))
    exists = c.fetchone() is not None
    c.close()
    conn.close()
    return {"exists": exists}


# In-memory store for pending email OTPs: { email: { "otp": "123456", "expires_at": float_ts } }
PENDING_EMAIL_OTPS = {}

@app.post("/auth/email/send-otp")
async def send_email_otp(req: EmailOtpSendRequest, request: Request):
    client_ip = request.client.host if request.client else "unknown"
    if _is_rate_limited(client_ip):
        raise HTTPException(status_code=429, detail="Too many requests. Please try again shortly.")

    import time, random
    email = req.email.strip().lower()
    if not email or "@" not in email:
        raise HTTPException(status_code=400, detail="Invalid email address.")

    from database import connect
    conn = connect()
    c = conn.cursor()
    c.execute("SELECT id FROM users WHERE email = %s", (email,))
    exists = c.fetchone() is not None
    c.close()
    conn.close()

    if exists:
        return {"exists": True, "message": "Email is already registered. Please enter password."}

    # Generate 6-digit OTP
    otp_code = "".join([str(random.randint(0, 9)) for _ in range(6)])
    expires_at = time.time() + 600  # 10 minutes

    PENDING_EMAIL_OTPS[email] = {
        "otp": otp_code,
        "expires_at": expires_at
    }

    sent = send_otp_email(email, otp_code)
    if not sent:
        raise HTTPException(status_code=500, detail="Failed to send verification email. Please verify SMTP settings.")

    return {"exists": False, "sent": True, "message": f"Verification code sent to {email}"}


@app.post("/auth/email/verify-otp")
async def verify_email_otp(req: EmailOtpVerifyRequest):
    import time
    email = req.email.strip().lower()
    otp   = req.otp.strip()

    record = PENDING_EMAIL_OTPS.get(email)
    if not record:
        raise HTTPException(status_code=400, detail="No verification code was requested for this email.")

    if time.time() > record["expires_at"]:
        PENDING_EMAIL_OTPS.pop(email, None)
        raise HTTPException(status_code=400, detail="Verification code has expired. Please request a new one.")

    if record["otp"] != otp:
        raise HTTPException(status_code=400, detail="Invalid verification code. Please try again.")

    # Mark as verified (keep record with verified flag for registration)
    record["verified"] = True
    return {"verified": True, "message": "Email verified successfully."}



# -------------------------------------------------------
# File Upload & Generation
# -------------------------------------------------------

@app.get("/api/files/download/{filename}")
async def download_generated_file(filename: str, authorization: Optional[str] = Header(None)):
    get_current_user(authorization)
    from file_generator import GENERATED_DIR
    file_path = os.path.join(GENERATED_DIR, filename)
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="File not found or has expired.")

    content_types = {
        ".pdf": "application/pdf",
        ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        ".pptx": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
        ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        ".png": "image/png",
        ".jpg": "image/jpeg",
        ".jpeg": "image/jpeg"
    }
    _, ext = os.path.splitext(filename)
    media_type = content_types.get(ext.lower(), "application/octet-stream")

    return FileResponse(
        file_path,
        media_type=media_type,
        filename=filename,
        headers={"Content-Disposition": f'inline; filename="{filename}"'}
    )


@app.post("/upload")
async def upload_file(
    file:          UploadFile        = File(...),
    api_key:       str               = Form(default=""),
    authorization: Optional[str]     = Header(None)
):
    get_current_user(authorization)
    from file_converter import convert_file
    if not file or not file.filename:
        raise HTTPException(status_code=400, detail="No file selected for upload.")
    file_bytes = await file.read()
    result     = convert_file(file_bytes, file.filename, api_key)
    if "error" in result:
        raise HTTPException(status_code=400, detail=result["error"])
    return result


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
    user = get_current_user(authorization)
    checkpoint = Checkpoint(req.session_id, user_id=user["user_id"])
    budget     = Budget(req.session_id, req.token_budget, user_id=user["user_id"])
    history    = checkpoint.load()
    history.append({"role": "user", "content": req.message})

    efficiency = (req.efficiency or "medium").lower()
    if efficiency == "hard":
        efficiency = "high"
    if efficiency not in ["low", "medium", "high"]:
        efficiency = "medium"

    tokens_before               = sum(len(str(m["content"])) for m in history) // 4
    optimized, estimated_tokens = optimize(history, req.api_key, efficiency=efficiency)
    tokens_saved                = max(0, tokens_before - estimated_tokens)

    # Real-time search & factual grounding injection if query seeks latest/current info
    try:
        from realtime_grounding import needs_realtime_context, get_realtime_context
        if needs_realtime_context(req.message):
            live_context = get_realtime_context(req.message)
            if live_context and optimized:
                # Augment the latest user message with verified live context
                last_user_idx = len(optimized) - 1
                while last_user_idx >= 0 and optimized[last_user_idx].get("role") != "user":
                    last_user_idx -= 1
                if last_user_idx >= 0:
                    orig_content = optimized[last_user_idx]["content"]
                    optimized[last_user_idx]["content"] = (
                        f"{orig_content}\n\n"
                        f"[VERIFIED REAL-TIME INFORMATION & CONTEXT]:\n{live_context}\n"
                        f"Please synthesize the response using this verified real-time context."
                    )
    except Exception as ground_err:
        print(f"[RealTimeGrounding] Notice: {ground_err}")

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
            provider=provider,
            efficiency=efficiency
        )
    except Exception as e:
        checkpoint.save(history, req.provider)
        raise HTTPException(status_code=500, detail=f"AI API error: {str(e)}")

    total_tokens = input_tokens + output_tokens

    # Check if the user asked to generate a file (image, pdf, docx, pptx, xlsx, etc.)
    try:
        from file_generator import process_generation_request
        file_res = process_generation_request(req.message)
        if file_res and file_res.get("success"):
            fname = file_res.get("filename")
            ftype = file_res.get("file_type", "file").upper()
            durl = file_res.get("download_url")
            preview_url = file_res.get("preview_url")

            download_card = (
                f"\n\n---\n"
                f"### 📥 Generated {ftype} File Ready\n"
                f"Your requested **{fname}** has been prepared and formatted.\n\n"
            )
            if preview_url and ftype == "IMAGE":
                download_card += f"![{fname}]({preview_url})\n\n"
            download_card += f"[⬇️ Download {fname}]({durl})\n"

            reply = reply + download_card
    except Exception as gen_err:
        print(f"[FileGen] Auto-generation hook error: {gen_err}")

    history.append({"role": "assistant", "content": reply})
    checkpoint.save(history, provider)
    user_id = user.get("user_id") if isinstance(user, dict) else None
    budget.provider = provider
    budget.log_usage(total_tokens, call_type="chat", user_id=user_id, provider=provider)

    log(
        session_id=req.session_id,
        user_id=user_id,
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
        checkpoint_saved=True,
        provider=provider
    )


# -------------------------------------------------------
# Session management
# -------------------------------------------------------

@app.get("/session/{session_id}", response_model=SessionInfo)
async def get_session(session_id: str, authorization: Optional[str] = Header(None)):
    user = get_current_user(authorization)
    checkpoint = Checkpoint(session_id, user_id=user["user_id"])
    messages   = checkpoint.load()
    if not messages:
        raise HTTPException(status_code=404, detail=f"No checkpoint found for session {session_id}.")
    return SessionInfo(
        session_id=session_id,
        message_count=len(messages),
        messages=messages,
        provider=checkpoint.get_provider()
    )


@app.put("/session/{session_id}")
async def update_session(session_id: str, req: SessionUpdateRequest, authorization: Optional[str] = Header(None)):
    user = get_current_user(authorization)
    checkpoint = Checkpoint(session_id, user_id=user["user_id"])
    checkpoint.save(req.messages)
    return {"message": "Session updated successfully.", "session_id": session_id, "message_count": len(req.messages)}


# Provider Model Limits Metadata (Official context windows and rates)
PROVIDER_MODEL_LIMITS = {
    "claude": {
        "model_name":  CLAUDE_MODEL,
        "max_tokens":  200000,
        "description": f"Anthropic Claude ({CLAUDE_MODEL}) - 200,000 token context window",
        "input_rate":  COSTS.get("claude", {}).get("input", 0.00025),
        "output_rate": COSTS.get("claude", {}).get("output", 0.00125)
    },
    "openai": {
        "model_name":  OPENAI_MODEL,
        "max_tokens":  128000,
        "description": f"OpenAI ({OPENAI_MODEL}) - 128,000 token context window",
        "input_rate":  COSTS.get("openai", {}).get("input", 0.00015),
        "output_rate": COSTS.get("openai", {}).get("output", 0.00060)
    },
    "gemini": {
        "model_name":  GEMINI_MODEL,
        "max_tokens":  1000000,
        "description": f"Google ({GEMINI_MODEL}) - 1,000,000 token context window",
        "input_rate":  COSTS.get("gemini", {}).get("input", 0.00000),
        "output_rate": COSTS.get("gemini", {}).get("output", 0.00000)
    }
}


@app.get("/model/limits/{provider}", response_model=ModelLimits)
async def get_model_limits(provider: str):
    prov = (provider or "").strip().lower()
    if prov not in PROVIDER_MODEL_LIMITS:
        raise HTTPException(
            status_code=400,
            detail=f"Unknown provider '{provider}'. Supported providers: claude, openai, gemini"
        )
    return ModelLimits(**PROVIDER_MODEL_LIMITS[prov])


@app.post("/key/validate", response_model=KeyValidationResponse)
@app.post("/keys/validate", response_model=KeyValidationResponse)
async def validate_key_endpoint(req: KeyValidationRequest, authorization: Optional[str] = Header(None)):
    """
    Validates an API key against the provider by making a minimal real API call.
    Also returns provider context limits and description on success.
    """
    # Allow authenticated users to validate keys
    get_current_user(authorization)
    result = await validate_api_key(req.api_key, req.provider)
    return KeyValidationResponse(**result)



@app.get("/usage/{session_id}", response_model=UsageSummary)
async def get_usage(session_id: str, token_budget: int = 50000, provider: Optional[str] = None,
                    authorization: Optional[str] = Header(None)):
    user = get_current_user(authorization)
    budget = Budget(session_id, token_budget, provider=provider, user_id=user["user_id"])
    return UsageSummary(**budget.summary())


@app.delete("/session/{session_id}")
async def delete_session(session_id: str, authorization: Optional[str] = Header(None)):
    user = get_current_user(authorization)
    Checkpoint(session_id, user_id=user["user_id"]).delete()
    return {"message": f"Session {session_id} cleared."}


# -------------------------------------------------------
# TokenVault
# -------------------------------------------------------

@app.get("/tokenvault/{session_id}")
async def tokenvault_session(session_id: str, authorization: Optional[str] = Header(None)):
    user = get_current_user(authorization)
    return session_stats(session_id, user_id=user["user_id"])


@app.get("/tokenvault")
async def tokenvault_global(authorization: Optional[str] = Header(None)):
    get_current_user(authorization)
    return global_stats()


from fastapi.staticfiles import StaticFiles
import os

frontend_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "frontend"))
if os.path.exists(frontend_path):
    app.mount("/", StaticFiles(directory=frontend_path, html=True), name="frontend")


if __name__ == "__main__":
    uvicorn.run("main:app", host=HOST, port=PORT, reload=DEBUG)
