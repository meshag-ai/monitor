import { Client, Connection } from "@temporalio/client";

let temporal: Client | undefined;

export function getTemporalClient(): Client {
	if (!temporal) {
		console.log("[Next.js] Initializing lazy Temporal client...");

		const address = process.env.TEMPORAL_ADDRESS;
		if (!address) {
			throw new Error(
				"TEMPORAL_ADDRESS is not defined in the Next.js environment",
			);
		}

		const connection = Connection.lazy({
			address,
		});

		temporal = new Client({
			connection,
		});
	}
	return temporal;
}
