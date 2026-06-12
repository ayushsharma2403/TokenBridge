"""
budget.py — Token budget tracker

Each session has a budget (set by the user). Every API call deducts from it.
When the remaining tokens fall below what a call needs, we trigger a checkpoint
instead of making the call — so progress is never lost.
"""

from datetime import datetime
from database import connect


class Budget:

    def __init__(self, session_id: str, total_tokens: int):
        self.session_id  = session_id
        self.total       = total_tokens

    # ------------------------------------------------------------------
    # Core calculations
    # ------------------------------------------------------------------

    def used_so_far(self) -> int:
        """Total tokens spent across all calls in this session."""
        conn = connect()
        c = conn.cursor()
        c.execute(
            "SELECT SUM(tokens_used) FROM usage_log WHERE session_id = ?",
            (self.session_id,)
        )
        row = c.fetchone()
        conn.close()

        # SUM returns None if there are no rows yet
        return row[0] if row[0] else 0

    def remaining(self) -> int:
        return max(0, self.total - self.used_so_far())

    def has_enough(self, estimated_tokens: int) -> bool:
        """
        Call this before every API request.
        estimated_tokens should include both input + expected output tokens.
        """
        return self.remaining() >= estimated_tokens

    # ------------------------------------------------------------------
    # Logging
    # ------------------------------------------------------------------

    def log_usage(self, tokens: int, call_type: str = "chat") -> None:
        """
        Records how many tokens an API call used.
        call_type can be 'chat' or 'summarize' (optimizer calls are logged too).
        """
        conn = connect()
        c = conn.cursor()
        c.execute(
            "INSERT INTO usage_log (session_id, tokens_used, call_type, logged_at) VALUES (?, ?, ?, ?)",
            (self.session_id, tokens, call_type, datetime.now().isoformat())
        )
        conn.commit()
        conn.close()

    # ------------------------------------------------------------------
    # Summary (for the frontend token meter)
    # ------------------------------------------------------------------

    def summary(self) -> dict:
        used      = self.used_so_far()
        remaining = self.remaining()

        return {
            "total_budget":  self.total,
            "used":          used,
            "remaining":     remaining,
            "percent_left":  round((remaining / self.total) * 100, 1) if self.total > 0 else 0
        }
