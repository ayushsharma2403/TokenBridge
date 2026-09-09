import anthropic
from openai import OpenAI
import google.generativeai as genai
from config import CLAUDE_MODEL, OPENAI_MODEL, GEMINI_MODEL

META_PROMPT = """You are a prompt engineering expert.
Rewrite the user message to be specific, concise, and structured.
Remove filler phrases. Keep the exact same intent.
Return ONLY the rewritten prompt. No explanation."""


def detect_provider(api_key: str) -> str:
    if api_key.startswith("sk-ant-"):
        return "claude"
    elif api_key.startswith("AIza"):
        return "gemini"
    return "openai"


def engineer_prompt(raw_prompt: str, api_key: str) -> dict:
    provider = detect_provider(api_key)

    if provider == "claude":
        client   = anthropic.Anthropic(api_key=api_key)
        response = client.messages.create(
            model=CLAUDE_MODEL,
            max_tokens=300,
            system=META_PROMPT,
            messages=[{"role": "user", "content": raw_prompt}]
        )
        optimized   = response.content[0].text.strip()
        tokens_used = response.usage.input_tokens + response.usage.output_tokens

    elif provider == "gemini":
        genai.configure(api_key=api_key)
        model = genai.GenerativeModel(
            model_name=GEMINI_MODEL,
            system_instruction=META_PROMPT
        )
        response = model.generate_content(raw_prompt)
        optimized = response.text.strip()
        tokens_used = 0
        if hasattr(response, "usage_metadata") and response.usage_metadata:
            tokens_used = (getattr(response.usage_metadata, "prompt_token_count", 0) or 0) + (getattr(response.usage_metadata, "candidates_token_count", 0) or 0)

    else:
        client   = OpenAI(api_key=api_key)
        response = client.chat.completions.create(
            model=OPENAI_MODEL,
            max_tokens=300,
            messages=[
                {"role": "system", "content": META_PROMPT},
                {"role": "user",   "content": raw_prompt}
            ]
        )
        optimized   = response.choices[0].message.content.strip()
        tokens_used = response.usage.total_tokens

    orig_words = len(raw_prompt.split())
    opt_words  = len(optimized.split())
    diff       = orig_words - opt_words

    if diff > 0:
        saving = f"~{round((diff/orig_words)*100)}% shorter"
    elif diff < 0:
        saving = "Expanded for clarity"
    else:
        saving = "Similar length, better structure"

    return {
        "original":        raw_prompt,
        "optimized":       optimized,
        "tokens_used":     tokens_used,
        "word_count":      {"original": orig_words, "optimized": opt_words},
        "saving_estimate": saving,
        "provider_used":   provider
    }
