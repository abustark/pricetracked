import Link from "next/link";
import type { Metadata } from "next";
import { LogoMark } from "@/components/Icons";
import { SiteFooter } from "@/components/SiteFooter";
import { BackButton } from "@/components/BackButton";

export const metadata: Metadata = {
  title: "Terms - PriceTracked",
  description: "The terms of using PriceTracked and its informational price data."
};

export default function TermsPage() {
  return (
    <main className="shell" id="main-content">
      <BackButton />
      <header className="topbar">
        <Link className="brand" href="/" aria-label="PriceTracked home">
          <LogoMark />
          <span>PriceTracked</span>
        </Link>
        <nav className="main-nav" aria-label="Main navigation">
          <Link href="/#watchlist">Watchlist</Link>
        </nav>
      </header>

      <article className="legal-page">
        <p className="eyebrow">Legal</p>
        <h1>Terms</h1>
        <p className="legal-updated">Last updated 23 September 2026</p>

        <p>By using PriceTracked, you agree to these terms.</p>

        <h2>Use of the service</h2>
        <ul>
          <li>For personal price tracking of public product pages.</li>
          <li>No scraping, reselling or automated bulk access.</li>
          <li>You&apos;re responsible for the links you add under your account.</li>
        </ul>

        <h2>Price data is informational</h2>
        <ul>
          <li>Prices are historical snapshots — possibly stale or wrong.</li>
          <li>No guarantee of any price or discount — confirm at the store before buying.</li>
          <li>Product names and trademarks belong to their respective stores.</li>
        </ul>

        <h2>Availability</h2>
        <p>Provided as-is; may change or be discontinued without notice. We&apos;re not liable for decisions made on this data.</p>

        <h2>Changes</h2>
        <p>Continued use after updates means you accept the revised terms.</p>

        <h2>Contact</h2>
        <p>
          Reach out through the project&apos;s{" "}
          <a href="https://github.com/abustark/pricetracked" target="_blank" rel="noreferrer">
            GitHub repository
          </a>
          .
        </p>
      </article>

      <SiteFooter />
    </main>
  );
}
