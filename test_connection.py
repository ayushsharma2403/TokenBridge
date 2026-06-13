import sys
import os

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "backend"))

from database import connect, setup

print("\n--- TokenBridge Connection Test ---\n")

print("1. Connecting to MySQL...")
try:
    conn = connect()
    cursor = conn.cursor()
    cursor.execute("SELECT VERSION()")
    version = cursor.fetchone()
    print(f"   OK - MySQL {version[0]}")
    cursor.close()
    conn.close()
except Exception as e:
    print(f"   FAILED - {e}")
    print("\n   Check:")
    print("   - Is MySQL running?")
    print("   - Is your .env file filled in correctly?")
    sys.exit(1)

print("\n2. Setting up tables...")
try:
    setup()
    print("   OK - Tables are ready")
except Exception as e:
    print(f"   FAILED - {e}")
    sys.exit(1)

print("\n--- All checks passed! ---")
print("Run the server with: cd backend && python main.py\n")
