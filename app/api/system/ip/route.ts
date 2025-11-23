import { NextResponse } from "next/server";

export async function GET() {
	try {
		const proxyUrl = process.env.PROXY_URL;
		if (proxyUrl) {
			const url = new URL(proxyUrl);
			// Assuming the proxy IP is the host in the PROXY_URL
			return NextResponse.json({ ip: url.hostname });
		}

		// If no proxy is configured, we can't easily determine the egress IP without making an external request.
		// For now, we'll return null or a message indicating direct connection.
		return NextResponse.json({
			ip: null,
			message: "Direct connection (no proxy configured)",
		});
	} catch (error) {
		console.error("Failed to determine system IP", error);
		return NextResponse.json(
			{ error: "Failed to determine system IP" },
			{ status: 500 },
		);
	}
}
