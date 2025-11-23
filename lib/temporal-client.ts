import { Client, Connection } from "@temporalio/client";

let temporal: Client | undefined;

export async function getTemporalClient(): Promise<Client> {
	if (!temporal) {
		console.log("[Next.js] Initializing lazy Temporal client...");

		const address = process.env.TEMPORAL_ADDRESS;
		const namespace = process.env.TEMPORAL_NAMESPACE;
		if (!address || !namespace) {
			throw new Error(
				"TEMPORAL_ADDRESS or TEMPORAL_NAMESPACE is not defined in the Next.js environment",
			);
		}

		const connection = await Connection.connect({
			address,
			tls: true,
			apiKey: process.env.TEMPORAL_API_KEY,
		});

		temporal = new Client({
			connection,
			namespace,
		});
	}
	return temporal;
}
