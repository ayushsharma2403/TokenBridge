"""
router.py — AI provider router

Handles the actual API calls to Claude and OpenAI.
Both functions have the same signature → (reply, tokens_used)
so main.py doesn't need to know which provider it's talking to.
"""

import anthropic
from typing import Tuple


# Using the cheapest models — good for students with limited credits
# Users can change these in the future (Phase 6 feature)
CLAUDE_MODEL  = "claude-haiku-4-5-20251001"
OPENAI_MODEL  = "gpt-4o-mini"


# ------------------------------------------------------------------
# Claude
# ------------------------------------------------------------------

async def send_to_claude(messages: list, api_key: str) -> Tuple[str, int]:
    """Sends a chat request to Claude and returns (reply_text, tokens_used)."""
    client = anthropic.AsyncAnthropic(api_key=api_key)

    response = await client.messages.create(
        model=CLAUDE_MODEL,
        max_tokens=1024,
        messages=messages
    )

    reply  = response.content[0].text
    tokens = response.usage.input_tokens + response.usage.output_tokens

    return reply, tokens


# ------------------------------------------------------------------
# OpenAI
# ------------------------------------------------------------------

async def send_to_openai(messages: list, api_key: str) -> Tuple[str, int]:
    """Sends a chat request to OpenAI and returns (reply_text, tokens_used)."""
    try:
        from openai import AsyncOpenAI
    except ImportError:
        raise RuntimeError(
            "The 'openai' package is not installed. "
            "Run: pip install openai"
        )

    client = AsyncOpenAI(api_key=api_key)

    response = await client.chat.completions.create(
        model=OPENAI_MODEL,
        max_tokens=1024,
        messages=messages
    )

    reply  = response.choices[0].message.content
    tokens = response.usage.total_tokens

    return reply, tokens


# ------------------------------------------------------------------
# Main routing function (this is what main.py calls)
# ------------------------------------------------------------------

async def call_api(messages: list, api_key: str, provider: str) -> Tuple[str, int]:
    """
    Routes the request to the right AI provider.

    provider: "claude" or "openai"
    Returns: (reply_text, tokens_used)
    """
    provider = provider.strip().lower()

    if provider == "claude":
        return await send_to_claude(messages, api_key)
    elif provider == "openai":
        return await send_to_openai(messages, api_key)
    else:
        raise ValueError(
            f"Unknown provider: '{provider}'. "
            "Accepted values are 'claude' or 'openai'."
        )
