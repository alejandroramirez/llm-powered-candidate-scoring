# LLM-Powered Candidate Scoring System

This project allows recruiters to submit a job description and receive a ranked list of top candidates based on a preloaded database, scored using an LLM via a FastAPI backend.

---

## 📁 Project Structure

```
/llm-api          → FastAPI backend for LLM scoring
/app              → Next.js frontend and API
  ├── /public     → Contains preprocessed candidates.json
  ├── /assets     → Raw CSV candidate data
  └── /scripts    → Build-time processing script
```

---

## 🛠 Setup

### 1. Install Dependencies

```bash
npm install
```

### 2. Preprocess Candidate Data

This happens automatically on build, but you can also run it manually:

```bash
npm run prepare:candidates
```

This reads `assets/candidates.csv`, normalizes and deduplicates entries, and outputs `public/candidates.json`.

### 3. Build Frontend

```bash
npm run build
```

To preview output before building:

```bash
npm run preview:candidates
```

---

## 🌐 Running Locally

### FastAPI Backend (required for scoring)

```bash
cd llm-api
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

### Next.js App

```bash
cd app
npm run dev
```

Make sure the FastAPI backend is running at `http://localhost:8000`.

---

## 🌟 Environment Variables

Create a `.env.local` file in `/app`:

```env
LLM_BACKEND_URL=http://localhost:8000
```

---

## 🧪 Testing

TBD – add Jest tests for prompt construction, parsing, and API integration.

---

## 🔍 Candidate Format

The preprocessed candidate file (`candidates.json`) contains objects with:

```ts
interface Candidate {
  id: string;
  name: string;
  jobTitle: string;
  resume: string; // Flattened summary of all fields
}
```

---

## 🧱 Built With

* Next.js 15 (TypeScript)
* FastAPI (Python)
* OpenAI (LLM Scoring)
* CSV + HTML cleaning utilities

---

## 📦 Deployment

* Frontend can be deployed on Vercel
* FastAPI backend must be deployed separately (e.g. Render, Fly.io)

---

## 📄 License

MIT
