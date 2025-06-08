'use server'

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import type { components } from '@/types/fastapi'

const BACKEND_URL = process.env.LLM_BACKEND_URL || 'http://localhost:8000'

// Simple in-memory cache for 10 minutes per JD
type CacheEntry = {
  data: any
  timestamp: number
}
const CACHE_TTL_MS = 10 * 60 * 1000 // 10 minutes
const jdCache: Map<string, CacheEntry> = new Map()

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
    const jd = validated.job_description

    // Check cache
    const cacheEntry = jdCache.get(jd)
    const now = Date.now()
    if (cacheEntry && now - cacheEntry.timestamp < CACHE_TTL_MS) {
      // Return cached response
      return NextResponse.json(cacheEntry.data, { status: 200 })
    }

    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'

    const candidatesRes = await fetch(`${baseUrl}/candidates.json`)
    if (!candidatesRes.ok) {
      throw new Error('Failed to fetch candidates.json')
    }

    const allCandidates: Candidate[] = await candidatesRes.json()
    const candidates = allCandidates.slice(0, 5)

    const fastApiRes = await fetch(`${BACKEND_URL}/api/score`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        job_description: jd,
        candidates,
      }),
    })

    const data: ScoredCandidate[] = await fastApiRes.json()
    const sorted = [...data].sort((a, b) => b.score - a.score)

    // Cache the result
    jdCache.set(jd, { data: sorted, timestamp: now })

    return NextResponse.json(sorted, { status: fastApiRes.status })
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ message: 'Validation failed', errors: err.errors }, { status: 400 })
    }

    console.error('FastAPI call failed:', err)
    return NextResponse.json({ message: 'Internal Server Error' }, { status: 500 })
  }
}
