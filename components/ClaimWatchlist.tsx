"use client";

import { useEffect, useState } from "react";
import type { ClaimStatus } from "@/lib/viewer";

type Props = {
  pending: boolean;
  claim: ClaimStatus;
};

type ClaimState = "idle" | "working" | "saved" | "failed";

const FALLBACK_ERROR = "Your browser watchlist could not be moved to your account yet.";

/**
 * Runs the explicit guest→account watchlist claim once after a sign-in
 * transition and shows honest inline status.
 *
 * The claim only ever runs here — via `POST /api/claim` — never during page
 * reads: `getViewer()` is read-only and the auth flows signal the transition
 * with the `claim-pending` cookie. A failed claim keeps the guest products in
 * place and offers a retry; the claim operation itself is idempotent, so
 * retrying is always safe.
 */
export function ClaimWatchlist({ pending, claim }: Props) {
  const [state, setState] = useState<ClaimState>("idle");
  const [count, setCount] = useState(0);
  const [claimError, setClaimError] = useState<string | null>(null);

  // Initialize from the server-provided claim status (e.g. a page reload
  // after a failed attempt) so the notice and retry are available without
  // re-firing the claim.
  useEffect(() => {
    if (claim.status === "saved") {
      setState("saved");
      setCount(claim.claimedCount ?? 0);
      setClaimError(null);
    } else if (claim.status === "failed") {
      setState("failed");
      setClaimError(claim.message ?? FALLBACK_ERROR);
    }
  }, [claim]);

  useEffect(() => {
    if (!pending || state !== "idle") return;

    setState("working");
    fetch("/api/claim", { method: "POST", credentials: "include" })
      .then(async (res) => {
        if (!res.ok) {
          // Not signed in or no guest watchlist to claim — nothing to do.
          setState("idle");
          return;
        }
        const data = (await res.json()) as {
          status?: string;
          claimed?: number;
          merged?: number;
          error?: string;
        };
        if (data.status === "failed") {
          setClaimError(data.error ?? FALLBACK_ERROR);
          setState("failed");
          return;
        }
        setCount((data.claimed ?? 0) + (data.merged ?? 0));
        setState("saved");
      })
      .catch(() => {
        setClaimError(FALLBACK_ERROR);
        setState("failed");
      });
  }, [pending, state]);

  if (state === "idle") return null;

  if (state === "working") {
    return (
      <div className="account-notice" role="status">
        Moving your browser watchlist to your account…
      </div>
    );
  }

  if (state === "saved") {
    if (count <= 0) return null;
    return (
      <div className="account-notice" role="status">
        Saved {count} {count === 1 ? "product" : "products"} from this browser to your Google account.
      </div>
    );
  }

  return (
    <div className="account-notice account-notice-error" role="alert">
      <span>{claimError}</span>
      <button
        type="button"
        className="claim-retry-button"
        onClick={() => {
          setState("idle");
        }}
      >
        Try again
      </button>
    </div>
  );
}
