import logging
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from typing import List

from models import Candidate, ScoreRequest, ScoredCandidate
from prompt_manager import score_candidates as llm_score_candidates

logging.basicConfig(
    level=logging.DEBUG,
    format="%(levelname)s:%(name)s: %(message)s"
)

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ------------------
# Routes
# ------------------

@app.get("/")
def read_root():
    return {"message": "Welcome to the Candidate Scoring API"}

@app.get("/healthz")
def healthz():
    return {"status": "ok"}

@app.post("/api/score", response_model=List[ScoredCandidate])
async def score_candidates_api(payload: ScoreRequest):
    try:
        return await llm_score_candidates(payload.job_description, payload.candidates)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
