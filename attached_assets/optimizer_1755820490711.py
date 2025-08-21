from typing import List, Optional, Dict, Any
from dataclasses import dataclass, field

# --- Heuristics & catalogues ---
TECHNIQUE_CATALOG = {
    "creative": ["multi‑perspective ideation", "tone scaffolding", "contrast pairs"],
    "technical": ["constraint boxing", "acceptance criteria", "I/O examples"],
    "educational": ["few‑shot pedagogy", "clear sectioning", "scaffolded steps"],
    "complex": ["task decomposition", "chain‑of‑thought (implicit)", "systematic frameworks"]
}

DEFAULT_OUTPUT_SPEC = [
    "Structure your response with headings and bullets where helpful.",
    "Be concise and specific; avoid filler.",
    "Include assumptions you made, if any."
]

@dataclass
class LyraRequest:
    user_prompt: str
    mode: str = "DETAIL"            # DETAIL or BASIC
    target_ai: str = "ChatGPT"      # ChatGPT, Claude, Gemini, Other
    request_type: str = "technical" # creative | technical | educational | complex
    audience: Optional[str] = None
    tone: Optional[str] = None
    style: Optional[str] = None
    output_format: Optional[str] = None
    constraints: List[str] = field(default_factory=list)
    examples: Optional[str] = None  # few‑shot or input examples
    additional_context: Optional[str] = None

@dataclass
class LyraResponse:
    optimized_prompt: str
    what_changed: List[str]
    pro_tip: str
    mode_used: str

# --- Core engine ---
class LyraEngine:
    def __init__(self):
        pass

    def _select_techniques(self, request_type: str) -> List[str]:
        return TECHNIQUE_CATALOG.get(request_type.lower(), TECHNIQUE_CATALOG["technical"])

    def _prep_sections(self, req: LyraRequest) -> Dict[str, Any]:
        # Deconstruct & Diagnose (very light heuristic pass)
        missing = []
        if not req.output_format:
            missing.append("output_format")
        if not req.tone and not req.style:
            missing.append("tone/style")
        if not req.audience:
            missing.append("audience")

        techniques = self._select_techniques(req.request_type)
        return {"missing": missing, "techniques": techniques}

    def _build_prompt(self, req: LyraRequest, prep: Dict[str, Any]) -> str:
        role = {
            "technical": "You are a senior solutions architect and precise technical writer.",
            "creative": "You are an award‑winning creative director and copywriter.",
            "educational": "You are a master teacher who explains with clarity and structure.",
            "complex": "You are a principal consultant skilled at decomposing messy problems."
        }.get(req.request_type.lower(), "You are a capable domain expert.")

        # Build sections
        lines = []
        lines.append(f"ROLE: {role}")
        lines.append("")
        lines.append("GOAL: Execute the task to high quality with clarity and efficiency.")
        lines.append("")
        lines.append("INPUTS / CONTEXT:")
        lines.append(f"- User brief: {req.user_prompt.strip()}")
        if req.additional_context:
            lines.append(f"- Extra context: {req.additional_context.strip()}")
        if req.audience:
            lines.append(f"- Target audience: {req.audience}")
        lines.append("")

        lines.append("CONSTRAINTS & GUARDRAILS:")
        if req.tone:
            lines.append(f"- Tone: {req.tone}")
        if req.style:
            lines.append(f"- Style: {req.style}")
        for c in req.constraints:
            lines.append(f"- {c}")
        lines.extend([f"- {spec}" for spec in DEFAULT_OUTPUT_SPEC])
        lines.append("")

        lines.append("OUTPUT SPECIFICATIONS:")
        if req.output_format:
            lines.append(f"- Required format: {req.output_format}")
        else:
            lines.append("- Required format: Structured markdown with sections.")
        lines.append("- Length: Fit the content; avoid unnecessary verbosity.")
        lines.append("")

        if req.examples:
            lines.append("FEW‑SHOT EXAMPLES:")
            lines.append(req.examples.strip())
            lines.append("")

        lines.append("PROCESS:")
        if req.request_type.lower() == "technical":
            steps = [
                "Clarify requirements in a short checklist.",
                "Provide a concise solution with runnable snippets if relevant.",
                "Add acceptance criteria and edge cases."
            ]
        elif req.request_type.lower() == "creative":
            steps = [
                "Generate 3 distinct concepts with titles.",
                "Iterate on the best concept with a refined draft.",
                "Provide a final polished version."
            ]
        elif req.request_type.lower() == "educational":
            steps = [
                "Explain simply, then progressively deepen.",
                "Include a quick example and a short exercise with answer.",
                "Summarize key takeaways."
            ]
        else:  # complex
            steps = [
                "Decompose the task into sub‑tasks.",
                "Address each sub‑task with rationale (concise).",
                "Provide a final consolidated deliverable."
            ]
        for i, s in enumerate(steps, 1):
            lines.append(f"- Step {i}: {s}")
        lines.append("")

        style_line = "STYLE & TONE GUIDE:"
        lines.append(style_line)
        if req.tone or req.style:
            if req.tone: lines.append(f"- Tone: {req.tone}")
            if req.style: lines.append(f"- Style: {req.style}")
        else:
            lines.append("- Tone: clear, confident, concise.")
            lines.append("- Style: structured, example‑driven, no fluff.")
        lines.append("")

        lines.append("DELIVERABLE: Provide the final answer only, without preamble.")
        return "\n".join(lines)

    def optimize(self, req: LyraRequest) -> LyraResponse:
        prep = self._prep_sections(req)
        optimized = self._build_prompt(req, prep)

        # Build change log
        what_changed = [
            "Clarified role and goal to focus the model’s behavior.",
            "Structured the prompt into explicit sections for predictability.",
            "Added constraints, guardrails, and acceptance criteria defaults.",
            f"Applied techniques for '{req.request_type}' tasks: {', '.join(prep['techniques'])}.",
        ]
        if prep["missing"]:
            what_changed.append(f"Filled likely gaps by assuming: {', '.join(prep['missing'])}.")

        pro_tip = "If the output misses the mark, paste it back under 'INPUTS / CONTEXT' and re‑run; Lyra self‑corrects fast."
        return LyraResponse(optimized_prompt=optimized, what_changed=what_changed, pro_tip=pro_tip, mode_used=req.mode)

# Convenience function
def optimize_prompt(payload: Dict[str, Any]) -> Dict[str, Any]:
    engine = LyraEngine()
    req = LyraRequest(**payload)
    res = engine.optimize(req)
    return {
        "optimized_prompt": res.optimized_prompt,
        "what_changed": res.what_changed,
        "pro_tip": res.pro_tip,
        "mode_used": res.mode_used,
    }