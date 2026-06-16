"""
email_service.py � Gmail SMTP email sender

Sends password reset emails using Gmail App Password.
"""

import smtplib
import os
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from dotenv import load_dotenv

load_dotenv()

GMAIL_ADDRESS  = os.getenv("GMAIL_ADDRESS", "")
GMAIL_PASSWORD = os.getenv("GMAIL_APP_PASSWORD", "")
APP_URL        = os.getenv("APP_URL", "http://localhost:8000")


def send_reset_email(to_email: str, name: str, reset_token: str) -> bool:
    """
    Sends a password reset email with a link.
    Returns True if sent successfully, False otherwise.
    """
    reset_link = f"{APP_URL}/auth/reset-password?token={reset_token}"

    # Build email
    msg = MIMEMultipart("alternative")
    msg["Subject"] = "TokenBridge - Reset Your Password"
    msg["From"]    = GMAIL_ADDRESS
    msg["To"]      = to_email

    # Plain text version
    text = f"""
Hi {name},

You requested a password reset for your TokenBridge account.

Click this link to reset your password (expires in 1 hour):
{reset_link}

If you did not request this, ignore this email.

- TokenBridge Team
"""

    # HTML version
    html = f"""
<html>
<body style="font-family: Poppins, sans-serif; background: #f5f5f5; padding: 40px;">
  <div style="max-width: 480px; margin: auto; background: white;
              border-radius: 16px; padding: 40px; box-shadow: 0 2px 12px rgba(0,0,0,0.1);">

    <h2 style="color: #7c3aed;">TokenBridge</h2>
    <p>Hi <strong>{name}</strong>,</p>
    <p>You requested a password reset. Click the button below to set a new password.</p>
    <p>This link expires in <strong>1 hour</strong>.</p>

    <a href="{reset_link}"
       style="display: inline-block; margin: 24px 0; padding: 14px 32px;
              background: #7c3aed; color: white; border-radius: 12px;
              text-decoration: none; font-weight: 600;">
      Reset Password
    </a>

    <p style="color: #888; font-size: 13px;">
      If you did not request this, you can safely ignore this email.
    </p>
    <hr style="border: none; border-top: 1px solid #eee; margin: 24px 0;">
    <p style="color: #888; font-size: 12px;">TokenBridge Team</p>
  </div>
</body>
</html>
"""

    msg.attach(MIMEText(text, "plain"))
    msg.attach(MIMEText(html, "html"))

    try:
        with smtplib.SMTP_SSL("smtp.gmail.com", 465) as server:
            server.login(GMAIL_ADDRESS, GMAIL_PASSWORD)
            server.sendmail(GMAIL_ADDRESS, to_email, msg.as_string())
        print(f"[Email] Reset email sent to {to_email}")
        return True
    except Exception as e:
        print(f"[Email] Failed to send email: {e}")
        return False
