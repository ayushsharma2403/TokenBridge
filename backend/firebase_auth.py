"""
firebase_auth.py

Handles Firebase Phone Authentication.
Verifies the ID token sent from the frontend after phone OTP verification.
"""

import firebase_admin
from firebase_admin import credentials, auth
from database import connect
from auth import create_token
import os

# Initialize Firebase Admin SDK once
cred_path = os.path.join(os.path.dirname(__file__), "firebase_key.json")
if not firebase_admin._apps:
    cred = credentials.Certificate(cred_path)
    firebase_admin.initialize_app(cred)


def verify_firebase_token(id_token: str) -> dict:
    """
    Verifies the Firebase ID token sent from the frontend.
    Returns user info if valid, error if not.
    """
    try:
        decoded = auth.verify_id_token(id_token)
        return {
            "uid":   decoded.get("uid"),
            "phone": decoded.get("phone_number"),
            "valid": True
        }
    except Exception as e:
        return {"valid": False, "error": str(e)}


def login_with_phone(id_token: str) -> dict:
    """
    Verifies Firebase token, finds or creates user in MySQL,
    returns our own JWT token.
    """
    verified = verify_firebase_token(id_token)
    if not verified["valid"]:
        return {"error": "Invalid Firebase token."}

    phone = verified["phone"]
    uid   = verified["uid"]

    if not phone:
        return {"error": "No phone number found in token."}

    conn = connect()
    c    = conn.cursor()

    # Check if user exists by phone (stored in google_id column)
    c.execute(
        "SELECT id, name, email FROM users WHERE google_id = %s",
        (uid,)
    )
    existing = c.fetchone()

    if existing:
        user_id = existing[0]
        name    = existing[1]
        email   = existing[2] or ""
    else:
        # Create new user with phone number as name
        name  = phone
        email = ""
        c.execute(
            "INSERT INTO users (name, email, google_id, password_hash) VALUES (%s, %s, %s, %s)",
            (name, email, uid, None)
        )
        conn.commit()
        user_id = c.lastrowid

    c.close()
    conn.close()

    token = create_token(user_id)
    return {
        "token":   token,
        "user_id": user_id,
        "name":    name,
        "email":   email,
        "phone":   phone
    }
