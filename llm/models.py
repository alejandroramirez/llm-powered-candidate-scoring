from pydantic import BaseModel, constr
from typing import List

class Candidate(BaseModel):
    id: str
    name: str
    resume: str

class ScoreRequest(BaseModel):
    job_description: constr(max_length=200)
    candidates: List[Candidate]

class ScoredCandidate(BaseModel):
    id: str
    name: str
    score: int
    highlights: List[str]
