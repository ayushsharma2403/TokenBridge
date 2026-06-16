"""
oauth.py � Google OAuth handler

Handles the Google login flow:
1. Redirect user to Google login page
2. Google sends back a code
3. We exchange the code for user info
4. We create/find the user in MySQL
5. We return a JWT token
"""

import os
import httpx
from database import connect
from auth import create_token, hash_password
from dotenv import load_dotenv

load_dotenv()

GOOGLE_CLIENT_ID     = os.getenv("GOOGLE_CLIENT_ID", "")
GOOGLE_CLIENT_SECRET = os.getenv("GOOGLE_CLIENT_SECRET", "")
REDIRECT_URI         = os.getenv("APP_URL", "http://localhost:8000") + "/auth/google/callback"

GOOGLE_AUTH_URL  = "https://accounts.google.com/o/oauth2/v2/auth"
GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token"
GOOGLE_USER_URL  = "https://www.googleapis.com/oauth2/v2/userinfo"


def get_google_login_url() -> str:
    """Returns the Google login URL to redirect the user to."""
    params = (
        f"client_id={GOOGLE_CLIENT_ID}"
        f"&redirect_uri={REDIRECT_URI}"
        f"&response_type=code"
        f"&scope=openid email profile"
        f"&access_type=offline"
    )
    return f"{GOOGLE_AUTH_URL}?{params}"


async def handle_google_callback(code: str) -> dict:
    """
    Exchanges the Google code for user info,
    creates or finds the user in MySQL,
    and returns a JWT token.
    """
    async with httpx.AsyncClient() as client:

        # Step 1: Exchange code for access token
        token_response = await client.post(GOOGLE_TOKEN_URL, data={
            "code":          code,
            "client_id":     GOOGLE_CLIENT_ID,
            "client_secret": GOOGLE_CLIENT_SECRET,
            "redirect_uri":  REDIRECT_URI,
            "grant_type":    "authorization_code"
        })
        token_data   = token_response.json()
        access_token = token_data.get("access_token")

        if not access_token:
            return {"error": "Failed to get access token from Google."}

        # Step 2: Get user info from Google
        user_response = await client.get(
            GOOGLE_USER_URL,
            headers={"Authorization": f"Bearer {access_token}"}
        )
        google_user = user_response.json()

    google_id = google_user.get("id")
    email     = google_user.get("email")
    name      = google_user.get("name", email)

    if not email:
        return {"error": "Could not get email from Google."}

    # Step 3: Find or create user in MySQL
    conn = connect()
    c    = conn.cursor()

    # Check if user exists by google_id or email
    c.execute(
        "SELECT id, name FROM users WHERE google_id = %s OR email = %s",
        (google_id, email)
    )
    existing = c.fetchone()

    if existing:
        user_id   = existing[0]
        user_name = existing[1]
        # Update google_id if missing
        c.execute(
            "UPDATE users SET google_id = %s WHERE id = %s",
            (google_id, user_id)
        )
    else:
        # Create new user
        c.execute(
            "INSERT INTO users (name, email, google_id) VALUES (%s, %s, %s)",
            (name, email, google_id)
        )
        user_id   = c.lastrowid
        user_name = name

    conn.commit()
    c.close()
    conn.close()

    # Step 4: Create and return JWT token
    token = create_token(user_id)
    return {
        "token":   token,
        "user_id": user_id,
        "name":    user_name,
        "email":   email
    }
