"use client";

import type { components } from "@/types/fastapi";
import { useState, useRef } from "react";

type Candidate = components["schemas"]["ScoredCandidate"] & {
	jobTitle: string;
};

export default function HomePage() {
	const [jobDescription, setJobDescription] = useState("");
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [results, setResults] = useState<Candidate[]>([]);
	const [progress, setProgress] = useState(0);
	const [total, setTotal] = useState(0);
	const [jobId, setJobId] = useState<string | null>(null);
	const pollingRef = useRef<NodeJS.Timeout | null>(null);

	const handleSubmit = async () => {
		setLoading(true);
		setError(null);
		setResults([]);
		setProgress(0);
		setTotal(0);

		try {
			const res = await fetch("/api/score", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ job_description: jobDescription }),
			});

			if (res.status === 429) {
				setError("Too many requests. Please wait 3 seconds between requests.");
				setLoading(false);
				return;
			}

			if (!res.ok) throw new Error("Failed to start scoring job");

			const { jobId } = await res.json();
			if (!jobId) throw new Error("No jobId returned from server");

			setJobId(jobId);

			// Start polling for status
			const poll = async () => {
				try {
					const statusRes = await fetch(`/api/score/status?id=${jobId}`);
					if (!statusRes.ok) throw new Error("Failed to fetch job status");
					const status = await statusRes.json();

					setProgress(status.progress || 0);
					setTotal(status.total || 0);
					setResults(status.results || []);

					if (status.done) {
						setLoading(false);
						if (pollingRef.current) clearInterval(pollingRef.current);
						setJobId(null);
					}
				} catch (err) {
					setError("Error polling job status");
					setLoading(false);
					if (pollingRef.current) clearInterval(pollingRef.current);
					setJobId(null);
				}
			};

			// Poll every 2 seconds
			pollingRef.current = setInterval(poll, 2000);
			// Also poll immediately for fast jobs
			poll();
		} catch (err: unknown) {
			if (err instanceof Error) {
				setError(err.message);
			} else {
				setError("Something went wrong");
			}
			setLoading(false);
		}
	};

	const handleCancel = async () => {
		if (!jobId) return;
		try {
			const res = await fetch(`/api/score?id=${jobId}`, {
				method: "DELETE",
			});
			if (!res.ok) throw new Error("Failed to cancel job");
			setLoading(false);
			setJobId(null);
			setProgress(0);
			setTotal(0);
			setResults([]);
		} catch (err) {
			if (err instanceof Error) {
				setError(err.message);
			} else {
				setError("Something went wrong");
			}
		}
		if (pollingRef.current) clearInterval(pollingRef.current);
	};

	return (
		<main className="p-6 max-w-3xl mx-auto">
			<h1 className="text-xl font-bold mb-4">LLM-Powered Candidate Scoring</h1>
			{/* Sample JD Buttons */}
			<div className="flex flex-wrap gap-2 mb-4">
				<button
					type="button"
					className="bg-gray-200 hover:bg-gray-300 text-gray-800 px-3 py-1 rounded"
					onClick={() =>
						setJobDescription(
							"Seeking GoLang dev (2+ yrs) to write/test backend code, build scalable services, solve complex problems. Must have 5+ yrs experience, good English, team spirit, and strong problem-solving skills.",
						)
					}
					disabled={loading}
				>
					Sample GoLang JD
				</button>
				<button
					type="button"
					className="bg-gray-200 hover:bg-gray-300 text-gray-800 px-3 py-1 rounded"
					onClick={() =>
						setJobDescription(
							"Hiring iOS developer (Swift, 2+ yrs) to build and maintain mobile apps. Must have 4+ yrs experience, strong UI/UX skills, teamwork, English proficiency, and problem-solving ability.",
						)
					}
					disabled={loading}
				>
					Sample iOS JD
				</button>
				<button
					type="button"
					className="bg-gray-200 hover:bg-gray-300 text-gray-800 px-3 py-1 rounded"
					onClick={() =>
						setJobDescription(
							"React developer needed (2+ yrs) for building modern web apps. Must have 4+ yrs experience, strong JavaScript/TypeScript, teamwork, English skills, and excellent problem-solving ability.",
						)
					}
					disabled={loading}
				>
					Sample React JD
				</button>
				<button
					type="button"
					className="bg-gray-100 hover:bg-gray-200 text-gray-800 px-3 py-1 rounded border"
					onClick={() => setJobDescription("")}
					disabled={loading}
				>
					x clear JD
				</button>
			</div>
			<textarea
				className="w-full border p-2 mb-4"
				maxLength={200}
				rows={5}
				placeholder="Paste the job description here (max 200 characters)"
				value={jobDescription}
				onChange={(e) => setJobDescription(e.target.value)}
				disabled={loading}
			/>
			<p className="text-sm text-gray-500 mb-2">
				{200 - jobDescription.length} characters left
			</p>
			<div className="flex space-x-2 mb-4">
				<button
					type="button"
					onClick={handleSubmit}
					disabled={loading || !jobDescription.trim()}
					className="bg-blue-600 text-white px-4 py-2 rounded disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed"
				>
					{loading ? (
						<span className="flex items-center gap-2">
							<svg
								className="animate-spin h-5 w-5 text-white"
								xmlns="http://www.w3.org/2000/svg"
								fill="none"
								viewBox="0 0 24 24"
							>
								<title>Loading</title>
								<circle
									className="opacity-25"
									cx="12"
									cy="12"
									r="10"
									stroke="currentColor"
									strokeWidth="4"
								/>
								<path
									className="opacity-75"
									fill="currentColor"
									d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
								/>
							</svg>
							Scoring...
						</span>
					) : (
						"Generate Ranking"
					)}
				</button>
				{loading && jobId && (
					<button
						type="button"
						onClick={handleCancel}
						className="bg-red-600 text-white px-4 py-2 rounded cursor-pointer"
					>
						Cancel
					</button>
				)}
			</div>

			{error && <p className="text-red-600 mt-4">{error}</p>}

			{loading && total > 0 && (
				<div className="mt-4">
					<div className="w-full bg-gray-200 rounded h-4">
						<div
							className="bg-blue-600 h-4 rounded"
							style={{ width: `${Math.round((progress / total) * 100)}%` }}
						/>
					</div>
					<p className="text-sm mt-1">
						{progress} of {total} candidates scored
					</p>
				</div>
			)}

			{results.length > 0 && (
				<div className="mt-6 space-y-4">
					{results.slice(0, 30).map((candidate) => (
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
	);
}
