import type { Metadata } from "next";
import { Open_Sans } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";

const openSans = Open_Sans({
	variable: "--font-open-sans",
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
			<body className={`${openSans.variable} antialiased`}>
				<Providers>{children}</Providers>
			</body>
		</html>
	);
}
