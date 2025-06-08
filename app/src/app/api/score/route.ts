'use server'

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import type { components } from '@/types/fastapi'

const BACKEND_URL = process.env.LLM_BACKEND_URL || 'http://localhost:8000'

type ScoreRequest = z.infer<typeof scoreRequestSchema>
type ScoredCandidate = components['schemas']['ScoredCandidate']
type Candidate = components['schemas']['Candidate']

const candidateSchema = z.object({
  id: z.string(),
  name: z.string(),
  resume: z.string(),
})

const scoreRequestSchema = z.object({
  job_description: z.string().max(200),
})

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const validated: ScoreRequest = scoreRequestSchema.parse(body)

    console.log('VERCEL_URL', process.env.VERCEL_URL);

    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'

    let candidatesRes;
    try {
      candidatesRes = await fetch(`${baseUrl}/candidates.json`)
    } catch (err) {
      console.error('Error fetching candidates.json: %o', err)
      return NextResponse.json({ message: err }, { status: 500 })
    }

    // if (!candidatesRes.ok) {
    //   throw new Error('Failed to fetch candidates.json')
    // }

    const allCandidates: Candidate[] = await candidatesRes.json()
    const candidates = allCandidates.slice(0, 10)

    let fastApiRes;
    try{
      fastApiRes = await fetch(`${BACKEND_URL}/api/score`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
          job_description: validated.job_description,
          candidates,
        }),
      })
    } catch (err) {
      console.error('Error calling FastAPI:', err)
      return NextResponse.json({ message: `Failed to call scoring backend ${BACKEND_URL}/api/score` }, { status: 500 })
    }

    const json = await fastApiRes.json()

    // show the raw response for debugging
    console.log('FastAPI response:', json)
    if (!fastApiRes.ok) {
      console.error('FastAPI call failed with status:', fastApiRes.status, 'Response:', json)
      return NextResponse.json({ message: `Scoring backend returned error: ${fastApiRes.status}` }, { status: fastApiRes.status })
    }

    if (!Array.isArray(json)) {
      console.error('Expected an array but got:', json)
      return NextResponse.json({ message: 'Invalid response from scoring backend' }, { status: 500 })
    }

    const sorted = [...json].sort((a, b) => b.score - a.score)

    return NextResponse.json(sorted, { status: fastApiRes.status })
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ message: 'Validation failed', errors: err.errors }, { status: 400 })
    }

    console.error('FastAPI call failed:', err)
    return NextResponse.json({ message: 'Internal Server Error' }, { status: 500 })
  }
}
