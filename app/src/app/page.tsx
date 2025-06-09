"use client"

import type { components } from "@/types/fastapi"
import { useState } from "react"

type Candidate = components["schemas"]["ScoredCandidate"] & {
	jobTitle: string
}

export default function HomePage() {
	const [jobDescription, setJobDescription] = useState(
		"Seeking GoLang dev (2+ yrs) to write/test backend code, build scalable services, solve complex problems. Must have 5+ yrs experience, good English, team spirit, and strong problem-solving skills.",
	)
	const [loading, setLoading] = useState(false)
	const [error, setError] = useState<string | null>(null)
	const [results, setResults] = useState<Candidate[] | null>(null)

	const handleSubmit = async () => {
		setLoading(true)
		setError(null)
		setResults(null)

		try {
			const res = await fetch("/api/score", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ job_description: jobDescription }),
			})

			if (!res.ok) throw new Error("Failed to fetch scores")

			const data = await res.json()
			setResults(data)
		} catch (err: unknown) {
			if (err instanceof Error) {
				setError(err.message)
			} else {
				setError("Something went wrong")
			}
		} finally {
			setLoading(false)
		}
	}

	return (
		<main className="p-6 max-w-3xl mx-auto">
			<h1 className="text-xl font-bold mb-4">LLM-Powered Candidate Scoring</h1>
			<textarea
				className="w-full border p-2 mb-4"
				maxLength={200}
				rows={5}
				placeholder="Paste the job description here (max 200 characters)"
				value={jobDescription}
				onChange={(e) => setJobDescription(e.target.value)}
			/>
			<button
				type="button"
				onClick={handleSubmit}
				disabled={loading || !jobDescription.trim()}
				className="bg-blue-600 text-white px-4 py-2 rounded disabled:opacity-50"
			>
				{loading ? "Scoring..." : "Generate Ranking"}
			</button>

			{error && <p className="text-red-600 mt-4">{error}</p>}

			{results && (
				<div className="mt-6 space-y-4">
					{results.map((candidate) => (
						<div key={candidate.id} className="border p-4 rounded shadow">
							<h2 className="text-lg font-semibold">
								{candidate.name} ({candidate.score})
							</h2>
							<p className="text-sm text-gray-600 mb-2">{candidate.jobTitle}</p>
							<ul className="list-disc pl-5">
								{candidate.highlights.map((h) => (
									<li key={h}>{h}</li>
								))}
							</ul>
						</div>
					))}
				</div>
			)}
		</main>
	)
}
