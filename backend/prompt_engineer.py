import anthropic
from config import CLAUDE_MODEL

META_PROMPT = """You are a prompt engineering expert.
Rewrite the user message to be specific, concise, and structured.
Remove filler phrases. Keep the exact same intent.
Return ONLY the rewritten prompt. No explanation."""


def engineer_prompt(raw_prompt: str, api_key: str) -> dict:
    client   = anthropic.Anthropic(api_key=api_key)
    response = client.messages.create(
        model=CLAUDE_MODEL,
        max_tokens=300,
        system=META_PROMPT,
        messages=[{"role": "user", "content": raw_prompt}]
    )
    optimized    = response.content[0].text.strip()
    tokens_used  = response.usage.input_tokens + response.usage.output_tokens
    orig_words   = len(raw_prompt.split())
    opt_words    = len(optimized.split())
    diff         = orig_words - opt_words
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
        "saving_estimate": saving
    }
