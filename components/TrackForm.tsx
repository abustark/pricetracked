"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { Icon } from "@/components/Icons";
import { sanitizeErrorMessage } from "@/lib/errors";

const DEMO_PRODUCTS = [
  {
    label: "iPhone 16",
    store: "amazon",
    url: "https://www.amazon.in/dp/B0DGJ9N27P"
  },
  {
    label: "Sony WH-1000XM5",
    store: "flipkart",
    url: "https://www.flipkart.com/sony-wh-1000xm5-bluetooth-headset/p/itm2dcab549f9922"
  },
  {
    label: "Nike Pegasus",
    store: "myntra",
    url: "https://www.myntra.com/sports-shoes/nike/nike-air-zoom-pegasus/30419212/buy"
  }
];

export function TrackForm({ signedIn = false }: { signedIn?: boolean }) {
  const router = useRouter();
  const [url, setUrl] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "navigating" | "error">("idle");
  const [message, setMessage] = useState("");
  const [pasteLoading, setPasteLoading] = useState(false);

  async function trackUrl(targetUrl: string) {
    const trimmed = targetUrl.trim();
    if (!trimmed) return;

    setStatus("loading");
    setMessage("Reading product price…");

    try {
      const response = await fetch("/api/products", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ url: trimmed })
      });
      const payload = await response.json();

      if (!response.ok) {
        setStatus("error");
        setMessage(
          sanitizeErrorMessage(payload.error, "Could not scan this product. Please try again.")
        );
        return;
      }

      const productPath = `/products/${payload.product._id}`;
      setStatus("navigating");
      setMessage("Added. Opening price history…");
      setUrl("");
      router.prefetch(productPath);
      router.push(productPath);
    } catch {
      setStatus("error");
      setMessage("Connection failed. Try again.");
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await trackUrl(url);
  }

  function handleSelectDemo(demoUrl: string) {
    setUrl(demoUrl);
    trackUrl(demoUrl);
  }

  async function pasteFromClipboard() {
    if (!navigator.clipboard) {
      setMessage("Paste the product URL into the field above.");
      setStatus("error");
      return;
    }

    setPasteLoading(true);
    try {
      setUrl(await navigator.clipboard.readText());
      setMessage("");
      setStatus("idle");
    } catch {
      setMessage("Clipboard access was blocked. Paste the link into the field above.");
      setStatus("error");
    } finally {
      setPasteLoading(false);
    }
  }

  const busy = status === "loading" || status === "navigating";

  return (
    <div className="track-panel">
      <form className="search-form" onSubmit={handleSubmit}>
        <div className="input-wrap">
          <Icon name="link" size={18} />
          <label className="sr-only" htmlFor="product-url">Product URL</label>
          <input
            id="product-url"
            className="search-input"
            name="url"
            value={url}
            onChange={(event) => setUrl(event.target.value)}
            placeholder="https://store.com/product…"
            type="url"
            inputMode="url"
            autoComplete="url"
            aria-label="Product URL"
            aria-invalid={status === "error" ? true : undefined}
            aria-describedby={message ? "track-form-status" : undefined}
            disabled={busy}
            required
          />
          <button
            className="paste-button"
            type="button"
            onClick={pasteFromClipboard}
            disabled={busy || pasteLoading}
            aria-label="Paste URL from clipboard"
            title="Paste from clipboard"
          >
            {pasteLoading ? "…" : "Paste"}
          </button>
        </div>
        <button className="button search-button" disabled={busy} type="submit">
          {busy ? <span className="spinner" aria-hidden="true" /> : <Icon name="arrow" size={17} />}
          <span>{status === "navigating" ? "Opening" : status === "loading" ? "Scanning" : "Track price"}</span>
        </button>
      </form>

      <div className="demo-chips">
        <span className="demo-label">Try example:</span>
        {DEMO_PRODUCTS.map((demo) => (
          <button
            key={demo.label}
            className="demo-chip"
            type="button"
            onClick={() => handleSelectDemo(demo.url)}
            disabled={busy}
            aria-label={`Try sample: ${demo.label}`}
          >
            <span className={`store-dot ${demo.store}`} aria-hidden="true" />
            <span>{demo.label}</span>
          </button>
        ))}
      </div>

      <div className="form-note">
        <Icon name={signedIn ? "lock" : "globe"} size={14} />{" "}
        {status === "idle"
          ? (signedIn ? "Saved to your account watchlist" : "Saved to this browser · Sign in anytime to sync across devices")
          : "Scanning…"}
      </div>
      <div className={`status-slot ${message ? "has-message" : ""}`}>
        {message ? (
          <div id="track-form-status" className={`status-banner ${status}`} role={status === "error" ? "alert" : "status"} aria-live={status === "error" ? "assertive" : "polite"} aria-atomic="true">
            {busy ? <span className="pulse-dot" aria-hidden="true" /> : null}
            <span>{message}</span>
          </div>
        ) : null}
      </div>
      {status === "navigating" ? (
        <div className="page-transition" role="status" aria-live="polite">
          <div className="transition-card">
            <span className="transition-ring" aria-hidden="true" />
            <p className="eyebrow">Price history</p>
            <strong>Loading your timeline</strong>
            <span className="muted">Almost there.</span>
          </div>
        </div>
      ) : null}
    </div>
  );
}
