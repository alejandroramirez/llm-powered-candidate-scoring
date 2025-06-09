"use server"

import type { components } from "@/types/fastapi"
import { type NextRequest, NextResponse } from "next/server"
import { z } from "zod"

const BACKEND_URL = process.env.LLM_BACKEND_URL || "http://localhost:8000"

import Redis from "ioredis"
const CACHE_TTL_SECONDS = 600 // 10 minutes

const redis = new Redis(process.env.REDIS_URL || "")

type ScoreRequest = z.infer<typeof scoreRequestSchema>
type ScoredCandidate = components["schemas"]["ScoredCandidate"]
type Candidate = components["schemas"]["Candidate"]

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

		// Use JD as cache key (can hash if needed, but JD is short)
		const cacheKey = `score:${jd}`

		// Check Redis cache
		const cached = await redis.get(cacheKey)
		if (cached) {
			// Redis stores strings, so parse the JSON
			return NextResponse.json(JSON.parse(cached), { status: 200 })
		}

		const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000"

		const candidatesRes = await fetch(`${baseUrl}/candidates.json`)
		if (!candidatesRes.ok) {
			throw new Error("Failed to fetch candidates.json")
		}

		const allCandidates: Candidate[] = await candidatesRes.json()
		const candidates = allCandidates.slice(0, 5)

		const fastApiRes = await fetch(`${BACKEND_URL}/api/score`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				job_description: jd,
				candidates,
			}),
		})

		const data: ScoredCandidate[] = await fastApiRes.json()
		const sorted = [...data].sort((a, b) => b.score - a.score)

		// Cache the result in Redis for 10 minutes
		await redis.set(cacheKey, JSON.stringify(sorted), "EX", CACHE_TTL_SECONDS)

		return NextResponse.json(sorted, { status: fastApiRes.status })
	} catch (err) {
		if (err instanceof z.ZodError) {
			return NextResponse.json(
				{ message: "Validation failed", errors: err.errors },
				{ status: 400 },
			)
		}

		console.error("FastAPI call failed:", err)
		return NextResponse.json(
			{ message: "Internal Server Error" },
			{ status: 500 },
		)
	}
}
