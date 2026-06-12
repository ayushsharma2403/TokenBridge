"""
database.py — SQLite setup and connection helper

All other files import from here. This keeps DB logic in one place
so if we ever switch to PostgreSQL, we only change this file.
"""

import sqlite3
import os

# Database file lives in the backend folder
DB_FILE = os.path.join(os.path.dirname(__file__), "data.db")


def connect():
    """
    Returns a connection to the SQLite database.
    row_factory lets us access columns by name instead of index.
    e.g. row["session_id"] instead of row[0]
    """
    conn = sqlite3.connect(DB_FILE)
    conn.row_factory = sqlite3.Row
    return conn


def setup():
    """
    Creates all the tables we need if they don't exist yet.
    Call this once at server startup — safe to call multiple times.
    """
    conn = connect()
    c = conn.cursor()

    # sessions: stores full conversation history for each user
    # ON CONFLICT(session_id) in checkpoint.py will upsert into this table
    c.execute("""
        CREATE TABLE IF NOT EXISTS sessions (
            session_id   TEXT PRIMARY KEY,
            messages     TEXT    NOT NULL,
            provider     TEXT    DEFAULT 'claude',
            created_at   TEXT    NOT NULL,
            updated_at   TEXT    NOT NULL
        )
    """)

    # usage_log: every API call gets logged here so we can track spending
    c.execute("""
        CREATE TABLE IF NOT EXISTS usage_log (
            id           INTEGER PRIMARY KEY AUTOINCREMENT,
            session_id   TEXT    NOT NULL,
            tokens_used  INTEGER NOT NULL,
            call_type    TEXT,
            logged_at    TEXT    NOT NULL
        )
    """)

    conn.commit()
    conn.close()
    print("[DB] Tables are ready.")
