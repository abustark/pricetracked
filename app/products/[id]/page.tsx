import Link from "next/link";
import { ObjectId } from "mongodb";
import { notFound } from "next/navigation";
import { calculatePriceStats, OBSERVED_SOURCES } from "@/lib/analytics";
import { getDb } from "@/lib/db";
import { getViewer } from "@/lib/viewer";
import type { PriceSampleDocument, ProductDocument } from "@/lib/types";
import { PriceChart } from "@/components/PriceChart";
import { ProductImage } from "@/components/ProductImage";
import { RescanButton } from "@/components/RescanButton";
import { ResetHistoryButton } from "@/components/ResetHistoryButton";
import { ThemeToggle } from "@/components/ThemeToggle";
import { SiteFooter } from "@/components/SiteFooter";
import { Icon, LogoMark } from "@/components/Icons";
import { getStoreLabel } from "@/lib/stores";
import { AuthButton } from "@/components/AuthButton";
import { TargetPriceAlert } from "@/components/TargetPriceAlert";
import { BuyAdviceCard } from "@/components/BuyAdviceCard";

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ id: string }>;
};

export default async function ProductPage({ params }: Props) {
  const { id } = await params;
  if (!ObjectId.isValid(id)) notFound();
  const viewer = await getViewer();
  if (!viewer.userId) notFound();

  const db = await getDb();
  const productId = new ObjectId(id);
  const product = await db.collection<ProductDocument>("products").findOne({
    _id: productId,
    userId: viewer.userId
  });
  if (!product) notFound();

  const samples = await db
    .collection<PriceSampleDocument>("price_samples")
    .find({ productId, source: { $in: [...OBSERVED_SOURCES] } })
    .sort({ capturedAt: 1 })
    .limit(1000)
    .toArray();
  const stats = calculatePriceStats(samples, product.mrp);
  const currentPriceDrop = stats.current && stats.highest ? stats.highest.price - stats.current.price : 0;
  const isAtLowest = samples.length > 1 && stats.current?.price === stats.lowest?.price;

  return (
    <main className="shell" id="main-content">
      <header className="topbar">
        <Link className="brand" href="/" aria-label="PriceTracked home">
          <LogoMark />
          <span>PriceTracked</span>
        </Link>
        <div className="top-actions">
          <AuthButton session={viewer.session} />
          <ThemeToggle />
        </div>
      </header>

      <Link className="back-link" href="/" aria-label="Back to watchlist"><Icon name="arrow" size={16} /> Back to watchlist</Link>
      <section className="panel product-hero">
        <div className="product-hero-card">
          <ProductImage src={product.imageUrl} alt={product.title} priority />
          <div>
            <div className="detail-kicker"><span className="status-dot" aria-hidden="true" /> Watching price</div>
            <h1 className="product-hero-title">{product.title}</h1>
            <div className="product-meta">
              <span className="meta-chip">{getStoreLabel(product.store, product.normalizedUrl, product.storeLabel)}</span>
              <a className="meta-chip" href={product.normalizedUrl} target="_blank" rel="noreferrer">
                Open store page <Icon name="external" size={12} />
              </a>
              <span className="meta-chip">Every {product.scanEveryHours}h</span>
              {product.mrp && product.lastPrice && product.mrp > product.lastPrice ? (
                <span className="meta-chip" style={{ color: "rgb(245, 158, 11)", borderColor: "rgba(245, 158, 11, 0.3)" }}>
                  MRP {formatMoney(product.mrp, product.currency)} • {Math.round(((product.mrp - product.lastPrice) / product.mrp) * 100)}% off
                </span>
              ) : null}
            </div>
            {isAtLowest ? <div className="price-insight"><Icon name="trend" size={13} /> Lowest observed price</div> : currentPriceDrop > 0 ? <div className="price-insight"><Icon name="trend" size={13} /> {formatMoney(currentPriceDrop, product.currency)} below tracked high</div> : null}
          </div>
          <div className="price-block">
            <span>Current price</span>
            <strong>{product.lastPrice != null ? formatMoney(product.lastPrice, product.currency) : "-"}</strong>
            {product.mrp && product.lastPrice && product.mrp > product.lastPrice ? (
              <small style={{ textDecoration: "line-through", color: "var(--muted)", display: "block", marginTop: "2px" }}>
                MRP: {formatMoney(product.mrp, product.currency)}
              </small>
            ) : null}
          </div>
        </div>
        {product.lastError ? <p className="error">Last scan error: {product.lastError}</p> : null}
        <div className="product-actions" role="group" aria-label="Product actions">
          <RescanButton productId={id} />
          <ResetHistoryButton productId={id} />
        </div>
      </section>

      <BuyAdviceCard advice={stats.advice} currency={product.currency} />

      <TargetPriceAlert
        productId={id}
        currentPrice={product.lastPrice}
        currency={product.currency}
        initialTargetPrice={product.targetPrice}
        initialTargetAlertEnabled={product.targetAlertEnabled}
        lowestPrice={stats.lowest?.price}
        mrp={product.mrp}
      />

      <section className="grid stats-grid" aria-label="Price statistics" data-reveal>
        <Stat label="Current price" value={stats.current ? formatMoney(stats.current.price, product.currency) : "None"} note={stats.current ? `as of ${formatDate(stats.current.capturedAt)}` : undefined} />
        <Stat
          label="Lowest price"
          value={stats.lowest ? formatMoney(stats.lowest.price, product.currency) : "None"}
          note={stats.lowest ? `${formatDate(stats.lowest.capturedAt)}${stats.savings ? ` · ${stats.savings.percentage}% below MRP` : ""}` : undefined}
        />
        <Stat label="Highest observed" value={stats.highest ? formatMoney(stats.highest.price, product.currency) : "None"} note={stats.highest ? formatDate(stats.highest.capturedAt) : undefined} />
        <Stat label="Typical price" value={stats.common ? formatMoney(stats.common.price, product.currency) : "None"} note={stats.common ? `${stats.common.percentage}% of snapshots` : undefined} />
        <Stat label="Price observations" value={String(stats.sampleCount)} note={`${stats.changes.count} ${stats.changes.count === 1 ? "change" : "changes"} observed`} />
      </section>

      <section className="detail-grid" data-reveal>
        <div className="panel">
          <h2>Price history</h2>
          <PriceChart
            samples={samples.map((sample) => ({
              price: sample.price,
              capturedAt: sample.capturedAt.toISOString(),
              source: sample.source
            }))}
            currency={product.currency}
            mrp={product.mrp}
          />
        </div>
        <div className="panel">
          <div className="panel-heading-row"><h2>Recent scans</h2><span className="list-count">{samples.length} total</span></div>
          <div className="samples">
            {[...samples].reverse().slice(0, 12).map((sample) => {
              return (
                <div className="sample-row" key={sample._id?.toString()}>
                  <div>
                    <span>{formatDate(sample.capturedAt.toISOString())}</span>
                    <small>
                      {sample.source === "proxy" ? "Proxy scan" : "Live scan"}
                      {sample.inStock === false ? " · Out of stock" : ""}
                    </small>
                  </div>
                  <strong>
                    {formatMoney(sample.price, sample.currency)}
                  </strong>
                </div>
              );
            })}
            {samples.length === 0 ? <p className="muted">Your first price snapshot will appear here.</p> : null}
          </div>
        </div>
      </section>
      <SiteFooter />
    </main>
  );
}

function Stat({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div className="stat">
      <span>{label}</span>
      <strong>{value}</strong>
      {note ? <p className="muted">{note}</p> : null}
    </div>
  );
}

function formatMoney(value: number, currency: string) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: currency || "INR",
    maximumFractionDigits: 0
  }).format(value);
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(value));
}
