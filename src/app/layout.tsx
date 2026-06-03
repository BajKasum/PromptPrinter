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
    default: "PromptPrinter — Aus rohen Ideen build-fertige Prompts",
    template: "%s · PromptPrinter",
  },
  description:
    "Generiere Produkt-Briefs, PRDs, technische Blueprints und optimierte Prompts — zugeschnitten auf Claude, ChatGPT, Lovable, Cursor, Stitch und mehr.",
  keywords: [
    "KI-Prompts",
    "PRD-Generator",
    "Claude",
    "ChatGPT",
    "Cursor",
    "Lovable",
    "v0",
    "Stitch",
    "Produktanforderungen",
  ],
  openGraph: {
    title: "PromptPrinter",
    description: "Aus rohen Ideen build-fertige Prompts.",
    url: "https://promptprinter.app",
    siteName: "PromptPrinter",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "PromptPrinter",
    description: "Aus rohen Ideen build-fertige Prompts.",
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
    <html lang="de" className={`${inter.variable} ${geistMono.variable} dark`}>
      <body className="font-sans antialiased">{children}</body>
    </html>
  );
}
