import type { Metadata, Viewport } from "next";
import { headers } from "next/headers";
import { Geist, Geist_Mono } from "next/font/google";
import { ThemeProvider } from "@/shared/providers/theme-provider";
import { siteUrl } from "@/shared/lib/site-url";
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

// Aus derselben Quelle wie Sitemap und Auth-Redirects, statt hier ein zweites
// Mal die Domain zu behaupten. `https://promptprinter.app` stand hier hart
// verdrahtet, obwohl genau diese Adresse noch niemandem gehört (die
// Hosting-Entscheidung steht aus, siehe legal.ts' appHost) — der Sitemap ist
// das schon abgewöhnt worden (Security-Audit L-6), diesem Modul nicht.
//
// metadataBase ist der Bezugspunkt, gegen den Next JEDE relative URL in den
// Metadaten auflöst, allen voran das OG-Bild. Solange er falsch war, zeigte
// jede geteilte Vorschau — WhatsApp, Slack, LinkedIn — auf eine fremde
// Domain: kein Bild, und im schlechtesten Fall das Bild von jemand anderem.
const BASE_URL = siteUrl();

export const metadata: Metadata = {
  metadataBase: new URL(BASE_URL),
  // Ohne Canonical konkurrieren erreichbare Varianten derselben Seite
  // (Vercel-Preview-Domain, spätere eigene Domain, ?utm_-Parameter) im Index
  // miteinander. Pro Seite überschreibbar, hier die Wurzel als Standard.
  alternates: { canonical: "/" },
  title: {
    default: "PromptPrinter, Aus rohen Ideen build-fertige Prompts",
    template: "%s · PromptPrinter",
  },
  description:
    "Ein KI-Chat, der nachfragt, bis deine Idee klar ist, und dir dann den fertigen, passenden Prompt liefert, zugeschnitten auf Claude, ChatGPT, Lovable, Cursor, Stitch und mehr.",
  keywords: [
    "KI-Prompts",
    "Prompt-Engineering",
    "Claude",
    "ChatGPT",
    "Cursor",
    "Lovable",
    "v0",
    "Stitch",
  ],
  openGraph: {
    title: "PromptPrinter",
    description: "Aus rohen Ideen build-fertige Prompts.",
    url: BASE_URL,
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
  // QA finding K-1: asks Chrome/Android to resize the layout viewport itself
  // when the on-screen keyboard opens, instead of leaving it full-height and
  // just shrinking the visual viewport underneath — the mismatch that lets a
  // `sticky bottom-0` composer end up hidden behind the keyboard. iOS Safari
  // doesn't fully honor this the same way, that half is handled in
  // chat-composer.tsx via lib/use-visual-viewport-inset.ts instead.
  interactiveWidget: "resizes-content",
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
