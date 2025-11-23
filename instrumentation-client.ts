import posthog from "posthog-js";

function initPosthog() {
	if (!process.env.NEXT_PUBLIC_POSTHOG_KEY) {
		throw new Error("NEXT_PUBLIC_POSTHOG_KEY is not set");
	}

	if (!process.env.NEXT_PUBLIC_POSTHOG_HOST) {
		throw new Error("NEXT_PUBLIC_POSTHOG_HOST is not set");
	}

	posthog.init(process.env.NEXT_PUBLIC_POSTHOG_KEY, {
		api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST,
		defaults: "2025-05-24",
	});
}

initPosthog();
