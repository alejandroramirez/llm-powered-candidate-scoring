# Technical Report: LLM-Powered Candidate Scoring System

## API Score Route Refactor for Serverless Compatibility

The `app/src/app/api/score/route.ts` was refactored to use the Next.js App Router `after` API to ensure compatibility with Vercel's serverless architecture. The previous approach relied on a "fire and forget" async IIFE to initiate background jobs, which is not supported in serverless environments.

The new implementation schedules background scoring logic using `after()` from `next/server`, allowing the response to be returned immediately while the batch job proceeds in the background. The process includes fetching and batching candidate data, sending requests to the FastAPI backend for scoring, and updating Redis with progress and results.

This change ensures compatibility with serverless deployments and improves reliability.

## Architecture Overview

This project consists of two major components:

1. **Frontend (Next.js 15)**
   * Accepts job descriptions from users.
   * Loads and filters preprocessed candidate data.
   * Sends candidates in batches to the backend for scoring.
   * Displays ranked results (top 30).

2. **Backend (FastAPI + OpenAI)**
   * Accepts job descriptions and candidate data.
   * Constructs a few-shot prompt using preloaded examples and context.
   * Sends prompt to OpenAI for scoring.
   * Parses the result and returns a list of scored candidates.

```
User → [Next.js API Route] → [FastAPI] → [OpenAI]
                ↑
        [candidates.json]
```

## Prompt Design

**System Message**
Loaded from `llm/prompts/system.txt`. Example:

```
You are a recruiter assistant evaluating candidates for a job.
Return a JSON array with id, name, score (0–100), and 2–3 bullet-point highlights.
Only return JSON.
```

**User Message**
Includes the job description followed by a batch of 10 candidate summaries.

**Expected Output Format**

```json
[
  {
    "id": "abc123",
    "name": "John Doe",
    "score": 87,
    "highlights": ["Experience with Go", "Worked in a startup"]
  }
]
```

## Requirements Coverage Table

| Requirement                                           | Status   |
|-------------------------------------------------------|----------|
| Submit job description                                | Covered  |
| Score candidates using OpenAI                         | Covered  |
| Display ranked list of top 30 candidates              | Covered  |
| Batch processing (10 per request)                     | Covered  |
| Cache progress and results using Redis                | Covered  |
| Show scoring progress while results arrive            | Covered  |
| Store frontend candidate data in JSON format          | Covered  |
| Integrate backend types via OpenAPI schema            | Covered  |
| Provide CI pipeline for both frontend and backend     | Covered  |
| Serverless compatibility for all routes               | Covered  |
| Rate limiting for calls to the api/score endpoint     | Covered  |

## Challenges Encountered

### Serverless Compatibility
* Vercel functions terminate after response.
* Used `after()` for background job orchestration.
* Avoided timers/global state.
* Redis used for state management.

### Redis Caching and Sync
* Atomic Redis key updates per batch.
* TTLs applied to prevent stale data.

### Batch Processing Delays
* Each batch takes ~12s.
* Redis updated incrementally.
* Frontend slices and shows top 30 only.

### LLM Token Limitations
* Max 10 candidates per prompt.

### Prompt Consistency
* Few-shot examples and strict JSON format.
* Fallback retry logic on invalid responses.

### Candidate Data Handling
* CSV normalized into `candidates.json` at build time.
* Deduplicated and filtered rows with empty answers excluded.

### Type Integration Between Frontend and Backend
* OpenAPI-based type generation.
* Requires backend running locally to fetch schema.

### CI Integration
* GitHub Actions for both parts.
* FastAPI tests with `pytest -sv`
* Frontend with `npm test`

## Deployment Notes

* **Frontend**: Vercel
* **Backend**: Fly.io
* **Redis**: Upstash
* **CI/CD**: GitHub Actions

## Candidate Preprocessing

**Input**: `app/assets/candidates.csv`
**Output**: `app/public/candidates.json`

Frontend:
```ts
interface Candidate {
  id: string;
  name: string;
  jobTitle: string;
  resume: string;
}
```

Backend:
```json
{
  "id": "string",
  "name": "string",
  "resume": "string"
}
```

`resume` is built from all non-empty fields including Q&A where both are present.
