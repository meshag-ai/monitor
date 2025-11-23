import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";

const inter = Inter({
	variable: "--font-inter",
	subsets: ["latin"],
});

export const metadata: Metadata = {
	title: "MeshAG - Deep Database Monitoring & Optimization",
	description: "Monitor and optimize your database performance with AI",
};

export default function RootLayout({
	children,
}: Readonly<{
	children: React.ReactNode;
}>) {
	return (
		<html lang="en">
			<head></head>
			<body className={`${inter.variable} antialiased font-sans`}>
				<Providers>{children}</Providers>
			</body>
		</html>
	);
}
