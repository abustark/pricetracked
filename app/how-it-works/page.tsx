import Link from "next/link";
import type { Metadata } from "next";
import { Icon, LogoMark } from "@/components/Icons";
import { SiteFooter } from "@/components/SiteFooter";
import { BackButton } from "@/components/BackButton";

export const metadata: Metadata = {
  title: "How it works - PriceTracked",
  description: "Three steps to a better buy — and every price insight PriceTracked tracks."
};

export default function HowItWorksPage() {
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
        <p className="eyebrow">Guide</p>
        <h1>How it works</h1>
        <p>Paste a link, watch the price, buy at the right time.</p>
      </article>

      <section className="how-section" id="how">
        <ol className="steps">
          <li className="step">
            <span className="step-num" aria-hidden="true">01</span>
            <div className="step-icon"><Icon name="link" size={17} /></div>
            <strong>Paste any product link</strong>
            <p>Any public product page.</p>
          </li>
          <li className="step">
            <span className="step-num" aria-hidden="true">02</span>
            <div className="step-icon"><Icon name="clock" size={17} /></div>
            <strong>We trail the price</strong>
            <p>We snapshot it over time.</p>
          </li>
          <li className="step">
            <span className="step-num" aria-hidden="true">03</span>
            <div className="step-icon"><Icon name="bell" size={17} /></div>
            <strong>Buy at the right time</strong>
            <p>Compare the low, then buy.</p>
          </li>
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
          <div className="stat">
            <span>Price insights</span>
            <strong>6</strong>
          </div>
          <div className="stat">
            <span>Snapshots retained</span>
            <strong>1,000</strong>
          </div>
          <div className="stat">
            <span>Dedicated adapters</span>
            <strong>4</strong>
          </div>
          <div className="stat">
            <span>URL to get started</span>
            <strong>1</strong>
          </div>
        </div>
      </section>

      <SiteFooter />
    </main>
  );
}
