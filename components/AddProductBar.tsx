"use client";

import { useState } from "react";

/**
 * Compact add-product bar. Submits to POST /api/products (which enforces the
 * per-viewer quota and the claim → scan → release policy) and reports the
 * outcome honestly — including quota and scan failures.
 */
export function AddProductBar({ onTracked }: { onTracked?: () => void }) {
  const [url, setUrl] = useState("");
  const [status, setStatus] = useState<"idle" | "tracking">("idle");
  const [error, setError] = useState<string | null>(null);

  async function track(event: React.FormEvent) {
    event.preventDefault();
    const value = url.trim();
    if (!value) return;

    setStatus("tracking");
    setError(null);
    try {
      const response = await fetch("/api/products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: value }),
        credentials: "include"
      });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) {
        setError(data.error ?? "Could not track product. Please try again.");
        setStatus("idle");
        return;
      }
      setUrl("");
      setStatus("idle");
      onTracked?.();
    } catch {
      setError("Could not track product. Please try again.");
      setStatus("idle");
    }
  }

  return (
    <form className="workspace-bar" onSubmit={track}>
      <div className="input-wrap" style={{ flex: 1 }}>
        <label className="sr-only" htmlFor="track-url">
          Product link
        </label>
        <input
          id="track-url"
          name="url"
          type="url"
          placeholder="Paste a product link… e.g. https://www.amazon.in/dp/…"
          value={url}
          onChange={(event) => setUrl(event.target.value)}
          autoComplete="off"
          spellCheck={false}
        />
        {error ? (
          <span className="error" role="alert">
            {error}
          </span>
        ) : null}
      </div>
      <button type="submit" className="button primary" disabled={status === "tracking" || !url.trim()}>
        {status === "tracking" ? (
          <>
            <span className="spinner" aria-hidden="true" />
            Tracking
          </>
        ) : (
          "Track"
        )}
      </button>
    </form>
  );
}
