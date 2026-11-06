"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Original-looking "G Sign in" pill, wired to the fast popup flow.
 *
 * Click → Google account/consent chooser opens in a small window
 * (prompt=select_account) → the /auth/google/callback page hands the
 * authorization code back to this tab via postMessage → we exchange it at
 * /api/auth/google for a session cookie. The main page never navigates.
 */

type Phase = "idle" | "waiting" | "saving";

const MESSAGE_SOURCE = "pricetracked-google-auth";

export function GoogleSignInPill({ clientId }: { clientId: string }) {
  const [phase, setPhase] = useState<Phase>("idle");
  const stateRef = useRef<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const doneRef = useRef(false);

  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  const reset = useCallback(() => {
    stopPolling();
    stateRef.current = null;
    doneRef.current = false;
    setPhase("idle");
  }, [stopPolling]);

  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;
      const data = event.data as {
        source?: string;
        code?: string | null;
        state?: string | null;
        error?: string | null;
      };
      if (!data || data.source !== MESSAGE_SOURCE) return;
      if (data.error || !data.code || data.state !== stateRef.current) {
        reset();
        return;
      }

      doneRef.current = true;
      stopPolling();
      setPhase("saving");
      fetch("/api/auth/google", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: data.code }),
        credentials: "include"
      })
        .then((res) => {
          if (res.ok) {
            window.location.reload();
          } else {
            reset();
          }
        })
        .catch(() => reset());
    };

    window.addEventListener("message", onMessage);
    return () => {
      window.removeEventListener("message", onMessage);
      stopPolling();
    };
  }, [reset, stopPolling]);

  const beginSignIn = () => {
    if (!clientId || phase !== "idle") return;

    const state = crypto.randomUUID();
    stateRef.current = state;
    doneRef.current = false;
    setPhase("waiting");

    const redirectUri = `${window.location.origin}/auth/google/callback`;
    const authUrl =
      "https://accounts.google.com/o/oauth2/v2/auth?" +
      new URLSearchParams({
        client_id: clientId,
        redirect_uri: redirectUri,
        response_type: "code",
        scope: "openid email profile",
        state,
        prompt: "select_account"
      }).toString();

    const popup = window.open(
      authUrl,
      "pricetracked-google-signin",
      "popup=yes,width=520,height=620"
    );

    if (!popup) {
      // Popup blocked — fall back to a normal redirect; the callback page
      // detects there is no opener and completes the exchange itself.
      window.location.assign(authUrl);
      return;
    }

    // User closed the chooser without finishing → back to idle.
    pollRef.current = setInterval(() => {
      if (doneRef.current) return;
      if (popup.closed) reset();
    }, 400);
  };

  return (
    <button
      className="auth-pill"
      type="button"
      onClick={beginSignIn}
      disabled={phase !== "idle"}
    >
      {phase === "idle" ? (
        <>
          <span className="google-mark">G</span>
          <span>Sign in</span>
        </>
      ) : (
        <>
          <span className="spinner" aria-hidden="true" />
          <span>{phase === "waiting" ? "Waiting for Google…" : "Signing in…"}</span>
        </>
      )}
    </button>
  );
}
