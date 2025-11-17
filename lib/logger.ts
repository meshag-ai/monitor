import pino from "pino";
import pinoPretty from "pino-pretty";

const pinoOptions: pino.LoggerOptions = {
	level: process.env.LOG_LEVEL || "info",
};

const streams = [];

if (process.env.NODE_ENV !== "production") {
	streams.push({
		level: "debug",
		stream: pinoPretty(),
	});
}

export const logger = pino(pinoOptions, pino.multistream(streams));
