"""
checkpoint.py — Save and load conversation state

Think of each Checkpoint as a save file in a video game.
When a user runs low on tokens, we save their conversation here.
Next time they come back (with fresh credits), they resume from this point.
"""

import json
from datetime import datetime
from database import connect


class Checkpoint:

    def __init__(self, session_id: str):
        self.session_id = session_id

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
        now = datetime.now().isoformat()

        c.execute("""
            INSERT INTO sessions (session_id, messages, provider, created_at, updated_at)
            VALUES (%s, %s, %s, %s, %s)
            ON DUPLICATE KEY UPDATE
                messages   = VALUES(messages),
                provider   = VALUES(provider),
                updated_at = VALUES(updated_at)
        """, (
            self.session_id,
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
        Returns an empty list if no checkpoint exists yet (fresh session).
        """
        conn = connect()
        c = conn.cursor(dictionary=True)

        c.execute(
            "SELECT messages FROM sessions WHERE session_id = %s",
            (self.session_id,)
        )
        row = c.fetchone()
        conn.close()

        if row:
            return json.loads(row["messages"])  # JSON string → list

        return []  # no checkpoint found, start fresh

    # ------------------------------------------------------------------
    # Utilities
    # ------------------------------------------------------------------

    def exists(self) -> bool:
        """Returns True if a saved checkpoint exists for this session."""
        return len(self.load()) > 0

    def delete(self) -> None:
        """Wipes the checkpoint — for when a user wants a clean start."""
        conn = connect()
        c = conn.cursor()
        c.execute(
            "DELETE FROM sessions WHERE session_id = %s",
            (self.session_id,)
        )
        conn.commit()
        conn.close()

    def info(self) -> dict:
        """
        Returns metadata about the checkpoint — used by the frontend
        to show the user when their last session was saved.
        """
        conn = connect()
        c = conn.cursor(dictionary=True)
        c.execute(
            "SELECT provider, created_at, updated_at FROM sessions WHERE session_id = %s",
            (self.session_id,)
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
