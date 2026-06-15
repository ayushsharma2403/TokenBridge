import anthropic
import google.generativeai as genai
from openai import AsyncOpenAI
from typing import Tuple
from config import CLAUDE_MODEL, OPENAI_MODEL, GEMINI_MODEL


def detect_provider(api_key: str, provider: str = None) -> str:
    """Auto-detect provider from API key if provider not specified."""
    if provider and provider.strip().lower() != "auto":
        return provider.strip().lower()
    if api_key.startswith("sk-ant-"):
        return "claude"
    elif api_key.startswith("AIza"):
        return "gemini"
    else:
        return "openai"


async def send_to_claude(messages: list, api_key: str) -> Tuple[str, int, int]:
    client   = anthropic.AsyncAnthropic(api_key=api_key)
    response = await client.messages.create(
        model=CLAUDE_MODEL,
        max_tokens=1024,
        messages=messages
    )
    return (
        response.content[0].text,
        response.usage.input_tokens,
        response.usage.output_tokens
    )


async def send_to_openai(messages: list, api_key: str) -> Tuple[str, int, int]:
    client   = AsyncOpenAI(api_key=api_key)
    response = await client.chat.completions.create(
        model=OPENAI_MODEL,
        max_tokens=1024,
        messages=messages
    )
    return (
        response.choices[0].message.content,
        response.usage.prompt_tokens,
        response.usage.completion_tokens
    )


async def send_to_gemini(messages: list, api_key: str) -> Tuple[str, int, int]:
    genai.configure(api_key=api_key)
    model = genai.GenerativeModel(GEMINI_MODEL)

    # Convert messages to Gemini format
    history = []
    for msg in messages[:-1]:
        role = "user" if msg["role"] == "user" else "model"
        history.append({"role": role, "parts": [msg["content"]]})

    chat     = model.start_chat(history=history)
    response = chat.send_message(messages[-1]["content"])

    input_tokens  = response.usage_metadata.prompt_token_count
    output_tokens = response.usage_metadata.candidates_token_count
    return response.text, input_tokens, output_tokens


async def call_api(messages: list, api_key: str, provider: str) -> Tuple[str, int, int]:
    """
    Routes to the correct provider.
    Returns (reply, input_tokens, output_tokens)
    """
    provider = detect_provider(api_key, provider)

    if provider == "claude":
        return await send_to_claude(messages, api_key)
    elif provider == "openai":
        return await send_to_openai(messages, api_key)
    elif provider == "gemini":
        return await send_to_gemini(messages, api_key)
    else:
        raise ValueError(
            f"Unknown provider: {provider}. Valid: claude, openai, gemini"
        )
