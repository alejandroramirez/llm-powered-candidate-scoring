from typing import List
from dotenv import load_dotenv
from openai import AsyncOpenAI
import os
import logging
import json
from pathlib import Path

from tenacity import retry, stop_after_attempt, wait_exponential
from models import Candidate, ScoredCandidate

load_dotenv()

logger = logging.getLogger("prompt_manager")

client = AsyncOpenAI(api_key=os.getenv("LLM_API_KEY"))

logger = logging.getLogger(__name__)

# Paths
PROMPTS_DIR = Path(__file__).parent / "prompts"
SYSTEM_PROMPT_PATH = PROMPTS_DIR / "system.txt"
FEWSHOT_PATH = PROMPTS_DIR / "fewshot.json"

# Load system prompt from file
SYSTEM_PROMPT = SYSTEM_PROMPT_PATH.read_text(encoding="utf-8")

# Load few-shot examples from file
FEW_SHOT_EXAMPLES = json.loads(FEWSHOT_PATH.read_text(encoding="utf-8"))

@retry(stop=stop_after_attempt(3), wait=wait_exponential(multiplier=1, min=2, max=10))
async def score_candidates(job_description: str, candidates: List[Candidate]) -> List[ScoredCandidate]:
    import time
    t0 = time.perf_counter()
    logger.debug("score_candidates: started")

    prompt = {
        "role": "user",
        "content": json.dumps({
            "job_description": job_description,
            "candidates": [c.model_dump() for c in candidates]
        }, indent=2)
    }

    messages = [
        {"role": "system", "content": SYSTEM_PROMPT},
        *FEW_SHOT_EXAMPLES,
        prompt
    ]

    t1 = time.perf_counter()
    logger.debug(f"score_candidates: prompt/messages prepared in {t1 - t0:.4f}s")

    try:
        t2 = time.perf_counter()
        logger.debug("score_candidates: calling OpenAI API")
        response = await client.chat.completions.create(
            model=os.getenv("LLM_BACKEND_MODEL", "gpt-4.1-nano"),
            messages=messages,
            temperature=0.3
        )
        t3 = time.perf_counter()
        logger.debug(f"score_candidates: OpenAI API call took {t3 - t2:.4f}s")

        raw = response.choices[0].message.content.strip()
        parsed = json.loads(raw)
        t4 = time.perf_counter()
        logger.debug(f"score_candidates: response parsing took {t4 - t3:.4f}s")
        logger.debug(f"score_candidates: total time {t4 - t0:.4f}s")

        return [ScoredCandidate(**c) for c in parsed]

    except Exception as e:
        logger.error("LLM call failed: %s", e)
        raise
