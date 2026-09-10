import firebase_admin
from firebase_admin import credentials, auth
from database import connect
from auth import create_token
import os

cred_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "firebase_key.json")
if not firebase_admin._apps:
    cred = credentials.Certificate(cred_path)
    firebase_admin.initialize_app(cred)


def verify_firebase_token(id_token: str) -> dict:
    try:
        decoded = auth.verify_id_token(id_token, check_revoked=False)
        return {
            "uid":   decoded.get("uid"),
            "phone": decoded.get("phone_number"),
            "valid": True
        }
    except auth.RevokedIdTokenError:
        return {"valid": False, "error": "Token revoked."}
    except auth.ExpiredIdTokenError:
        return {"valid": False, "error": "Token expired."}
    except auth.InvalidIdTokenError as e:
        return {"valid": False, "error": f"Invalid token: {str(e)}"}
    except Exception as e:
        return {"valid": False, "error": str(e)}


def login_with_phone(id_token: str) -> dict:
    verified = verify_firebase_token(id_token)
    if not verified["valid"]:
        return {"error": verified["error"]}

    phone = verified["phone"]
    uid   = verified["uid"]

    if not phone:
        return {"error": "No phone number found in token."}

    conn = connect()
    c    = conn.cursor()

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
        name  = phone
        email = ""
        c.execute(
            "INSERT INTO users (name, email, google_id) VALUES (%s, %s, %s)",
            (name, email, uid)
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
