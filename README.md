# LLM-Powered Candidate Scoring System

This project enables recruiters to submit a job description and receive a scored list of candidates powered by an LLM (OpenAI) via a FastAPI backend. The frontend is built with Next.js 15 and deployed to Vercel, while the backend is deployed to Fly.io.

![CI](https://github.com/alejandroramirez/llm-powered-candidate-scoring/actions/workflows/ci.yml/badge.svg)

---

## 📁 Project Structure

```
.
├── README.md
├── TECHNICAL_REPORT.md
├── .github/
│   └── workflows/
│       └── ci.yml
├── app/
│   ├── package.json
│   ├── tsconfig.json
│   ├── README.md
│   ├── assets/
│   ├── public/
│   ├── scripts/
│   └── src/
├── llm/
│   ├── main.py
│   ├── models.py
│   ├── requirements.txt
│   ├── prompt_manager.py
│   ├── test_main.py
│   └── prompts/
```

---

## 🛠 Setup

### 1. Install Dependencies

```bash
cd app
npm install
```

### 2. Preprocess Candidate Data

This runs automatically on build, but you can run it manually:

```bash
npm run prepare:candidates
```

This reads `assets/candidates.csv`, normalizes and deduplicates entries, and generates `public/candidates.json`.

### 3. Generate API Types from FastAPI Spec

To keep your frontend in sync with the backend’s OpenAPI schema, you can generate TypeScript types:

```bash
# Make sure the FastAPI server is running at http://localhost:8000
cd app
npm run generate:types
```

This will create the file:

```
app/src/types/fastapi.d.ts
```

---

## 🚀 Running Locally

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

Make sure the FastAPI backend is running at `http://localhost:8000`.

---

## 🌐 Environment Variables

### Backend: `llm/.env`

```env
LLM_API_KEY=your_openai_key
LLM_BACKEND_MODEL=gpt-4.1-nano
```

### Frontend: `app/.env.local`

```env
LLM_BACKEND_URL=http://localhost:8000
REDIS_URL=redis://localhost:6379
```

---

## 🧪 Testing

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

Tests are automatically run on push via GitHub Actions.

---

## 🔍 Candidate Format

The preprocessed `candidates.json` file contains:

```ts
interface Candidate {
  id: string;
  name: string;
  jobTitle: string;
  resume: string; // Flattened summary of all fields
}
```

---

## ⚙️ Built With

* FastAPI (Python 3.11)
* OpenAI (via `openai.AsyncOpenAI`)
* Next.js 15 (React, TypeScript)
* Tailwind CSS
* Redis (caching)
* GitHub Actions (CI/CD)
* Pytest (backend)
* Vitest or Jest (frontend)

---

## 📦 Deployment

* **Frontend &**: Deployed on Vercel
* **Backend**: Deployed on Fly.io
* **Redis**: Upstage via Vercel
* **LLM**: OpenAI API (gpt-4.1-nano)
* **CI/CD**: GitHub Actions
