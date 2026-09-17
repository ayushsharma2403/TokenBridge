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
    elif api_key.startswith("AIza") or api_key.startswith("AQ."):
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

    # Convert messages to Gemini format, ensuring strictly alternating turns
    history = []
    for msg in messages[:-1]:
        role = "user" if msg.get("role") == "user" else "model"
        content = str(msg.get("content", ""))
        if history and history[-1]["role"] == role:
            history[-1]["parts"][0] += "\n\n" + content
        else:
            history.append({"role": role, "parts": [content]})

    # Gemini history must start with a 'user' turn
    if history and history[0]["role"] != "user":
        history.insert(0, {"role": "user", "parts": ["Context:"]})

    last_content = str(messages[-1].get("content", "")) if messages else ""

    # Prioritize configured model, then known working fallbacks
    models_to_try = [GEMINI_MODEL, "gemini-3.6-flash", "gemini-flash-latest"]
    candidates = []
    for m in models_to_try:
        clean = (m or "").replace("models/", "").strip()
        if clean and clean not in ["gemini-1.5-flash", "gemini-2.5-flash"] and clean not in candidates:
            candidates.append(clean)
    if not candidates:
        candidates = ["gemini-3.6-flash", "gemini-flash-latest"]

    last_error = None
    for model_name in candidates:
        try:
            model = genai.GenerativeModel(model_name)
            chat = model.start_chat(history=history)
            response = chat.send_message(last_content)

            input_tokens = getattr(response.usage_metadata, "prompt_token_count", 0) or 0
            output_tokens = getattr(response.usage_metadata, "candidates_token_count", 0) or 0
            return response.text, input_tokens, output_tokens
        except Exception as e:
            last_error = e
            err_msg = str(e)
            if "404" in err_msg or "not found" in err_msg.lower() or "not supported" in err_msg.lower():
                continue
            raise e

    raise last_error


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
