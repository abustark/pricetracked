import Link from "next/link";
import type { Metadata } from "next";
import { LogoMark } from "@/components/Icons";
import { SiteFooter } from "@/components/SiteFooter";
import { BackButton } from "@/components/BackButton";

export const metadata: Metadata = {
  title: "Privacy - PriceTracked",
  description: "What PriceTracked stores, in plain terms."
};

export default function PrivacyPage() {
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
        <h1>Privacy</h1>
        <p className="legal-updated">Last updated 23 September 2026</p>

        <p>What we store, in plain terms — no hidden fine print.</p>

        <h2>What we store</h2>
        <ul>
          <li>
            <strong>Google sign-in:</strong> your account ID, name, email and photo — only to
            attach your watchlist to your account.
          </li>
          <li>
            <strong>Your watchlist:</strong> the links, prices, alert targets and in-app alert
            history you add, so they sync across your devices.
          </li>
          <li>
            <strong>Guest watchlists:</strong> kept in this browser until you sign in and claim
            them.
          </li>
          <li>
            <strong>Theme preference:</strong> light or dark, remembered on your device.
          </li>
        </ul>

        <h2>What we don&apos;t do</h2>
        <ul>
          <li>No selling personal data to advertisers.</li>
          <li>No tracking cookies beyond Google sign-in.</li>
          <li>No payment data — PriceTracked doesn&apos;t process payments.</li>
        </ul>

        <h2>Price data</h2>
        <p>Snapshots of public product pages — informational only. Confirm the final price at the store.</p>

        <h2>Requests</h2>
        <p>
          Delete your products to clear your watchlist. For full data removal, reach out through
          the project&apos;s{" "}
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
