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

## Challenges Encountered

### Serverless Compatibility

* **No persistent background processes**: Vercel serverless functions terminate after returning a response.
* **Solution**: Moved background logic to `after()` to ensure async processing occurs post-response.
* **Global variables and timers**: Avoided use of `setTimeout` or global state for job orchestration.
* **Execution limits**: Redis is used to persist job state across invocations; the system is designed to work under cold starts and short-lived executions.

### Redis Caching and Sync

* Redis is used to track job progress and cache scoring results.
* TTL was applied to limit stale data, and Redis keys were updated atomically with each processed batch.

## API Score Route Refactor for Serverless Compatibility

The `app/src/app/api/score/route.ts` was refactored to use the Next.js App Router `after` API for Vercel serverless compatibility. The POST handler now immediately returns a response with a job ID and schedules the background scoring job using the `after` function imported from `next/server`. This ensures the background job runs after the response is sent, following the recommended pattern for serverless environments.

The background job fetches candidates, batches them, calls the FastAPI scoring endpoint, and updates the job progress in Redis. Error handling is included to update Redis with error states if the job fails.

This approach replaces the previous "fire and forget" async IIFE pattern, which was incompatible with serverless deployments.

### Batch Processing Delays

* Each LLM scoring batch takes approximately 12 seconds.
* Displaying intermediate results as they arrive was essential for usability.
* Final slicing of the top 30 candidates is deferred to the frontend, which polls Redis periodically.

### LLM Token Limitations

* Only 10 candidates are scored per batch to stay within token limits for GPT-4 variants.

### Prompt Consistency

* The system uses few-shot examples to improve reliability.
* Retry and JSON normalization logic ensures consistent parsing of OpenAI responses.

### Candidate Data Handling

* Raw CSVs are transformed into a single `candidates.json` file at build time.
* Data is flattened and deduplicated; only rows with both question and answer are included.

### Type Integration Between Frontend and Backend

* Types for FastAPI response models are generated using the backend's OpenAPI spec.
* Developers must run `npm run generate:types` in the `app/` directory while the backend is running locally to generate `src/types/fastapi.d.ts`.

### CI Integration

* Both backend and frontend tests run in GitHub Actions.
* Backend: `pytest -sv`
* Frontend: `npm test`

## Deployment Notes

* **Frontend**: Deployed to Vercel
* **Backend**: Deployed to Fly.io
* **CI/CD**: GitHub Actions workflow runs unit tests for both components on push

## Candidate Preprocessing

**Input**: `app/assets/candidates.csv`
**Output**: `app/public/candidates.json`

Frontend Candidate Format:

```ts
interface Candidate {
  id: string;
  name: string;
  jobTitle: string;
  resume: string;
}
```

Backend expects:

```json
{
  "id": "string",
  "name": "string",
  "resume": "string"
}
```

Only non-empty answers are included; the `resume` is a flattened summary of all available fields.