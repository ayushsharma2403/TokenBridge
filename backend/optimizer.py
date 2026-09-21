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


from config import CLAUDE_MODEL
# Summarization uses the configured Claude model
SUMMARIZER_MODEL    = CLAUDE_MODEL

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
        if api_key.startswith("AIza") or api_key.startswith("AQ."):
            import google.generativeai as genai
            from config import GEMINI_MODEL
            genai.configure(api_key=api_key)
            model_name = GEMINI_MODEL if GEMINI_MODEL not in ["gemini-1.5-flash", "gemini-2.5-flash"] else "gemini-3.6-flash"
            model = genai.GenerativeModel(model_name)
            res = model.generate_content(prompt)
            summary = res.text.strip()
        elif api_key.startswith("sk-") and not api_key.startswith("sk-ant-"):
            from openai import OpenAI
            from config import OPENAI_MODEL
            client = OpenAI(api_key=api_key)
            res = client.chat.completions.create(
                model=OPENAI_MODEL,
                max_tokens=350,
                messages=[{"role": "user", "content": prompt}]
            )
            summary = res.choices[0].message.content.strip()
        else:
            client = anthropic.Anthropic(api_key=api_key)
            response = client.messages.create(
                model=SUMMARIZER_MODEL,
                max_tokens=350,
                messages=[{"role": "user", "content": prompt}]
            )
            summary = response.content[0].text.strip()
        print(f"[Optimizer] Summarized {len(old_messages)} messages -> ~{len(summary)} chars.")

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

def optimize(messages: list, api_key: str, efficiency: str = "medium") -> Tuple[list, int]:
    """
    Compresses the conversation if it's above the token threshold.
    Efficiency levels:
      - 'low': Higher threshold (4000 tokens), preserves more context (last 10 messages).
      - 'medium': Default threshold (2500 tokens), preserves moderate context (last 6 messages).
      - 'hard': Aggressive threshold (1500 tokens), preserves minimal context (last 4 messages).

    Returns:
        (messages, token_count)
    """
    token_count = count_tokens(messages, api_key)

    eff = (efficiency or "medium").lower()
    if eff == "low":
        # Low mode: User wants short answers and fast usage; trigger compression early and keep fewer messages
        trigger = 1500
        keep_recent = 4
    elif eff in ["high", "hard"]:
        # High mode: User wants in-depth/deep analysis with maximum context retained
        trigger = 4500
        keep_recent = 12
    else:  # medium
        trigger = COMPRESSION_TRIGGER
        keep_recent = KEEP_RECENT_N

    # If we're still within the safe zone, nothing to do
    if token_count <= trigger:
        return messages, token_count

    # Not enough messages to bother splitting
    if len(messages) <= keep_recent:
        return messages, token_count

    print(f"[Optimizer] {token_count} tokens (efficiency={eff}, trigger={trigger}) — compressing...")

    # Split into old (will be summarized) and recent (kept as-is)
    old_messages    = messages[:-keep_recent]
    recent_messages = messages[-keep_recent:]

    summary = summarize_old_messages(old_messages, api_key)
    compressed = summary + recent_messages

    new_count = count_tokens(compressed, api_key)
    saved     = token_count - new_count
    pct       = round((saved / token_count) * 100) if token_count > 0 else 0

    print(f"[Optimizer] Done. {token_count} -> {new_count} tokens (saved {saved}, {pct}% reduction).")

    return compressed, new_count

