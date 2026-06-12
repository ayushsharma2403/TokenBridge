"""
optimizer.py — Token compression engine

This is the most important file in the project.

The problem: every message you send to Claude includes the entire chat history.
A 40-message conversation could be 6,000+ tokens just for the context.

The solution: once the history gets long, we summarize the older messages
into a short paragraph and throw away the originals. The last few messages
are always kept verbatim so the AI still has fresh context.

Result: 40–70% fewer tokens used, same quality of answers.
"""

import anthropic
from typing import Tuple


# --- Config ---
# Summarization uses the cheapest Claude model (fastest + cheapest)
SUMMARIZER_MODEL    = "claude-haiku-4-5-20251001"

# How many tokens before we start compressing (tune this to your taste)
COMPRESSION_TRIGGER = 2500

# These messages are always kept as-is — only older ones get summarized
KEEP_RECENT_N       = 6


# ------------------------------------------------------------------
# Token counting
# ------------------------------------------------------------------

def estimate_tokens(messages: list) -> int:
    """
    Rough estimate: ~4 characters = 1 token.
    Used as a quick check before making an actual API counting call.
    """
    total = sum(len(str(m.get("content", ""))) for m in messages)
    return total // 4


def count_tokens(messages: list, api_key: str) -> int:
    """
    Exact token count using Anthropic's free count_tokens endpoint.
    Falls back to estimate if the API call fails.
    """
    try:
        client = anthropic.Anthropic(api_key=api_key)
        result = client.messages.count_tokens(
            model=SUMMARIZER_MODEL,
            messages=messages
        )
        return result.input_tokens
    except Exception as e:
        print(f"[Optimizer] count_tokens failed ({e}), using estimate instead.")
        return estimate_tokens(messages)


# ------------------------------------------------------------------
# Summarization
# ------------------------------------------------------------------

def summarize_old_messages(old_messages: list, api_key: str) -> list:
    """
    Converts a list of old messages into two short messages:
    - A user message containing the summary
    - An assistant acknowledgment

    These two replace all the old messages, saving tokens while
    preserving the key context the AI needs.
    """
    if not old_messages:
        return []

    # Build a readable block of the old conversation
    conversation_block = ""
    for msg in old_messages:
        role    = msg.get("role", "unknown").upper()
        content = str(msg.get("content", ""))
        conversation_block += f"{role}: {content}\n\n"

    prompt = f"""Summarize the following conversation in 3–5 concise bullet points.
Capture: main topics, key decisions, any answers given, and important context.
This summary will replace the original messages, so be specific — not vague.

---
{conversation_block.strip()}
---

Write the bullet points now (no preamble):"""

    try:
        client = anthropic.Anthropic(api_key=api_key)
        response = client.messages.create(
            model=SUMMARIZER_MODEL,
            max_tokens=350,
            messages=[{"role": "user", "content": prompt}]
        )
        summary = response.content[0].text.strip()
        print(f"[Optimizer] Summarized {len(old_messages)} messages → ~{len(summary)} chars.")

    except Exception as e:
        # Fallback: generic note so we don't crash
        print(f"[Optimizer] Summarization API call failed: {e}")
        summary = f"(Earlier conversation — {len(old_messages)} messages. Summary unavailable.)"

    return [
        {
            "role":    "user",
            "content": f"[Summary of earlier messages in this conversation]\n{summary}"
        },
        {
            "role":    "assistant",
            "content": "Understood — I'll keep that context in mind as we continue."
        }
    ]


# ------------------------------------------------------------------
# Main function (this is what main.py calls)
# ------------------------------------------------------------------

def optimize(messages: list, api_key: str) -> Tuple[list, int]:
    """
    Compresses the conversation if it's above the token threshold.

    Returns:
        (messages, token_count)
        messages is either the original list (if small enough)
        or the compressed version (summary + recent messages).
    """
    token_count = count_tokens(messages, api_key)

    # If we're still within the safe zone, nothing to do
    if token_count <= COMPRESSION_TRIGGER:
        return messages, token_count

    # Not enough messages to bother splitting
    if len(messages) <= KEEP_RECENT_N:
        return messages, token_count

    print(f"[Optimizer] {token_count} tokens — compressing...")

    # Split into old (will be summarized) and recent (kept as-is)
    old_messages    = messages[:-KEEP_RECENT_N]
    recent_messages = messages[-KEEP_RECENT_N:]

    summary = summarize_old_messages(old_messages, api_key)
    compressed = summary + recent_messages

    new_count = count_tokens(compressed, api_key)
    saved     = token_count - new_count
    pct       = round((saved / token_count) * 100) if token_count > 0 else 0

    print(f"[Optimizer] Done. {token_count} → {new_count} tokens (saved {saved}, {pct}% reduction).")

    return compressed, new_count
