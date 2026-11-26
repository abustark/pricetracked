import Link from "next/link";
import { getDb } from "@/lib/db";
import { getViewer } from "@/lib/viewer";
import { loadAlertEvents } from "@/lib/alerts";
import { queryWatchlist, watchlistSummary } from "@/lib/watchlist";
import type { ProductDocument } from "@/lib/types";
import { AddProductBar } from "@/components/AddProductBar";
import { ClaimWatchlist } from "@/components/ClaimWatchlist";
import { EmptyState } from "@/components/EmptyState";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";
import { SummaryCounts } from "@/components/SummaryCounts";
import { WatchlistTable } from "@/components/WatchlistTable";
import type { WatchlistProduct } from "@/components/WatchlistTable";
import { Icon } from "@/components/Icons";

export const dynamic = "force-dynamic";

function serializeProduct(product: ProductDocument & { status: "fresh" | "stale" | "error" | "paused" }): WatchlistProduct {
  return {
    ...product,
    _id: product._id?.toString() ?? "",
    createdAt: product.createdAt.toISOString(),
    updatedAt: product.updatedAt.toISOString(),
    nextScanAt: product.nextScanAt.toISOString(),
    lastScannedAt: product.lastScannedAt?.toISOString() ?? null
  };
}

export default async function Home() {
  const viewer = await getViewer();
  const signedIn = viewer.signedIn;
  const userId = viewer.userId;

  let summary = { tracking: 0, reached: 0, attention: 0 };
  let initialProducts: WatchlistProduct[] = [];
  let total = 0;
  let stores: string[] = [];
  let loadFailed = false;
  let unreadAlerts = 0;

  if (userId) {
    try {
      const [summaryResult, pageResult] = await Promise.all([
        watchlistSummary(userId),
        queryWatchlist(userId, { page: 1, limit: 20 })
      ]);
      summary = summaryResult;
      stores = pageResult.stores;
      total = pageResult.total;
      initialProducts = pageResult.products.map(serializeProduct);

      if (signedIn) {
        try {
          const events = await loadAlertEvents(userId, 50);
          unreadAlerts = events.filter((event) => !event.read).length;
        } catch {
          // Alert badge is best-effort — never block the workspace on it.
        }
      }
    } catch {
      loadFailed = true;
    }
  }

  return (
    <main className="shell home-shell" id="main-content">
      <SiteHeader session={viewer.session} path="/" alertsUnread={unreadAlerts} />

      <ClaimWatchlist pending={viewer.claimPending} claim={viewer.claim} />

      <section className="workspace-section" aria-labelledby="workspace-heading">
        <div className="page-heading">
          <h1 id="workspace-heading">Price research workspace</h1>
          <p>
            Track products and review genuine observed price history — every sample comes from a real
            scan, never fabricated.
          </p>
        </div>

        <AddProductBar />

        {signedIn ? <SummaryCounts {...summary} /> : null}

        {loadFailed ? (
          <div className="service-notice" role="status">
            <Icon name="globe" size={15} />
            <span>
              We couldn&apos;t load your watchlist right now. Your saved products are safe — please
              refresh in a moment.
            </span>
          </div>
        ) : null}

        {!signedIn && userId ? (
          <div className="guest-sync-banner">
            <Icon name="user" size={15} />
            <span>
              You&apos;re tracking as a guest in this browser.{" "}
              <Link href="/alerts" className="text-link">
                Sign in with Google
              </Link>{" "}
              to keep your watchlist across devices and get alerts.
            </span>
          </div>
        ) : null}

        {userId && summary.tracking === 0 && !loadFailed ? (
          <EmptyState
            icon={<Icon name="tag" size={20} />}
            title="No products tracked yet"
            description="Paste a product link above to start recording genuine price observations. History accumulates with each scan — no fake history, no fabricated charts."
          />
        ) : null}

        {userId && summary.tracking > 0 ? (
          <WatchlistTable initialProducts={initialProducts} initialTotal={total} stores={stores} />
        ) : null}

        {!userId ? (
          <div className="legal-page" style={{ marginTop: "var(--space-5)" }}>
            <h2>What you get</h2>
            <ul>
              <li>Highest, lowest and typical observed prices with exact observation dates.</li>
              <li>Timestamp-scaled history charts with visible gaps — nothing implied that was not observed.</li>
              <li>In-app target-price alerts on genuine price crossings.</li>
            </ul>
            <p className="muted" style={{ fontSize: 13 }}>
              New products start with one real observation and build history over time. Learn how the
              tracking works on the{" "}
              <Link href="/how-it-works" className="text-link">
                how it works
              </Link>{" "}
              page.
            </p>
          </div>
        ) : null}
      </section>

      <SiteFooter />
    </main>
  );
}
