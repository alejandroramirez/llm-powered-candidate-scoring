from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from typing import List

from fastapi.middleware.cors import CORSMiddleware

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],  # or ["*"] for all
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ------------------
# Data Models
# ------------------

class Candidate(BaseModel):
    id: str
    name: str
    resume: str

class ScoreRequest(BaseModel):
    job_description: str
    candidates: List[Candidate]

class ScoredCandidate(BaseModel):
    id: str
    name: str
    score: int
    highlights: List[str]

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
def score_candidates(payload: ScoreRequest):
    # Placeholder scoring logic (to be replaced with LLM integration)
    dummy_results = [
        ScoredCandidate(
            id=c.id,
            name=c.name,
            score=80 + i % 10,
            highlights=["Example highlight"]
        ) for i, c in enumerate(payload.candidates[:30])
    ]
    return dummy_results
