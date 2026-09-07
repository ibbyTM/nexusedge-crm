import type { Metadata, Viewport } from "next";
import { Space_Grotesk, Inter_Tight, Geist_Mono } from "next/font/google";

import { ThemeProvider } from "@/components/theme-provider";
import { AmbientGlow } from "@/components/ambient-glow";

import "./globals.css";

const spaceGrotesk = Space_Grotesk({ variable: "--font-space-grotesk", subsets: ["latin"] });
const interTight = Inter_Tight({ variable: "--font-inter-tight", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
	title: { default: "NexusEdge CRM", template: "%s | NexusEdge CRM" },
	description: "The NexusEdge team workspace.",
	robots: { index: false, follow: false },
};

export const viewport: Viewport = {
	themeColor: [
		{ media: "(prefers-color-scheme: light)", color: "#ffffff" },
		{ media: "(prefers-color-scheme: dark)", color: "#0b0a13" },
	],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
	return (
		<html lang="en" suppressHydrationWarning className={`${spaceGrotesk.variable} ${interTight.variable} ${geistMono.variable} h-full antialiased`}>
			<body className="min-h-full flex flex-col">
				<ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
					<AmbientGlow />
					{children}
				</ThemeProvider>
			</body>
		</html>
	);
}
