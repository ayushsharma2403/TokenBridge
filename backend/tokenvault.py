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
        tokens_saved: int = 0, saving_source: str = "none") -> float:
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
            (session_id, provider, call_type, input_tokens, output_tokens,
             total_tokens, cost_usd, tokens_saved, saving_source, logged_at)
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
    """, (session_id, provider, call_type, input_tokens, output_tokens,
             total, cost_usd, tokens_saved, saving_source,
             datetime.now().isoformat()))
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
               SUM(input_tokens),
               SUM(output_tokens),
               SUM(total_tokens),
               SUM(cost_usd),
               SUM(tokens_saved),
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
        by_provider[row[0]] = {
            "input_tokens":  row[1],
            "output_tokens": row[2],
            "total_tokens":  row[3],
            "cost_usd":      round(row[4], 6),
            "tokens_saved":  row[5],
            "calls":         row[6]
        }
        grand_tokens += row[3]
        grand_cost   += row[4]
        grand_saved  += row[5]

    total = grand_tokens + grand_saved
    efficiency = f"{round((grand_saved / total) * 100)}% saved" if total > 0 else "N/A"

    return {
        "session_id":    session_id,
        "by_provider":   by_provider,
        "total_tokens":  grand_tokens,
        "total_cost_usd": round(grand_cost, 6),
        "tokens_saved":  grand_saved,
        "efficiency":    efficiency
    }


def global_stats() -> dict:
    """All time stats across every session and provider."""
    conn = connect()
    c    = conn.cursor()
    c.execute("""
        SELECT provider,
               SUM(total_tokens),
               SUM(cost_usd),
               SUM(tokens_saved),
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
            "total_tokens": row[1],
            "cost_usd":     round(row[2], 6),
            "tokens_saved": row[3],
            "total_calls":  row[4]
        }
    return {"all_time": result}
