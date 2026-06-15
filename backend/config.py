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
CLAUDE_MODEL  = "claude-haiku-4-5-20251001"
OPENAI_MODEL  = "gpt-4o-mini"
GEMINI_MODEL  = "gemini-1.5-flash"

# --- Optimizer settings ---
COMPRESS_AT     = 2500
KEEP_LAST_N     = 6
RESPONSE_BUFFER = 600

# --- Server ---
HOST  = os.getenv("HOST",  "0.0.0.0")
PORT  = int(os.getenv("PORT", "8000"))
DEBUG = os.getenv("DEBUG", "true").lower() == "true"
