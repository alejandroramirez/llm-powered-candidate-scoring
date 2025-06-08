# Technical Report: LLM-Powered Candidate Scoring System

## 🧭 Architecture Overview

This project is composed of two main parts:

1. **Frontend & API Layer (Next.js 15)**

   * Accepts job description from the user
   * Loads preprocessed candidate data
   * Sends batches of 10 candidates to the backend for scoring
   * Displays ranked results

2. **Backend Scoring API (FastAPI + OpenAI)**

   * Receives job description and candidates
   * Constructs a prompt with few-shot examples (loaded from [`prompts/fewshot.json`](llm/prompts/fewshot.json))
   * Sends prompt to OpenAI API (model configurable via `LLM_BACKEND_MODEL` environment variable, default: gpt-4.1-nano)
   * Parses JSON response
   * Returns list of scored candidates

```
User → [Next.js API Route] → [FastAPI] → [OpenAI]
                                  ↑
                       [candidates.json]
```

---

## 📐 Prompt Design

* **System Message**:

  - Loaded from [`prompts/system.txt`](llm/prompts/system.txt)
  - Example:
    ```
    You are a recruiter assistant evaluating candidates for a job.
    Return a JSON array with id, name, score (0–100), and 2–3 bullet-point highlights.
    Only return JSON.
    ```

* **User Message**:

  * Includes the job description
  * Appends a list of 10 candidates, each with id, name, resume

* **Output Format Expected**:

  ```json
  [
    {
      "id": "abc123",
      "name": "John Doe",
      "score": 87,
      "highlights": ["Experience with Go", "Worked in a startup"]
    }
    // ...more candidates
  ]
  ```

---

## 🔧 Challenges and Solutions

### 1. **Token Limits in LLM**

* Batching is limited to 10 candidates to stay under GPT-4 context window

### 2. **Non-Deterministic Output**

* Few-shot prompting and clear JSON expectations reduce hallucinations
* Added retry logic for malformed JSON parsing

### 3. **Storage Constraints in Next.js**

* Used build-time CSV parsing to avoid runtime file writes
* Cleaned and deduplicated candidate data is stored in `public/candidates.json`

### 4. **Environment Configuration**

* `.env.local` is used to inject API key, backend URL, and model

---

## ✅ Deployment Notes

* **Frontend (Next.js)** can be deployed on Vercel
* **Backend (FastAPI)** should be deployed to a serverless Python-capable host (Render, Fly.io, etc.)

---

## 📦 Candidate Preprocessing

* Input: `candidates.csv`
* Output: `candidates.json` containing:

```ts
interface Candidate {
  id: string;
  name: string;
  jobTitle: string; // Present in frontend data only
  resume: string;
}

// Backend API Candidate model (llm/models.py):
// {
//   id: string;
//   name: string;
//   resume: string;
// }
```

`resume` is a flattened string built from all fields (questions included only if both Q + A are present).

