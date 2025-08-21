from fastapi import FastAPI
from pydantic import BaseModel, Field
from typing import Optional, List
from optimizer import optimize_prompt

app = FastAPI(title="Lyra Prompt Optimizer", version="1.0.0")

class OptimizeRequest(BaseModel):
    user_prompt: str = Field(..., description="Raw user input or task brief")
    mode: str = "DETAIL"                      # DETAIL or BASIC
    target_ai: str = "ChatGPT"                # ChatGPT, Claude, Gemini, Other
    request_type: str = "technical"           # creative | technical | educational | complex
    audience: Optional[str] = None
    tone: Optional[str] = None
    style: Optional[str] = None
    output_format: Optional[str] = None
    constraints: List[str] = []
    examples: Optional[str] = None
    additional_context: Optional[str] = None

class OptimizeResponse(BaseModel):
    optimized_prompt: str
    what_changed: List[str]
    pro_tip: str
    mode_used: str

@app.get("/health")
def health():
    return {"status": "ok"}

@app.post("/optimize", response_model=OptimizeResponse)
def optimize(req: OptimizeRequest):
    return optimize_prompt(req.dict())