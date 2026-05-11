import type { Metadata, Viewport } from "next";
import { Inter, Geist_Mono } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const geistMono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-geist-mono",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL("https://promptprinter.app"),
  title: {
    default: "PromptPrinter — Turn rough ideas into build-ready prompts",
    template: "%s · PromptPrinter",
  },
  description:
    "Generate product briefs, PRDs, technical blueprints, and optimized prompts tailored for Claude, ChatGPT, Lovable, Cursor, Stitch, and more.",
  keywords: [
    "AI prompts",
    "PRD generator",
    "Claude",
    "ChatGPT",
    "Cursor",
    "Lovable",
    "v0",
    "Stitch",
    "product requirements",
  ],
  openGraph: {
    title: "PromptPrinter",
    description: "Turn rough ideas into build-ready prompts.",
    url: "https://promptprinter.app",
    siteName: "PromptPrinter",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "PromptPrinter",
    description: "Turn rough ideas into build-ready prompts.",
  },
};

export const viewport: Viewport = {
  themeColor: "#0A0A0A",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${inter.variable} ${geistMono.variable} dark`}>
      <body className="font-sans antialiased">{children}</body>
    </html>
  );
}
