import type { NextConfig } from "next";
import { withWorkflow } from "workflow/next";

const nextConfig: NextConfig = {
	output: "standalone",
	serverExternalPackages: ["pino"],
};

export default withWorkflow(nextConfig);
