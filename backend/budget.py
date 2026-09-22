"""
budget.py — Token budget tracker

Each session has a budget (set by the user). Every API call deducts from it.
When the remaining tokens fall below what a call needs, we trigger a checkpoint
instead of making the call — so progress is never lost.
"""

from datetime import datetime
from database import connect


class Budget:

    def __init__(self, session_id: str, total_tokens: int, provider: str = None):
        self.session_id  = session_id
        self.total       = total_tokens
        self.provider    = (provider or "").strip().lower() if provider else None

    # ------------------------------------------------------------------
    # Core calculations
    # ------------------------------------------------------------------

    def used_so_far(self) -> int:
        """Total tokens spent across calls in this session (filtered by provider if specified)."""
        conn = connect()
        c = conn.cursor()
        if self.provider:
            c.execute(
                "SELECT COALESCE(SUM(tokens_used), 0) FROM usage_log WHERE session_id = %s AND LOWER(provider) = %s",
                (self.session_id, self.provider)
            )
        else:
            c.execute(
                "SELECT COALESCE(SUM(tokens_used), 0) FROM usage_log WHERE session_id = %s",
                (self.session_id,)
            )
        row = c.fetchone()
        conn.close()

        return int(row[0]) if (row and row[0] is not None) else 0

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

    def log_usage(self, tokens: int, call_type: str = "chat", user_id: int = None, provider: str = None) -> None:
        """
        Records how many tokens an API call used, including the provider.
        call_type can be 'chat' or 'summarize' (optimizer calls are logged too).
        """
        prov = provider or self.provider or "claude"
        conn = connect()
        c = conn.cursor()
        c.execute(
            "INSERT INTO usage_log (session_id, user_id, provider, tokens_used, call_type, logged_at) VALUES (%s, %s, %s, %s, %s, %s)",
            (self.session_id, user_id, prov, tokens, call_type, datetime.now().strftime("%Y-%m-%d %H:%M:%S"))
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
            "percent_left":  round((remaining / self.total) * 100, 1) if self.total > 0 else 0,
            "provider":      self.provider
        }
