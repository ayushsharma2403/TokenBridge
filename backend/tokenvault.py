"""
tokenvault.py

Tracks token usage and cost per provider across all sessions.
Stores everything permanently in MySQL.
"""

from datetime import datetime
from database import connect


# Cost per 1000 tokens in USD for each provider
COSTS = {
    "claude":  {"input": 0.00025, "output": 0.00125},
    "openai":  {"input": 0.00015, "output": 0.00060},
    "gemini":  {"input": 0.00000, "output": 0.00000},
}


def log(session_id: str, provider: str, input_tokens: int,
        output_tokens: int, call_type: str = "chat",
        tokens_saved: int = 0, saving_source: str = "none",
        user_id: int = None) -> float:
    """Logs one API call. Returns cost in USD."""

    total    = input_tokens + output_tokens
    rates    = COSTS.get(provider, {"input": 0.0, "output": 0.0})
    cost_usd = round(
        (input_tokens  / 1000) * rates["input"] +
        (output_tokens / 1000) * rates["output"], 6
    )

    conn = connect()
    c    = conn.cursor()
    c.execute("""
        INSERT INTO tokenvault
            (session_id, user_id, provider, call_type, input_tokens, output_tokens,
             total_tokens, cost_usd, tokens_saved, saving_source, logged_at)
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
    """, (session_id, user_id, provider, call_type, input_tokens, output_tokens,
             total, cost_usd, tokens_saved, saving_source,
             datetime.now().strftime("%Y-%m-%d %H:%M:%S")))
    conn.commit()
    c.close()
    conn.close()
    return cost_usd


def session_stats(session_id: str) -> dict:
    """Token stats for one session broken down by provider."""
    conn = connect()
    c    = conn.cursor()
    c.execute("""
        SELECT provider,
               COALESCE(SUM(input_tokens), 0),
               COALESCE(SUM(output_tokens), 0),
               COALESCE(SUM(total_tokens), 0),
               COALESCE(SUM(cost_usd), 0.0),
               COALESCE(SUM(tokens_saved), 0),
               COUNT(*)
        FROM tokenvault
        WHERE session_id = %s
        GROUP BY provider
    """, (session_id,))
    rows = c.fetchall()
    c.close()
    conn.close()

    by_provider        = {}
    grand_tokens       = 0
    grand_cost         = 0.0
    grand_saved        = 0

    for row in rows:
        inp   = int(row[1] or 0)
        out   = int(row[2] or 0)
        tot   = int(row[3] or 0)
        cst   = round(float(row[4] or 0.0), 6)
        svd   = int(row[5] or 0)
        calls = int(row[6] or 0)
        by_provider[row[0]] = {
            "input_tokens":  inp,
            "output_tokens": out,
            "total_tokens":  tot,
            "cost_usd":      cst,
            "tokens_saved":  svd,
            "calls":         calls
        }
        grand_tokens += tot
        grand_cost   += cst
        grand_saved  += svd

    total = grand_tokens + grand_saved
    efficiency = f"{round((grand_saved / total) * 100)}% saved" if total > 0 else "N/A"

    return {
        "session_id":     session_id,
        "by_provider":    by_provider,
        "total_tokens":   grand_tokens,
        "total_cost_usd": round(grand_cost, 6),
        "tokens_saved":   grand_saved,
        "efficiency":     efficiency
    }


def global_stats() -> dict:
    """All time stats across every session and provider."""
    conn = connect()
    c    = conn.cursor()
    c.execute("""
        SELECT provider,
               COALESCE(SUM(total_tokens), 0),
               COALESCE(SUM(cost_usd), 0.0),
               COALESCE(SUM(tokens_saved), 0),
               COUNT(*)
        FROM tokenvault
        GROUP BY provider
        ORDER BY SUM(total_tokens) DESC
    """)
    rows = c.fetchall()
    c.close()
    conn.close()

    result = {}
    for row in rows:
        result[row[0]] = {
            "total_tokens": int(row[1] or 0),
            "cost_usd":     round(float(row[2] or 0.0), 6),
            "tokens_saved": int(row[3] or 0),
            "total_calls":  int(row[4] or 0)
        }
    return {"all_time": result}
