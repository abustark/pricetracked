import Link from "next/link";
import type { Metadata } from "next";
import { Icon } from "@/components/Icons";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";

export const metadata: Metadata = {
  title: "How it works - PriceTracked",
  description: "Three steps to a better buy — and the honest engineering behind every price insight PriceTracked tracks."
};

const STEPS = [
  { icon: "link", title: "Paste any product link", body: "Any public product page, from the supported stores or the wider web. We normalise the URL and start watching it in your personal watchlist." },
  { icon: "clock", title: "We trail the price", body: "Each product is re-scanned on its own schedule — hourly for fresh pages, stretched as the history grows — and every valid observation is kept as a snapshot." },
  { icon: "bell", title: "Buy at the right time", body: "The chart shows the low and the trend, target-price alerts fire when a product crosses your line, and the buy advice helps you decide whether to act now or wait." }
] as const;

const FEATURES = [
  { icon: "trend", title: "Six price insights", body: "Current price, lowest and highest observed, typical (most common) price, change count, and a verdict derived from the real observations — never a guess." },
  { icon: "clock", title: "1,000-snapshot memory", body: "The most recent 1,000 observations per product stay on the chart. Older history rolls off so the view stays fast and relevant." },
  { icon: "zap", title: "Four dedicated adapters", body: "Amazon, Flipkart, Myntra and AJIO each have a purpose-built scraper for accurate prices and stock; any other link falls back to a generic web scan through the proxy." },
  { icon: "spark", title: "Buy advice, honestly bounded", body: "A wait-or-buy verdict with a confidence level derived from how much history exists. Limited history is labelled as such — we never invent missing data." }
] as const;

const PRIVACY_NOTES = [
  "Your watchlist and price history are personal — a product you track is visible to you, and to no one else, unless you sign in to the same account.",
  "Scans happen at most once per product per its scan interval, so repeated requests never pile up.",
  "Alerts are delivered in-app only: no email, no push notifications, and no third-party data imports.",
  "Nothing is written to production without an explicit scan, a claim, or your own action — scheduled scans only re-check the products you already track."
] as const;

export default function HowItWorksPage() {
  return (
    <>
      <SiteHeader session={null} path="/how-it-works" />
      <main className="shell" id="main-content">
        <article className="legal-page">
          <p className="eyebrow">Guide</p>
          <h1>How it works</h1>
          <p>Paste a link, watch the price, buy at the right time — and see the honest engineering behind every insight.</p>
        </article>

        <section className="how-section" id="how">
          <ol className="steps">
            {STEPS.map((step, index) => (
              <li className="step" key={step.title}>
                <span className="step-num" aria-hidden="true">{String(index + 1).padStart(2, "0")}</span>
                <div className="step-icon"><Icon name={step.icon} size={17} /></div>
                <strong>{step.title}</strong>
                <p>{step.body}</p>
              </li>
            ))}
          </ol>
          <div className="works-with">
            <span className="works-label">Works with</span>
            <span className="works-chip"><span className="store-dot amazon" aria-hidden="true" /> Amazon</span>
            <span className="works-chip"><span className="store-dot flipkart" aria-hidden="true" /> Flipkart</span>
            <span className="works-chip"><span className="store-dot myntra" aria-hidden="true" /> Myntra</span>
            <span className="works-chip"><span className="store-dot ajio" aria-hidden="true" /> AJIO</span>
            <span className="works-chip"><Icon name="globe" size={13} /> + the wider web</span>
          </div>
        </section>

        <section className="cap-section">
          <div className="section-heading section-heading-wide">
            <div>
              <div className="section-label"><span className="section-label-line" /> What you get</div>
              <h2>Every product, measured.</h2>
            </div>
          </div>
          <div className="grid cap-stats">
            <div className="stat"><span>Price insights</span><strong>6</strong></div>
            <div className="stat"><span>Snapshots retained</span><strong>1,000</strong></div>
            <div className="stat"><span>Dedicated adapters</span><strong>4</strong></div>
            <div className="stat"><span>URL to get started</span><strong>1</strong></div>
          </div>
        </section>

        <section className="cap-section" aria-labelledby="features-heading">
          <div className="section-heading section-heading-wide">
            <div>
              <div className="section-label"><span className="section-label-line" /> The details</div>
              <h2 id="features-heading">Inside the tracker</h2>
            </div>
          </div>
          <div className="grid feature-grid">
            {FEATURES.map((feature) => (
              <div className="panel feature-card" key={feature.title}>
                <div className="feature-icon"><Icon name={feature.icon} size={18} /></div>
                <strong>{feature.title}</strong>
                <p className="muted">{feature.body}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="cap-section" aria-labelledby="privacy-heading">
          <div className="section-heading section-heading-wide">
            <div>
              <div className="section-label"><span className="section-label-line" /> Data &amp; privacy</div>
              <h2 id="privacy-heading">How your data is kept honest</h2>
            </div>
          </div>
          <div className="panel">
            <ul className="bullet-list">
              {PRIVACY_NOTES.map((note) => (
                <li key={note}><Icon name="check" size={14} /> <span>{note}</span></li>
              ))}
            </ul>
          </div>
        </section>

        <section className="cap-section" aria-labelledby="stack-heading">
          <div className="section-heading section-heading-wide">
            <div>
              <div className="section-label"><span className="section-label-line" /> Stack</div>
              <h2 id="stack-heading">Built to run anywhere</h2>
            </div>
          </div>
          <div className="panel">
            <p className="muted">
              PriceTracked runs as a Next.js app on Vercel with MongoDB as its store: page routes render server-side,
              scans run from a scheduled job, and every mutating action is checked server-side before it touches a product.
              The same codebase runs locally for development and on the free Vercel Hobby plan in production.
            </p>
            <Link className="button primary" href="/"><Icon name="arrow" size={16} /> Start tracking</Link>
          </div>
        </section>

        <SiteFooter />
      </main>
    </>
  );
}
