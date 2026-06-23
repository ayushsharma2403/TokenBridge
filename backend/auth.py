"""
auth.py � User authentication

Handles: registration, login, JWT tokens, password reset
"""

import os
import random
import string
from datetime import datetime, timedelta
from typing import Optional

from jose import JWTError, jwt
from passlib.context import CryptContext
from database import connect

# --- Config ---
SECRET_KEY      = os.getenv("JWT_SECRET", "tokenbridge-secret-change-in-production")
ALGORITHM       = "HS256"
TOKEN_EXPIRE    = 30    # days (normal login)
REMEMBER_EXPIRE = 30    # days (remember me)

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


# -------------------------------------------------------
# Password helpers
# -------------------------------------------------------

def hash_password(password: str) -> str:
    return pwd_context.hash(password[:72])

def verify_password(plain: str, hashed: str) -> bool:
    return pwd_context.verify(plain[:72], hashed)


# -------------------------------------------------------
# JWT helpers
# -------------------------------------------------------

def create_token(user_id: int, remember_me: bool = False) -> str:
    days    = REMEMBER_EXPIRE if remember_me else TOKEN_EXPIRE
    expires = datetime.utcnow() + timedelta(days=days)
    return jwt.encode(
        {"sub": str(user_id), "exp": expires},
        SECRET_KEY,
        algorithm=ALGORITHM
    )

def decode_token(token: str) -> Optional[int]:
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        return int(payload["sub"])
    except JWTError:
        return None


# -------------------------------------------------------
# User table setup
# -------------------------------------------------------

def setup_users_table():
    conn = connect()
    c    = conn.cursor()
    c.execute("""
        CREATE TABLE IF NOT EXISTS users (
            id             INT AUTO_INCREMENT PRIMARY KEY,
            name           VARCHAR(100) NOT NULL,
            email          VARCHAR(150) NOT NULL UNIQUE,
            password_hash  VARCHAR(255),
            google_id      VARCHAR(100),
            reset_token    VARCHAR(100),
            reset_expires  DATETIME,
            created_at     DATETIME DEFAULT CURRENT_TIMESTAMP,
            is_active      BOOLEAN  DEFAULT TRUE
        )
    """)
    conn.commit()
    c.close()
    conn.close()


# -------------------------------------------------------
# Register
# -------------------------------------------------------

def register_user(name: str, email: str, password: str) -> dict:
    conn = connect()
    c    = conn.cursor()

    # Check if email already exists
    c.execute("SELECT id FROM users WHERE email = %s", (email,))
    if c.fetchone():
        c.close()
        conn.close()
        return {"error": "Email already registered."}

    c.execute(
        "INSERT INTO users (name, email, password_hash) VALUES (%s, %s, %s)",
        (name, email, hash_password(password))
    )
    conn.commit()
    user_id = c.lastrowid
    c.close()
    conn.close()

    return {"user_id": user_id, "name": name, "email": email}


# -------------------------------------------------------
# Login
# -------------------------------------------------------

def login_user(email: str, password: str, remember_me: bool = False) -> dict:
    conn = connect()
    c    = conn.cursor()

    c.execute(
        "SELECT id, name, email, password_hash FROM users WHERE email = %s AND is_active = TRUE",
        (email,)
    )
    user = c.fetchone()
    c.close()
    conn.close()

    if not user:
        return {"error": "Email not found."}

    if not verify_password(password, user[3]):
        return {"error": "Incorrect password."}

    token = create_token(user[0], remember_me)
    return {
        "token":   token,
        "user_id": user[0],
        "name":    user[1],
        "email":   user[2]
    }


# -------------------------------------------------------
# Get current user from token
# -------------------------------------------------------

def get_user_from_token(token: str) -> Optional[dict]:
    user_id = decode_token(token)
    if not user_id:
        return None

    conn = connect()
    c    = conn.cursor()
    c.execute(
        "SELECT id, name, email FROM users WHERE id = %s AND is_active = TRUE",
        (user_id,)
    )
    user = c.fetchone()
    c.close()
    conn.close()

    if not user:
        return None

    return {"user_id": user[0], "name": user[1], "email": user[2]}


# -------------------------------------------------------
# Password reset
# -------------------------------------------------------

def generate_reset_token(email: str) -> Optional[str]:
    conn = connect()
    c    = conn.cursor()

    c.execute("SELECT id FROM users WHERE email = %s", (email,))
    user = c.fetchone()
    if not user:
        c.close()
        conn.close()
        return None

    reset_token   = "".join(random.choices(string.ascii_letters + string.digits, k=32))
    reset_expires = datetime.utcnow() + timedelta(hours=1)

    c.execute(
        "UPDATE users SET reset_token = %s, reset_expires = %s WHERE email = %s",
        (reset_token, reset_expires, email)
    )
    conn.commit()
    c.close()
    conn.close()

    return reset_token


def reset_password(token: str, new_password: str) -> dict:
    conn = connect()
    c    = conn.cursor()

    c.execute(
        "SELECT id FROM users WHERE reset_token = %s AND reset_expires > %s",
        (token, datetime.utcnow())
    )
    user = c.fetchone()
    if not user:
        c.close()
        conn.close()
        return {"error": "Invalid or expired reset token."}

    c.execute(
        "UPDATE users SET password_hash = %s, reset_token = NULL, reset_expires = NULL WHERE id = %s",
        (hash_password(new_password), user[0])
    )
    conn.commit()
    c.close()
    conn.close()

    return {"message": "Password reset successful."}
