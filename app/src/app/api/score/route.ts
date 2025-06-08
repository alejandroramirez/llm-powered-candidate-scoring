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

    const baseUrl =
      process.env.VERCEL_URL
        ? `https://${process.env.VERCEL_URL}`
        : process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'

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

    const fastApiRes = await fetch(`${BACKEND_URL}/api/score`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        job_description: validated.job_description,
        candidates,
      }),
    })

    const data: ScoredCandidate[] = await fastApiRes.json()
    const sorted = [...data].sort((a, b) => b.score - a.score)

    return NextResponse.json(sorted, { status: fastApiRes.status })
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ message: 'Validation failed', errors: err.errors }, { status: 400 })
    }

    console.error('FastAPI call failed:', err)
    return NextResponse.json({ message: 'Internal Server Error' }, { status: 500 })
  }
}
