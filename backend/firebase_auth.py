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
        decoded = auth.verify_id_token(id_token, check_revoked=False, clock_skew_seconds=60)
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


def login_with_phone(id_token: str, user_name: str = None, dob: str = None) -> dict:
    verified = verify_firebase_token(id_token)
    if not verified["valid"]:
        return {"error": verified["error"]}

    phone = verified["phone"]
    uid   = verified["uid"]

    if not phone:
        return {"error": "No phone number found in token."}

    conn = connect()
    c    = conn.cursor()

    # Check if user already exists by Firebase UID or phone number
    c.execute(
        "SELECT id, name, email, dob, age FROM users WHERE google_id = %s OR phone = %s",
        (uid, phone)
    )
    existing = c.fetchone()

    clean_name = (user_name or "").strip()
    clean_dob  = dob.strip() if dob and dob.strip() else None
    age = None
    if clean_dob:
        try:
            from datetime import datetime
            born = datetime.strptime(clean_dob, "%Y-%m-%d")
            today = datetime.today()
            age = today.year - born.year - ((today.month, today.day) < (born.month, born.day))
        except Exception:
            pass

    if age is not None and age < 18:
        c.close()
        conn.close()
        return {"error": "Access restricted: You must be at least 18 years old to log in."}

    is_new = False
    if existing:
        user_id = existing[0]
        name    = existing[1]
        email   = existing[2] or ""
        curr_dob = str(existing[3]) if existing[3] else None
        existing_age = existing[4] if len(existing) > 4 else None

        if existing_age is not None and existing_age < 18 and (age is None or age < 18):
            c.close()
            conn.close()
            return {"error": "Access restricted: You must be at least 18 years old to log in."}

        # Keep google_id / phone updated
        c.execute("UPDATE users SET google_id = %s, phone = %s WHERE id = %s", (uid, phone, user_id))

        # If user passed a custom name and existing name was just the phone or needs update
        if clean_name and (name == phone or name.startswith("+") or name != clean_name):
            name = clean_name
            c.execute("UPDATE users SET name = %s WHERE id = %s", (name, user_id))
        if clean_dob:
            curr_dob = clean_dob
            c.execute("UPDATE users SET dob = %s, age = %s WHERE id = %s", (clean_dob, age, user_id))
        conn.commit()
    else:
        is_new = True
        name  = clean_name if clean_name else phone
        email = ""
        curr_dob = clean_dob
        c.execute(
            "INSERT INTO users (name, email, phone, google_id, dob, age) VALUES (%s, %s, %s, %s, %s, %s)",
            (name, None, phone, uid, clean_dob, age)
        )
        conn.commit()
        user_id = c.lastrowid

    c.close()
    conn.close()

    token = create_token(user_id)
    return {
        "token":       token,
        "user_id":     user_id,
        "name":        name,
        "email":       email,
        "phone":       phone,
        "dob":         curr_dob,
        "is_new_user": is_new
    }

