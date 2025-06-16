"use server";

import { randomUUID } from "node:crypto";
import crypto from "node:crypto";
import type { components } from "@/types/fastapi";
import { type NextRequest, NextResponse, after } from "next/server";
import { z } from "zod";

const BACKEND_URL = process.env.LLM_BACKEND_URL || "http://localhost:8000";

import Redis from "ioredis";
const CACHE_TTL_SECONDS = 1200; // 20 minutes
const JOB_TTL_SECONDS = 3600; // 1 hour

const redis = new Redis(process.env.REDIS_URL || "");

type ScoreRequest = z.infer<typeof scoreRequestSchema>;
type ScoredCandidate = components["schemas"]["ScoredCandidate"];
type Candidate = components["schemas"]["Candidate"];

const candidateSchema = z.object({
	id: z.string(),
	name: z.string(),
	resume: z.string(),
});

const scoreRequestSchema = z.object({
	job_description: z.string().max(200),
});

export async function POST(req: NextRequest) {
	try {
		// Extract client IP from headers or fallback to "unknown"
		const clientIp =
			req.headers.get("x-forwarded-for")?.split(",")[0].trim() ||
			req.headers.get("x-real-ip") ||
			"unknown";

		// Check last request time from Redis
		const lastRequestKey = `ratelimit:${clientIp}`;
		const lastRequest = await redis.get(lastRequestKey);
		const now = Date.now();

		if (lastRequest) {
			const lastRequestTime = Number.parseInt(lastRequest, 10);
			if (now - lastRequestTime < 3000) {
				// Less than 3 seconds since last request, return 429
				return NextResponse.json(
					{
						message:
							"Too many requests. Please wait 3 seconds between requests.",
					},
					{ status: 429 },
				);
			}
		}

		// Update last request time
		await redis.set(lastRequestKey, now.toString(), "EX", 10);

		const body = await req.json();
		const validated: ScoreRequest = scoreRequestSchema.parse(body);
		const jd = validated.job_description;

		const jobId = randomUUID();
		const jobKey = `scorejob:${jobId}`;

		// Fetch all candidates early to check cache
		const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";
		const candidatesRes = await fetch(`${baseUrl}/candidates.json`);
		if (!candidatesRes.ok) {
			throw new Error("Failed to fetch candidates.json");
		}
		const allCandidates: Candidate[] = await candidatesRes.json();

		// Create full cache key for all candidates and job description
		const batchIds = allCandidates.map((c) => c.id).join(",");
		const fullCacheKey = `fastapi_cache:${crypto
			.createHash("sha256")
			.update(jd + batchIds)
			.digest("hex")}`;

		// Check if full result is cached
		const fullCached = await redis.get(fullCacheKey);

		if (fullCached) {
			// If cached, set job state immediately with full results and done=true
			const cachedResults: ScoredCandidate[] = JSON.parse(fullCached);
			await redis.set(
				jobKey,
				JSON.stringify({
					progress: allCandidates.length,
					total: allCandidates.length,
					results: cachedResults,
					done: true,
				}),
				"EX",
				CACHE_TTL_SECONDS,
			);

			const response = NextResponse.json({ jobId }, { status: 202 });
			return response;
		}

		// If not cached, store initial empty job state
		await redis.set(
			jobKey,
			JSON.stringify({
				progress: 0,
				total: 0,
				results: [],
				done: false,
			}),
			"EX",
			CACHE_TTL_SECONDS,
		);

		const response = NextResponse.json({ jobId }, { status: 202 });

		// Schedule the background job after the response is sent
		after(async () => {
			try {
				const batchSize = 10;
				const total = allCandidates.length;
				let processed = 0;
				let allResults: ScoredCandidate[] = [];

				for (let i = 0; i < total; i += batchSize) {
					const batch = allCandidates.slice(i, i + batchSize);

					// Create a cache key based on job description and batch candidate IDs
					const batchIds = batch.map((c) => c.id).join(",");
					const cacheKey = `fastapi_cache:${crypto
						.createHash("sha256")
						.update(jd + batchIds)
						.digest("hex")}`;

					// Try to get cached result from Redis
					const cached = await redis.get(cacheKey);
					let batchResults: ScoredCandidate[];

					if (cached) {
						batchResults = JSON.parse(cached);
					} else {
						const fastApiRes = await fetch(`${BACKEND_URL}/api/score`, {
							method: "POST",
							headers: { "Content-Type": "application/json" },
							body: JSON.stringify({
								job_description: jd,
								candidates: batch,
							}),
						});

						if (!fastApiRes.ok) {
							throw new Error("FastAPI scoring failed");
						}

						batchResults = await fastApiRes.json();

						// Cache the result in Redis
						await redis.set(
							cacheKey,
							JSON.stringify(batchResults),
							"EX",
							CACHE_TTL_SECONDS,
						);
					}

					allResults = allResults.concat(batchResults);
					processed += batch.length;

					const sorted = [...allResults].sort((a, b) => b.score - a.score);

					// Update job state in Redis
					await redis.set(
						jobKey,
						JSON.stringify({
							progress: processed,
							total,
							results: sorted,
							done: false,
						}),
						"EX",
						JOB_TTL_SECONDS,
					);
				}

				const finalSorted = [...allResults].sort((a, b) => b.score - a.score);

				// Cache the full result for future requests
				await redis.set(
					fullCacheKey,
					JSON.stringify(finalSorted),
					"EX",
					CACHE_TTL_SECONDS,
				);

				await redis.set(
					jobKey,
					JSON.stringify({
						progress: total,
						total,
						results: finalSorted,
						done: true,
					}),
					"EX",
					CACHE_TTL_SECONDS,
				);
			} catch (err) {
				await redis.set(
					jobKey,
					JSON.stringify({
						progress: 0,
						total: 0,
						results: [],
						done: true,
						error: err instanceof Error ? err.message : "Unknown error",
					}),
					"EX",
					JOB_TTL_SECONDS,
				);
			}
		});

		return response;
	} catch (err) {
		if (err instanceof z.ZodError) {
			return NextResponse.json(
				{ message: "Validation failed", errors: err.errors },
				{ status: 400 },
			);
		}

		console.error("FastAPI call failed:", err);
		return NextResponse.json(
			{ message: "Internal Server Error" },
			{ status: 500 },
		);
	}
}

export async function DELETE(req: NextRequest) {
	try {
		const { searchParams } = new URL(req.url);
		const jobId = searchParams.get("id");
		if (!jobId) {
			return NextResponse.json({ message: "Missing job id" }, { status: 400 });
		}

		const jobKey = `scorejob:${jobId}`;
		const deleted = await redis.del(jobKey);

		if (deleted === 1) {
			return NextResponse.json({ message: "Job cancelled" }, { status: 200 });
		}
		return NextResponse.json(
			{ message: "Job not found or already completed" },
			{ status: 404 },
		);
	} catch (err) {
		console.error("Failed to cancel job:", err);
		return NextResponse.json(
			{ message: "Internal Server Error" },
			{ status: 500 },
		);
	}
}
