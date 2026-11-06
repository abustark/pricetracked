import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { Fraunces, Geist, Geist_Mono, Playfair_Display } from "next/font/google";
import "./globals.css";

const geist = Geist({ subsets: ["latin"], variable: "--font-geist", display: "swap" });
const geistMono = Geist_Mono({ subsets: ["latin"], variable: "--font-geist-mono", display: "swap" });
const fraunces = Fraunces({ subsets: ["latin"], variable: "--font-fraunces", display: "swap" });
const playfair = Playfair_Display({ subsets: ["latin"], variable: "--font-playfair", display: "swap" });

export const metadata: Metadata = {
  metadataBase: new URL("https://pricetracked.vercel.app"),
  title: "PriceTracked - buy at the right time",
  description:
    "Track product prices across Amazon, Flipkart, Myntra, AJIO and the wider web with a lightweight price history.",
  openGraph: {
    title: "PriceTracked - buy at the right time",
    description:
      "Price history for online shopping. Paste a product link to see where its price has been before you buy.",
    siteName: "PriceTracked",
    type: "website"
  },
  twitter: {
    card: "summary_large_image",
    title: "PriceTracked - buy at the right time",
    description:
      "Price history for online shopping. Paste a product link to see where its price has been before you buy."
  }
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f7f4ec" },
    { media: "(prefers-color-scheme: dark)", color: "#0c1414" }
  ]
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${geist.variable} ${geistMono.variable} ${fraunces.variable} ${playfair.variable}`}
    >
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              try {
                var theme = localStorage.getItem("pricetracked-theme");
                var prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
                document.documentElement.dataset.theme = theme || (prefersDark ? "dark" : "light");
              } catch (_) {}
            `
          }}
        />
      </head>
      <body>
        <a className="skip-link" href="#main-content">Skip to content</a>
        {children}
      </body>
    </html>
  );
}
