"""
checkpoint.py — Save and load conversation state

Think of each Checkpoint as a save file in a video game.
When a user runs low on tokens, we save their conversation here.
Next time they come back (with fresh credits), they resume from this point.
"""

import json
from datetime import datetime
from typing import Optional
from database import connect


class Checkpoint:

    def __init__(self, session_id: str, user_id: int = None):
        self.session_id = session_id
        self.user_id = user_id

    # ------------------------------------------------------------------
    # Save
    # ------------------------------------------------------------------

    def save(self, messages: list, provider: str = "claude") -> None:
        """
        Writes the conversation to the database.
        If a checkpoint already exists for this session, it updates it.
        """
        conn = connect()
        c = conn.cursor()
        now = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

        c.execute("""
            INSERT INTO sessions (session_id, user_id, messages, provider, created_at, updated_at)
            VALUES (%s, %s, %s, %s, %s, %s)
            ON DUPLICATE KEY UPDATE
                user_id    = COALESCE(VALUES(user_id), user_id),
                messages   = VALUES(messages),
                provider   = VALUES(provider),
                updated_at = VALUES(updated_at)
        """, (
            self.session_id,
            self.user_id,
            json.dumps(messages),   # list → JSON string for storage
            provider,
            now,
            now
        ))

        conn.commit()
        conn.close()

    # ------------------------------------------------------------------
    # Load
    # ------------------------------------------------------------------

    def load(self) -> list:
        """
        Loads conversation history from the database.
        Returns an empty list if no checkpoint exists yet or user_id is None.
        """
        if self.user_id is None:
            return []

        conn = connect()
        c = conn.cursor(dictionary=True)

        c.execute(
            "SELECT messages FROM sessions WHERE session_id = %s AND user_id = %s",
            (self.session_id, self.user_id)
        )
        row = c.fetchone()
        conn.close()

        if row:
            loaded_msgs = json.loads(row["messages"])  # JSON string → list
            # Clean up any legacy injected real-time context from user messages
            for msg in loaded_msgs:
                if msg.get("role") == "user" and isinstance(msg.get("content"), str):
                    if "[VERIFIED REAL-TIME INFORMATION & CONTEXT]:" in msg["content"]:
                        msg["content"] = msg["content"].split("[VERIFIED REAL-TIME INFORMATION & CONTEXT]:")[0].strip()
            return loaded_msgs

        return []  # no checkpoint found, start fresh

    def get_provider(self) -> Optional[str]:
        if self.user_id is None:
            return None

        conn = connect()
        c = conn.cursor(dictionary=True)
        c.execute(
            "SELECT provider FROM sessions WHERE session_id = %s AND user_id = %s",
            (self.session_id, self.user_id)
        )
        row = c.fetchone()
        conn.close()
        return row["provider"] if row and row.get("provider") else None

    # ------------------------------------------------------------------
    # Utilities
    # ------------------------------------------------------------------

    def exists(self) -> bool:
        """Returns True if a saved checkpoint exists for this session."""
        if self.user_id is None:
            return False
        return len(self.load()) > 0

    def delete(self) -> None:
        """Wipes the checkpoint — for when a user wants a clean start."""
        if self.user_id is None:
            return

        conn = connect()
        c = conn.cursor()
        c.execute(
            "DELETE FROM sessions WHERE session_id = %s AND user_id = %s",
            (self.session_id, self.user_id)
        )
        conn.commit()
        conn.close()

    def info(self) -> dict:
        """
        Returns metadata about the checkpoint — used by the frontend
        to show the user when their last session was saved.
        """
        if self.user_id is None:
            return {}

        conn = connect()
        c = conn.cursor(dictionary=True)
        c.execute(
            "SELECT provider, created_at, updated_at FROM sessions WHERE session_id = %s AND user_id = %s",
            (self.session_id, self.user_id)
        )
        row = c.fetchone()
        conn.close()

        if not row:
            return {}

        return {
            "session_id":  self.session_id,
            "provider":    row["provider"],
            "created_at":  row["created_at"],
            "last_saved":  row["updated_at"]
        }
