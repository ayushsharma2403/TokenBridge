import os
from dotenv import load_dotenv

load_dotenv()

DB_CONFIG = {
    "host":     os.getenv("DB_HOST",     "localhost"),
    "port":     int(os.getenv("DB_PORT", "3306")),
    "user":     os.getenv("DB_USER",     "root"),
    "password": os.getenv("DB_PASSWORD", ""),
    "database": os.getenv("DB_NAME",     "tokenbridge"),
}

# --- AI Models ---
CLAUDE_MODEL  = os.getenv("CLAUDE_MODEL",  "claude-3-5-haiku-20241022")
OPENAI_MODEL  = os.getenv("OPENAI_MODEL",  "gpt-4o-mini")

_raw_gemini = os.getenv("GEMINI_MODEL", "gemini-3.6-flash").strip()
# Automatically migrate discontinued/deprecated Gemini models that return 404 on v1beta
if _raw_gemini in ["gemini-1.5-flash", "gemini-1.5-flash-latest", "gemini-1.5-pro", "gemini-2.5-flash", "models/gemini-1.5-flash"]:
    GEMINI_MODEL = "gemini-3.6-flash"
else:
    GEMINI_MODEL = _raw_gemini

# --- Optimizer settings ---
COMPRESS_AT     = 2500
KEEP_LAST_N     = 6
RESPONSE_BUFFER = 600

# --- Server ---
HOST    = os.getenv("HOST",    "0.0.0.0")
PORT    = int(os.getenv("PORT", "8000"))
DEBUG   = os.getenv("DEBUG",   "true").lower() == "true"
APP_URL = os.getenv("APP_URL", f"http://localhost:{PORT}")
