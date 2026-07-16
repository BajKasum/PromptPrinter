import type { Metadata, Viewport } from "next";
import { headers } from "next/headers";
import { Geist, Geist_Mono } from "next/font/google";
import { ThemeProvider } from "@/components/theme-provider";
import "./globals.css";

const geistSans = Geist({
  subsets: ["latin"],
  variable: "--font-geist-sans",
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
    default: "PromptPrinter, Aus rohen Ideen build-fertige Prompts",
    template: "%s · PromptPrinter",
  },
  description:
    "Generiere Produkt-Briefs, PRDs, technische Blueprints und optimierte Prompts, zugeschnitten auf Claude, ChatGPT, Lovable, Cursor, Stitch und mehr.",
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
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#0c0e12" },
  ],
};

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  // Set by src/middleware.ts, next-themes needs it for its own anti-flash
  // inline script to pass the CSP's script-src nonce.
  const nonce = (await headers()).get("x-nonce") ?? undefined;

  return (
    <html
      lang="de"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable}`}
    >
      <body className="font-sans antialiased">
        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
          enableSystem
          disableTransitionOnChange
          nonce={nonce}
        >
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
