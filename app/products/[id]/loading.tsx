import Link from "next/link";
import { LogoMark } from "@/components/Icons";

export default function ProductLoading() {
  return (
    <main className="shell" id="main-content">
      <header className="topbar">
        <Link className="brand" href="/">
          <LogoMark />
          <span>PriceTracked</span>
        </Link>
      </header>

      <section className="panel loading-panel">
        <span className="transition-ring" aria-hidden="true" />
        <p className="eyebrow">Opening history</p>
        <h1 className="product-hero-title">Loading product timeline</h1>
        <p className="muted">Loading price history.</p>
      </section>

      <section className="grid stats-grid" aria-label="Loading statistics">
        {[1, 2, 3, 4, 5].map((item) => (
          <div className="stat skeleton-card" key={item}>
            <span />
            <strong />
          </div>
        ))}
      </section>
    </main>
  );
}
