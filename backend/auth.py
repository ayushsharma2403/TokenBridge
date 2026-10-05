"""
auth.py — User authentication

Handles: registration, login, JWT tokens, password reset
"""

import os
import secrets
import string
from datetime import datetime, timedelta
from typing import Optional

from jose import JWTError, jwt
from passlib.context import CryptContext
from database import connect

# --- Config ---
SECRET_KEY = os.getenv("JWT_SECRET")
if not SECRET_KEY:
    raise RuntimeError(
        "JWT_SECRET environment variable is not set. "
        "Set it in your .env file before starting the server."
    )

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
            email          VARCHAR(150) NULL UNIQUE,
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

def register_user(name: str, email: str, password: str, dob: Optional[str] = None) -> dict:
    conn = connect()
    c    = conn.cursor()

    # Check if email already exists
    c.execute("SELECT id FROM users WHERE email = %s", (email,))
    if c.fetchone():
        c.close()
        conn.close()
        return {"error": "Email already registered."}

    clean_dob = dob.strip() if dob and dob.strip() else None
    if not clean_dob:
        c.close()
        conn.close()
        return {"error": "Date of birth is required."}

    age = None
    try:
        from datetime import datetime
        born = datetime.strptime(clean_dob, "%Y-%m-%d")
        today = datetime.today()
        age = today.year - born.year - ((today.month, today.day) < (born.month, born.day))
    except Exception:
        pass

    if age is None or age < 18:
        c.close()
        conn.close()
        return {"error": "Access restricted: You must be at least 18 years old."}

    c.execute(
        "INSERT INTO users (name, email, password_hash, dob, age) VALUES (%s, %s, %s, %s, %s)",
        (name, email, hash_password(password), clean_dob, age)
    )
    conn.commit()
    user_id = c.lastrowid
    c.close()
    conn.close()

    return {"user_id": user_id, "name": name, "email": email, "dob": clean_dob, "age": age}


# -------------------------------------------------------
# Login
# -------------------------------------------------------

def login_user(email: str, password: str, remember_me: bool = False) -> dict:
    conn = connect()
    c    = conn.cursor()

    c.execute(
        "SELECT id, name, email, password_hash, age FROM users WHERE email = %s AND is_active = TRUE",
        (email,)
    )
    user = c.fetchone()
    c.close()
    conn.close()

    if not user:
        return {"error": "Email not found."}

    if not verify_password(password, user[3]):
        return {"error": "Incorrect password."}

    user_age = user[4]
    if user_age is not None and user_age < 18:
        return {"error": "Access restricted: You must be at least 18 years old to log in."}

    token = create_token(user[0], remember_me)
    return {
        "token":   token,
        "user_id": user[0],
        "name":    user[1],
        "email":   user[2]
    }


# -------------------------------------------------------
# Get user from token
# -------------------------------------------------------

def get_user_from_token(token: str) -> Optional[dict]:
    user_id = decode_token(token)
    if not user_id:
        return None

    conn = connect()
    c    = conn.cursor()
    c.execute(
        "SELECT id, name, email, dob, age, subscription_tier, language, created_at FROM users WHERE id = %s AND is_active = TRUE",
        (user_id,)
    )
    user = c.fetchone()
    c.close()
    conn.close()

    if not user:
        return None

    return {
        "user_id": user[0],
        "name": user[1],
        "email": user[2],
        "dob": str(user[3]) if user[3] else None,
        "age": user[4],
        "subscription_tier": user[5] or "Free",
        "language": user[6] or "en",
        "created_at": str(user[7]) if user[7] else None
    }


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

    reset_token   = secrets.token_urlsafe(32)
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

    return {"message": "Password updated successfully."}


def update_password_by_email(email: str, new_password: str) -> dict:
    conn = connect()
    c    = conn.cursor()

    c.execute("SELECT id FROM users WHERE email = %s AND is_active = TRUE", (email,))
    user = c.fetchone()
    if not user:
        c.close()
        conn.close()
        return {"error": "No registered account found with this email."}

    c.execute(
        "UPDATE users SET password_hash = %s, reset_token = NULL, reset_expires = NULL WHERE id = %s",
        (hash_password(new_password), user[0])
    )
    conn.commit()
    c.close()
    conn.close()

    return {"message": "Password updated successfully."}


def change_user_password(user_id: int, old_password: str, new_password: str) -> dict:
    conn = connect()
    c    = conn.cursor()

    c.execute("SELECT password_hash FROM users WHERE id = %s AND is_active = TRUE", (user_id,))
    row = c.fetchone()
    if not row:
        c.close()
        conn.close()
        return {"error": "User not found."}

    current_hash = row[0]
    if current_hash:
        if not old_password or not verify_password(old_password, current_hash):
            c.close()
            conn.close()
            return {"error": "Current password does not match."}

    c.execute(
        "UPDATE users SET password_hash = %s WHERE id = %s",
        (hash_password(new_password), user_id)
    )
    conn.commit()
    c.close()
    conn.close()
    return {"message": "Password changed successfully."}


def update_user_profile(user_id: int, name: Optional[str] = None, dob: Optional[str] = None,
                        age: Optional[int] = None, subscription_tier: Optional[str] = None,
                        language: Optional[str] = None) -> dict:
    conn = connect()
    c    = conn.cursor()

    updates = []
    params = []
    if name is not None and name.strip():
        updates.append("name = %s")
        params.append(name.strip())
    if dob is not None:
        if dob == "" or dob.lower() == "null":
            updates.append("dob = NULL")
        else:
            updates.append("dob = %s")
            params.append(dob)
    if age is not None:
        updates.append("age = %s")
        params.append(age)
    if subscription_tier is not None:
        updates.append("subscription_tier = %s")
        params.append(subscription_tier)
    if language is not None:
        updates.append("language = %s")
        params.append(language)

    if not updates:
        c.close()
        conn.close()
        return {"message": "No updates specified."}

    params.append(user_id)
    query = f"UPDATE users SET {', '.join(updates)} WHERE id = %s AND is_active = TRUE"
    c.execute(query, tuple(params))
    conn.commit()

    c.execute("SELECT id, name, email, dob, age, subscription_tier, language, created_at FROM users WHERE id = %s", (user_id,))
    u = c.fetchone()
    c.close()
    conn.close()

    return {
        "user_id": u[0],
        "name": u[1],
        "email": u[2],
        "dob": str(u[3]) if u[3] else None,
        "age": u[4],
        "subscription_tier": u[5] or "Free",
        "language": u[6] or "en",
        "created_at": str(u[7]) if u[7] else None
    }
