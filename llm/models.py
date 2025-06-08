from pydantic import BaseModel
from typing import List

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
