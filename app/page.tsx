import Link from "next/link";
import { loadAlertEvents } from "@/lib/alerts";
import { getDb } from "@/lib/db";
import { getViewer } from "@/lib/viewer";
import type { AlertEventView, ProductDocument } from "@/lib/types";
import { AlertsPanel } from "@/components/AlertsPanel";
import { TrackForm } from "@/components/TrackForm";
import { ProductList } from "@/components/ProductList";
import { ThemeToggle } from "@/components/ThemeToggle";
import { SiteFooter } from "@/components/SiteFooter";
import { AuthButton } from "@/components/AuthButton";
import { RecentDrops } from "@/components/RecentDrops";
import { Icon, LogoMark } from "@/components/Icons";

export const dynamic = "force-dynamic";

export default async function Home() {
  const viewer = await getViewer();
  const products = viewer.userId ? await loadProducts(viewer.userId) : [];
  const alerts = viewer.signedIn && viewer.userId ? await loadAlerts(viewer.userId) : [];
  const signedIn = viewer.signedIn;

  return (
    <main className="shell home-shell" id="main-content">
      <header className="topbar">
        <Link className="brand" href="/" aria-label="PriceTracked home">
          <LogoMark />
          <span>PriceTracked</span>
        </Link>
        <nav className="main-nav" aria-label="Main navigation">
          <Link href="/how-it-works">How it works</Link>
          <a href="#watchlist">Watchlist</a>
        </nav>
        <div className="top-actions">
          <AuthButton session={viewer.session} />
          <ThemeToggle />
        </div>
      </header>

      {viewer.claimedCount && viewer.claimedCount > 0 ? (
        <div className="account-notice" role="status">
          Saved {viewer.claimedCount} {viewer.claimedCount === 1 ? "product" : "products"} from this browser to your Google account.
        </div>
      ) : null}

      <section className="hero hero-grid">
        <div className="hero-copy-block">
          <div className="hero-kicker"><span className="kicker-dot" aria-hidden="true" /> Price history for online shopping</div>
          <h1>Track prices <em>before you buy.</em></h1>
          <p className="hero-copy">Paste a product link to see its price history.</p>
          <RecentDrops />
        </div>

        <div className="hero-visual">
          <svg className="hero-chart" viewBox="0 0 520 137" fill="none" aria-hidden="true">
            <g className="chart-grid" stroke="var(--line-strong)" strokeDasharray="3 6" strokeWidth="1">
              <line x1="0" y1="32" x2="520" y2="32" />
              <line x1="0" y1="69" x2="520" y2="69" />
              <line x1="0" y1="105" x2="520" y2="105" />
            </g>
            <defs>
              <linearGradient id="heroPriceArea" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stopColor="var(--accent)" stopOpacity="0.2" />
                <stop offset="1" stopColor="var(--accent)" stopOpacity="0" />
              </linearGradient>
            </defs>
            <path
              className="chart-area"
              d="M6 56 C 50 47, 72 71, 114 65 C 158 58, 176 40, 220 50 C 262 60, 280 81, 322 74 C 366 68, 384 48, 426 56 C 468 65, 484 90, 514 95 L 514 133 L 6 133 Z"
              fill="url(#heroPriceArea)"
            />
            <path
              className="chart-line"
              d="M6 56 C 50 47, 72 71, 114 65 C 158 58, 176 40, 220 50 C 262 60, 280 81, 322 74 C 366 68, 384 48, 426 56 C 468 65, 484 90, 514 95"
              stroke="var(--accent)"
              strokeWidth="2.6"
              strokeLinecap="round"
              pathLength={1000}
            />
            <text className="chart-label" x="8" y="44" fill="var(--muted)" fontSize="10.5" fontFamily="var(--font-geist-mono, monospace)">₹1,49,900</text>
            <circle className="chart-ping" cx="514" cy="95" r="7.5" fill="var(--accent)" opacity="0.22" />
            <circle className="chart-dot" cx="514" cy="95" r="3.6" fill="var(--accent)" stroke="var(--bg)" strokeWidth="2" />
            <g className="chart-label">
              <rect x="434" y="104" width="84" height="22" rx="7" fill="var(--accent-soft)" stroke="var(--accent)" strokeOpacity="0.4" />
              <text x="476" y="119" textAnchor="middle" fill="var(--accent-strong)" fontSize="11" fontWeight="700" fontFamily="var(--font-geist-mono, monospace)">₹1,32,400</text>
            </g>
          </svg>

          <div className="hero-tracker-card">
            <div className="tracker-card-heading">
              <div className="tracker-card-icon"><Icon name="spark" size={19} /></div>
              <div>
                <p className="eyebrow">Add a product</p>
                <h2>Paste a product link</h2>
                <p className="tracker-card-description">Start with any public product page.</p>
              </div>
            </div>
            <TrackForm signedIn={signedIn} />
            <div className="tracker-card-foot"><Icon name="globe" size={15} /> Amazon · Flipkart · AJIO · more</div>
          </div>
        </div>
      </section>

      <section className="watchlist-section" id="watchlist">
        <div className="section-heading section-heading-wide" data-reveal>
          <div>
            <div className="section-label"><span className="section-label-line" /> Watchlist</div>
            <h2>Products you&apos;re tracking.</h2>
          </div>
          <span className="list-count">{products.length} {products.length === 1 ? "item" : "items"}</span>
        </div>
        {signedIn ? <AlertsPanel initialAlerts={alerts} /> : null}
        <ProductList products={products.map((product) => serializeProduct(product))} signedIn={signedIn} />
      </section>

      <SiteFooter />
    </main>
  );
}

async function loadProducts(userId?: string): Promise<ProductDocument[]> {
  if (!userId) return [];
  try {
    const db = await getDb();
    return await db
      .collection<ProductDocument>("products")
      .find({ userId })
      .sort({ updatedAt: -1 })
      .limit(50)
      .toArray();
  } catch {
    return [];
  }
}

async function loadAlerts(userId: string): Promise<AlertEventView[]> {
  try {
    return await loadAlertEvents(userId);
  } catch {
    return [];
  }
}

function serializeProduct(product: ProductDocument) {
  return {
    ...product,
    _id: product._id?.toString(),
    createdAt: product.createdAt.toISOString(),
    updatedAt: product.updatedAt.toISOString(),
    nextScanAt: product.nextScanAt.toISOString(),
    lastScannedAt: product.lastScannedAt?.toISOString()
  };
}
