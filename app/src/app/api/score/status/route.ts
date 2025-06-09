import { type NextRequest, NextResponse } from "next/server";
import Redis from "ioredis";

const redis = new Redis(process.env.REDIS_URL || "");

export async function GET(req: NextRequest) {
	const { searchParams } = new URL(req.url);
	const jobId = searchParams.get("id");
	if (!jobId) {
		return NextResponse.json({ message: "Missing job id" }, { status: 400 });
	}

	const jobKey = `scorejob:${jobId}`;
	const jobData = await redis.get(jobKey);

	if (!jobData) {
		return NextResponse.json({ status: "pending" }, { status: 200 });
	}

	// jobData should include: { progress, total, results, done }
	return NextResponse.json(JSON.parse(jobData), { status: 200 });
}
