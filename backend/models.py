from pydantic import BaseModel


class ChatRequest(BaseModel):
    session_id:   str
    message:      str
    api_key:      str
    provider:     str = "claude"
    token_budget: int = 50000


class ChatResponse(BaseModel):
    reply:            str
    session_id:       str
    tokens_this_call: int
    tokens_remaining: int
    total_used:       int
    checkpoint_saved: bool


class PromptEngineerRequest(BaseModel):
    raw_prompt: str
    api_key:    str


class PromptEngineerResponse(BaseModel):
    original:        str
    optimized:       str
    tokens_used:     int
    word_count:      dict
    saving_estimate: str


class SessionInfo(BaseModel):
    session_id:    str
    message_count: int
    messages:      list


class UsageSummary(BaseModel):
    total_budget: int
    used:         int
    remaining:    int
    percent_left: float
