"use server";

import { randomUUID } from "node:crypto";
import type { components } from "@/types/fastapi";
import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";

const BACKEND_URL = process.env.LLM_BACKEND_URL || "http://localhost:8000";

import Redis from "ioredis";
const CACHE_TTL_SECONDS = 600; // 10 minutes

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
		const body = await req.json();
		const validated: ScoreRequest = scoreRequestSchema.parse(body);
		const jd = validated.job_description;

		const jobId = randomUUID();
		const jobKey = `scorejob:${jobId}`;

		// Store initial job state in Redis
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

		// Fire and forget async job
		(async () => {
			try {
				const baseUrl =
					process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";
				const candidatesRes = await fetch(`${baseUrl}/candidates.json`);
				if (!candidatesRes.ok) {
					throw new Error("Failed to fetch candidates.json");
				}

				const allCandidates: Candidate[] = await candidatesRes.json();
				const batchSize = 10;
				const total = allCandidates.length;
				let processed = 0;
				let allResults: ScoredCandidate[] = [];

				for (let i = 0; i < total; i += batchSize) {
					const batch = allCandidates.slice(i, i + batchSize);

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

					const batchResults: ScoredCandidate[] = await fastApiRes.json();
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
						CACHE_TTL_SECONDS,
					);
				}

				const finalSorted = [...allResults].sort((a, b) => b.score - a.score);

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
					CACHE_TTL_SECONDS,
				);
			}
		})();

		return NextResponse.json({ jobId }, { status: 202 });
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
