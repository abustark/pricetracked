import Link from "next/link";
import { ObjectId } from "mongodb";
import { notFound } from "next/navigation";
import { calculatePriceStats, isObservedSample } from "@/lib/analytics";
import { getDb } from "@/lib/db";
import { getFullRangeSummary, getLatestSamples } from "@/lib/history";
import { getEffectiveScanEveryHours } from "@/lib/schedule";
import { getViewer } from "@/lib/viewer";
import { productStatus } from "@/lib/watchlist";
import type { PriceSampleDocument, ProductDocument } from "@/lib/types";
import { ProductImage } from "@/components/ProductImage";
import { RescanButton } from "@/components/RescanButton";
import { ResetHistoryButton } from "@/components/ResetHistoryButton";
import { SiteFooter } from "@/components/SiteFooter";
import { Icon } from "@/components/Icons";
import { getStoreLabel } from "@/lib/stores";
import { TargetPriceAlert } from "@/components/TargetPriceAlert";
import { BuyAdviceCard } from "@/components/BuyAdviceCard";
import { SiteHeader } from "@/components/SiteHeader";
import { StatusPill } from "@/components/StatusPill";
import { ProductChart } from "@/components/ProductChart";

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

  const [samples, fullRange] = await Promise.all([
    getLatestSamples(productId),
    getFullRangeSummary(productId)
  ]);
  const stats = {
    ...calculatePriceStats(samples, product.mrp),
    fullRange: {
      sampleCount: fullRange.sampleCount,
      highest: fullRange.highest
        ? { price: fullRange.highest.price, capturedAt: fullRange.highest.capturedAt.toISOString() }
        : undefined,
      lowest: fullRange.lowest
        ? { price: fullRange.lowest.price, capturedAt: fullRange.lowest.capturedAt.toISOString() }
        : undefined
    }
  };
  const currentPriceDrop = stats.current && stats.highest ? stats.highest.price - stats.current.price : 0;
  const isAtLowest = samples.length > 1 && stats.current?.price === stats.lowest?.price;
  const status = productStatus(product, Date.now());

  return (
    <>
      <SiteHeader session={viewer.session} path="/" />
      <main className="shell" id="main-content">
        <div className="detail-page-head">
          <Link className="back-link" href="/" aria-label="Back to watchlist"><Icon name="arrow" size={16} /> Back to watchlist</Link>
          <StatusPill
            status={status}
            label={
              status === "fresh"
                ? "Up to date"
                : status === "stale"
                  ? "Stale"
                  : status === "error"
                    ? "Scan error"
                    : "Paused"
            }
          />
        </div>
        <section className="panel product-hero">
          <div className="product-hero-card">
            <ProductImage src={product.imageUrl} alt={product.title} priority />
            <div>
              <div className="detail-kicker"><Icon name="tag" size={13} /> Watching price</div>
              <h1 className="product-hero-title">{product.title}</h1>
              <div className="product-meta">
                <span className="meta-chip">{getStoreLabel(product.store, product.normalizedUrl, product.storeLabel)}</span>
                <a className="meta-chip" href={product.normalizedUrl} target="_blank" rel="noreferrer">
                  Open store page <Icon name="external" size={12} />
                </a>
                <span className="meta-chip">Every {getEffectiveScanEveryHours(product.scanEveryHours)}h</span>
                {product.lastScannedAt ? (
                  <span className="meta-chip">Scanned {formatDate(product.lastScannedAt.toISOString())}</span>
                ) : null}
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
          {product.lastError ? (
            <p className="error" role="status">
              Last scan attempt{product.lastAttemptAt ? ` on ${formatDate(product.lastAttemptAt.toISOString())}` : ""} failed: {product.lastError}. Showing the last valid price
              {product.lastScannedAt ? ` from ${formatDate(product.lastScannedAt.toISOString())}` : ""}; it will refresh at the next scheduled scan.
            </p>
          ) : null}
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
            label="Lowest observed"
            value={stats.fullRange?.lowest ? formatMoney(stats.fullRange.lowest.price, product.currency) : "None"}
            note={stats.fullRange?.lowest ? formatDate(stats.fullRange.lowest.capturedAt) : undefined}
          />
          <Stat label="Highest observed" value={stats.fullRange?.highest ? formatMoney(stats.fullRange.highest.price, product.currency) : "None"} note={stats.fullRange?.highest ? formatDate(stats.fullRange.highest.capturedAt) : undefined} />
          <Stat label="Typical price" value={stats.common ? formatMoney(stats.common.price, product.currency) : "None"} note={stats.common ? `most common snapshot · ${stats.common.percentage}% of observations` : undefined} />
          <Stat label="Price observations" value={String(stats.fullRange?.sampleCount ?? stats.sampleCount)} note={`${stats.changes.count} ${stats.changes.count === 1 ? "change" : "changes"} observed`} />
        </section>

        <section className="detail-grid" data-reveal>
          <div className="panel">
            <div className="panel-heading-row">
              <h2>Price history</h2>
            </div>
            <ProductChart
              samples={samples
                .filter(isObservedSample)
                .map((sample) => ({
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
    </>
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
