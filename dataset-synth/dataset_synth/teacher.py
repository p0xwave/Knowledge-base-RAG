"""Teacher LLM client — requests chunk-based Q&A from a model.

Works against any OpenAI-compatible endpoint (OpenAI cloud or a vLLM
server). The prompt asks the teacher to answer using only the supplied chunk.
The parser accepts nonempty string question/answer fields. It does not verify
that an answer is supported by the chunk; quality needs separate evaluation.
"""

from __future__ import annotations

import json
import re
import time
from dataclasses import dataclass

from loguru import logger
from openai import OpenAI
from openai.types.chat import ChatCompletionMessageParam

from dataset_synth.config import SynthConfig

SYSTEM_PROMPT = (
    "You generate question-answer pairs for training a retrieval-augmented "
    "PyTorch assistant. You are given ONE documentation chunk. Produce "
    "self-contained Q&A pairs that can be answered USING ONLY that chunk.\n"
    "Rules:\n"
    "- Every answer MUST be fully supported by the chunk. Never use outside knowledge.\n"
    "- Questions should sound like a developer asking about PyTorch — natural and varied.\n"
    "- Answers: concise but complete. Include API names, signatures and code from the "
    "chunk when relevant, using fenced ```python blocks.\n"
    "- Do NOT mention 'the chunk', 'the context' or 'the documentation' — write "
    "questions and answers as standalone text.\n"
    "- If the chunk has too little usable content, return fewer pairs (even zero).\n"
    'Output STRICT JSON only: {"pairs": [{"question": "...", "answer": "..."}]}'
)

USER_TEMPLATE = (
    "Documentation chunk:\n```\n{chunk}\n```\n\nGenerate up to {n} Q&A pairs."
)

_JSON_OBJ_RE = re.compile(r"\{.*\}", re.DOTALL)


@dataclass
class QAPair:
    question: str
    answer: str


def _parse_pairs(raw: str) -> list[QAPair]:
    """Defensively extract Q&A pairs from the teacher's response."""
    if not raw:
        return []
    text = raw.strip()
    # strip markdown code fences if the model wrapped JSON in them
    if text.startswith("```"):
        text = re.sub(r"^```(?:json)?\s*|\s*```$", "", text, flags=re.DOTALL)

    data = None
    try:
        data = json.loads(text)
    except json.JSONDecodeError:
        m = _JSON_OBJ_RE.search(text)
        if m:
            try:
                data = json.loads(m.group(0))
            except json.JSONDecodeError:
                return []
    if not isinstance(data, dict):
        return []

    pairs: list[QAPair] = []
    items = data.get("pairs")
    if not isinstance(items, list):
        return []
    for item in items:
        if not isinstance(item, dict):
            continue
        q, a = item.get("question"), item.get("answer")
        if not isinstance(q, str) or not isinstance(a, str):
            continue
        q, a = q.strip(), a.strip()
        if q and a:
            pairs.append(QAPair(question=q, answer=a))
    return pairs


class Teacher:
    """Thin wrapper around an OpenAI-compatible chat endpoint."""

    def __init__(self, config: SynthConfig) -> None:
        if not config.teacher_api_url:
            raise ValueError("teacher_api_url is required")
        self.client = OpenAI(
            base_url=config.teacher_api_url,
            api_key=config.teacher_api_key,
            timeout=config.teacher_timeout,
        )
        self.system_prompt = config.teacher_system_prompt or SYSTEM_PROMPT
        self.strict_errors = config.strict_errors
        self.model = config.teacher_model
        self.temperature = config.teacher_temperature
        self.max_tokens = config.teacher_max_tokens
        self.n = config.n_qa_per_chunk

    def generate(self, chunk_text: str, max_retries: int = 4) -> list[QAPair]:
        """Request Q&A for one chunk; return [] on persistent failure."""
        messages: list[ChatCompletionMessageParam] = [
            {"role": "system", "content": self.system_prompt},
            {
                "role": "user",
                "content": USER_TEMPLATE.format(chunk=chunk_text, n=self.n),
            },
        ]
        for attempt in range(max_retries):
            try:
                resp = self.client.chat.completions.create(
                    model=self.model,
                    messages=messages,
                    temperature=self.temperature,
                    max_tokens=self.max_tokens,
                )
                return _parse_pairs(resp.choices[0].message.content or "")[: self.n]
            except Exception as exc:  # noqa: BLE001
                if self.strict_errors:
                    raise RuntimeError(
                        "Teacher request failed; check endpoint configuration and availability"
                    ) from None
                err = str(exc).lower()
                if any(
                    k in err for k in ("429", "rate", "overloaded", "timeout", "503")
                ):
                    wait = 2**attempt + 1
                    logger.warning(
                        "teacher retry in {w}s (attempt {a}): {e}",
                        w=wait,
                        a=attempt + 1,
                        e=exc,
                    )
                    time.sleep(wait)
                else:
                    logger.error("teacher call failed (non-retryable): {e}", e=exc)
                    return []
        logger.error("teacher: max retries exceeded")
        return []
