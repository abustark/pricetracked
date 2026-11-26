"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Badge } from "@/components/Badge";
import { EmptyState } from "@/components/EmptyState";
import { StatusPill } from "@/components/StatusPill";
import { Icon } from "@/components/Icons";

export type WatchlistProduct = {
  _id: string;
  title: string;
  url: string;
  store: string;
  storeLabel?: string;
  currency: string;
  active: boolean;
  lastPrice?: number;
  targetPrice?: number;
  targetPriceReached?: boolean;
  targetAlertEnabled?: boolean;
  lastScannedAt?: string | null;
  lastError?: string;
  status: "fresh" | "stale" | "error" | "paused";
  createdAt?: string;
  updatedAt?: string;
  nextScanAt?: string;
};

const PAGE_SIZE = 20;

const STATUS_LABELS: Record<WatchlistProduct["status"], string> = {
  fresh: "Fresh",
  stale: "Stale",
  error: "Error",
  paused: "Paused"
};

function relativeTime(iso: string | null | undefined): string {
  if (!iso) return "never";
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "never";
  const seconds = Math.round((Date.now() - then) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Intl.DateTimeFormat("en", { month: "short", day: "numeric" }).format(new Date(then));
}

function formatPrice(price: number | undefined, currency: string): string {
  if (price === undefined) return "—";
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: currency === "INR" ? "INR" : currency,
    maximumFractionDigits: 0
  }).format(price);
}

/**
 * Watchlist workspace table. Filter/sort/pagination state lives in the URL
 * query string so views are deep-linkable; data comes from the paginated
 * GET /api/products contract. Row actions (rescan, pause/resume, delete)
 * call the existing product APIs and refresh the list on completion.
 */
export function WatchlistTable({
  initialProducts,
  initialTotal,
  stores
}: {
  initialProducts: WatchlistProduct[];
  initialTotal: number;
  stores: string[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [products, setProducts] = useState<WatchlistProduct[]>(initialProducts);
  const [total, setTotal] = useState(initialTotal);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [rowBusy, setRowBusy] = useState<string | null>(null);
  const [rowNotice, setRowNotice] = useState<string | null>(null);

  const q = searchParams.get("q") ?? "";
  const store = searchParams.get("store") ?? "";
  const status = searchParams.get("status") ?? "";
  const sort = searchParams.get("sort") ?? "latest";
  const page = Math.max(1, Number.parseInt(searchParams.get("page") ?? "1", 10) || 1);

  const updateParams = useCallback(
    (next: Record<string, string | number | undefined>) => {
      const params = new URLSearchParams(searchParams.toString());
      for (const [key, value] of Object.entries(next)) {
        if (value === undefined || value === "" || value === "1") {
          params.delete(key);
        } else {
          params.set(key, String(value));
        }
      }
      router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    },
    [pathname, router, searchParams]
  );

  const fetchList = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const params = new URLSearchParams({ page: String(page), limit: String(PAGE_SIZE) });
      if (q) params.set("q", q);
      if (store) params.set("store", store);
      if (status) params.set("status", status);
      if (sort && sort !== "latest") params.set("sort", sort);

      const response = await fetch(`/api/products?${params.toString()}`, {
        credentials: "include"
      });
      if (!response.ok) {
        setLoadError("Could not load your watchlist. Please try again.");
        return;
      }
      const data = (await response.json()) as {
        products: WatchlistProduct[];
        total: number;
      };
      setProducts(data.products);
      setTotal(data.total);
    } catch {
      setLoadError("Could not load your watchlist. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [page, q, store, status, sort]);

  // Refetch when the URL-driven filter state changes (skip the first render —
  // the server already rendered the matching page).
  const firstRun = useRef(true);
  useEffect(() => {
    if (firstRun.current) {
      firstRun.current = false;
      return;
    }
    fetchList();
  }, [fetchList]);

  async function rescan(product: WatchlistProduct) {
    setRowBusy(product._id);
    setRowNotice(null);
    try {
      const response = await fetch(`/api/products/${product._id}/scan`, {
        method: "POST",
        credentials: "include"
      });
      if (response.status === 429) {
        setRowNotice("A scan was already requested recently — it will run at the next slot.");
      } else if (response.status === 409) {
        setRowNotice("A scan is already running for this product.");
      } else if (!response.ok) {
        setRowNotice("The scan could not be started. Please try again.");
      } else {
        setRowNotice("Scan requested — it will refresh at the next slot.");
      }
      await fetchList();
    } catch {
      setRowNotice("The scan could not be started. Please try again.");
    } finally {
      setRowBusy(null);
    }
  }

  async function togglePause(product: WatchlistProduct) {
    setRowBusy(product._id);
    setRowNotice(null);
    try {
      const response = await fetch(`/api/products/${product._id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active: !product.active }),
        credentials: "include"
      });
      if (!response.ok) {
        setRowNotice("Could not update the tracking state. Please try again.");
      }
      await fetchList();
    } catch {
      setRowNotice("Could not update the tracking state. Please try again.");
    } finally {
      setRowBusy(null);
    }
  }

  async function remove(product: WatchlistProduct) {
    if (!window.confirm(`Stop tracking "${product.title}"? Its observed history stays on the product page.`)) {
      return;
    }
    setRowBusy(product._id);
    setRowNotice(null);
    try {
      const response = await fetch(`/api/products/${product._id}`, {
        method: "DELETE",
        credentials: "include"
      });
      if (!response.ok) {
        setRowNotice("Could not remove the product. Please try again.");
      }
      await fetchList();
    } catch {
      setRowNotice("Could not remove the product. Please try again.");
    } finally {
      setRowBusy(null);
    }
  }

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <section className="watchlist-section" id="watchlist" aria-labelledby="watchlist-heading">
      <div className="section-heading">
        <h2 id="watchlist-heading">Your watchlist</h2>
        <p>Observed price history from real scans — nothing fabricated.</p>
      </div>

      <div className="filters-bar">
        <div className="search-form" style={{ flex: 1, minWidth: 200 }}>
          <label className="sr-only" htmlFor="wl-search">
            Search watchlist
          </label>
          <input
            id="wl-search"
            type="search"
            placeholder="Search products…"
            value={q}
            onChange={(event) => updateParams({ q: event.target.value, page: 1 })}
          />
        </div>
        <label className="sr-only" htmlFor="wl-store">
          Filter by store
        </label>
        <select id="wl-store" value={store} onChange={(event) => updateParams({ store: event.target.value, page: 1 })}>
          <option value="">All stores</option>
          {stores.map((storeKey) => (
            <option key={storeKey} value={storeKey}>
              {storeKey}
            </option>
          ))}
        </select>
        <label className="sr-only" htmlFor="wl-status">
          Filter by status
        </label>
        <select id="wl-status" value={status} onChange={(event) => updateParams({ status: event.target.value, page: 1 })}>
          <option value="">All statuses</option>
          <option value="fresh">Fresh</option>
          <option value="stale">Stale</option>
          <option value="error">Error</option>
          <option value="paused">Paused</option>
        </select>
        <label className="sr-only" htmlFor="wl-sort">
          Sort
        </label>
        <select id="wl-sort" value={sort} onChange={(event) => updateParams({ sort: event.target.value, page: 1 })}>
          <option value="latest">Latest observation</option>
          <option value="title">Product name</option>
          <option value="target">Target proximity</option>
        </select>
      </div>

      {rowNotice ? (
        <div className="status-banner" role="status" style={{ marginBottom: "var(--space-3)" }}>
          {rowNotice}
        </div>
      ) : null}

      {loadError ? (
        <div className="status-banner error" role="alert">
          {loadError}
        </div>
      ) : null}

      {products.length === 0 && !loading ? (
        total === 0 ? (
          <EmptyState
            icon={<Icon name="search" size={20} />}
            title="No products tracked yet"
            description="Paste a product link above to start recording genuine price observations. History accumulates with each scan."
          />
        ) : (
          <EmptyState
            icon={<Icon name="search" size={20} />}
            title="No matches"
            description="No products match the current filters. Try clearing the search or status filter."
          />
        )
      ) : (
        <div className="watchlist-table-wrap">
          <table className="watchlist-table">
            <caption className="sr-only">
              Tracked products with last observed price, freshness and target state
            </caption>
            <thead>
              <tr>
                <th scope="col">Product</th>
                <th scope="col">Store</th>
                <th scope="col">Last observed</th>
                <th scope="col">Checked</th>
                <th scope="col">Target</th>
                <th scope="col">Status</th>
                <th scope="col">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {products.map((product) => (
                <tr key={product._id}>
                  <td>
                    <div className="wl-title">
                      <Link href={`/products/${product._id}`}>{product.title}</Link>
                    </div>
                    <div className="wl-sub">{product.url}</div>
                  </td>
                  <td>
                    <span className="store-chip">
                      <span className="store-dot" aria-hidden="true" />
                      {product.storeLabel ?? product.store}
                    </span>
                  </td>
                  <td className="wl-price">{formatPrice(product.lastPrice, product.currency)}</td>
                  <td className="wl-checked">{relativeTime(product.lastScannedAt)}</td>
                  <td className="wl-target">
                    {product.targetPrice !== undefined ? (
                      <>
                        {formatPrice(product.targetPrice, product.currency)}
                        {product.targetPriceReached ? (
                          <Badge variant="success" className="status-slot">
                            Reached
                          </Badge>
                        ) : null}
                      </>
                    ) : (
                      <span className="muted">—</span>
                    )}
                  </td>
                  <td>
                    <StatusPill status={product.status} label={STATUS_LABELS[product.status]} />
                  </td>
                  <td className="wl-actions">
                    <button
                      type="button"
                      className="plain-action"
                      onClick={() => rescan(product)}
                      disabled={rowBusy === product._id}
                      title="Request a scan now"
                    >
                      {rowBusy === product._id ? <span className="spinner" aria-hidden="true" /> : <Icon name="refresh" size={14} />}
                      Rescan
                    </button>
                    <button
                      type="button"
                      className="plain-action"
                      onClick={() => togglePause(product)}
                      disabled={rowBusy === product._id}
                      title={product.active ? "Pause tracking" : "Resume tracking"}
                    >
                      {product.active ? "Pause" : "Resume"}
                    </button>
                    <button
                      type="button"
                      className="plain-action"
                      onClick={() => remove(product)}
                      disabled={rowBusy === product._id}
                      title="Stop tracking this product"
                    >
                      <Icon name="trash" size={14} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {total > PAGE_SIZE ? (
            <div className="pagination">
              <span>
                Page {page} of {totalPages} · {total} {total === 1 ? "product" : "products"}
              </span>
              <div className="page-controls">
                <button
                  type="button"
                  className="button small"
                  onClick={() => updateParams({ page: page - 1 })}
                  disabled={page <= 1 || loading}
                >
                  Previous
                </button>
                <button
                  type="button"
                  className="button small"
                  onClick={() => updateParams({ page: page + 1 })}
                  disabled={page >= totalPages || loading}
                >
                  Next
                </button>
              </div>
            </div>
          ) : null}
        </div>
      )}

      {loading ? (
        <div className="status-banner" role="status" style={{ marginTop: "var(--space-3)" }}>
          <span className="spinner" aria-hidden="true" /> Updating…
        </div>
      ) : null}
    </section>
  );
}
