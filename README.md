# LLM-Powered Candidate Scoring System

This project enables recruiters to input a job description and receive a ranked list of candidates scored by an LLM via a FastAPI backend. The frontend is built with Next.js 15 and deployed to Vercel; the backend is deployed to Fly.io.

![CI](https://github.com/alejandroramirez/llm-powered-candidate-scoring/actions/workflows/ci.yml/badge.svg)

## Project Structure

```
.
├── README.md
├── TECHNICAL_REPORT.md
├── .github/workflows/ci.yml
├── app/                  # Next.js 15 frontend
│   ├── src/
│   ├── public/
│   ├── assets/
│   ├── scripts/
│   ├── package.json
├── llm/                  # FastAPI backend
│   ├── main.py
│   ├── models.py
│   ├── prompt_manager.py
│   ├── requirements.txt
│   ├── test_main.py
│   └── prompts/
```

## Setup

### Install Dependencies

```bash
cd app
npm install
```

### Preprocess Candidate Data

This is done automatically at build time. To run manually:

```bash
npm run prepare:candidates
```

Reads `assets/candidates.csv`, deduplicates entries, and writes to `public/candidates.json`.

### Generate FastAPI Types

Ensure the backend is running (`http://localhost:8000`), then:

```bash
cd app
npm run generate:types
```

Output: `app/src/types/fastapi.d.ts`

## Running Locally

### Backend (FastAPI)

```bash
cd llm
python -m venv venv && source venv/bin/activate
pip install -r requirements.txt
fastapi dev
```

### Frontend (Next.js)

```bash
cd app
npm run dev
```

Ensure FastAPI is running at `http://localhost:8000`.

## Environment Variables

### Backend (`llm/.env`)

```env
LLM_API_KEY=your_openai_key
LLM_BACKEND_MODEL=gpt-4.1-nano
```

### Frontend (`app/.env.local`)

```env
LLM_BACKEND_URL=http://localhost:8000
REDIS_URL=redis://localhost:6379
```

## Testing

### Backend

```bash
cd llm
pytest -sv
```

### Frontend

```bash
cd app
npm test
```

CI runs on push via GitHub Actions.

## Candidate Format

`candidates.json` contains:

```ts
interface Candidate {
  id: string;
  name: string;
  jobTitle: string;
  resume: string;
}
```

Used to drive scoring and UI display. `resume` is a flattened summary of all structured fields.

## Stack

* **Frontend**: Next.js 15, TypeScript, Tailwind CSS
* **Backend**: FastAPI, Python 3.11
* **LLM**: OpenAI (gpt-4.1-nano)
* **Infra**: Redis (caching), GitHub Actions (CI)
* **Testing**: Pytest (backend), Vitest/Jest (frontend)

## Deployment

* **Frontend**: Vercel
* **Backend**: Fly.io
* **Redis**: Upstash Redis (used via Vercel)
* **CI/CD**: GitHub Actions