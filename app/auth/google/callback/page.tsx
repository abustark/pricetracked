"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";

const MESSAGE_SOURCE = "pricetracked-google-auth";

/**
 * Landing page for Google's popup window. Grabs ?code&state from the URL
 * and hands them to the opener tab via postMessage, then closes itself.
 * If there is no opener (popup was blocked → full-page fallback), it
 * completes the exchange itself and redirects home.
 */
function CallbackHandler() {
  const params = useSearchParams();
  const code = params.get("code");
  const state = params.get("state");
  const googleError = params.get("error");
  const [status, setStatus] = useState<"working" | "failed">(code ? "working" : "failed");

  useEffect(() => {
    if (googleError || !code) {
      setStatus("failed");
      return;
    }

    if (window.opener && !window.opener.closed) {
      window.opener.postMessage(
        { source: MESSAGE_SOURCE, code, state, error: null },
        window.location.origin
      );
      setTimeout(() => window.close(), 200);
      return;
    }

    // No opener: popup blocked, this is a top-level redirect. Exchange here.
    fetch("/api/auth/google", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code }),
      credentials: "include"
    })
      .then((res) => {
        if (res.ok) {
          window.location.replace("/");
        } else {
          setStatus("failed");
        }
      })
      .catch(() => setStatus("failed"));
  }, [code, state, googleError]);

  if (status === "failed") {
    return (
      <main className="shell" id="main-content">
        <section className="notfound">
          <p className="notfound-code">Google sign-in</p>
          <h1>Sign-in cancelled.</h1>
          <p>Google didn&apos;t hand back an authorization code. Try again whenever you like.</p>
          <Link className="button" href="/">
            Back to home
          </Link>
        </section>
      </main>
    );
  }

  return (
    <main className="shell" id="main-content">
      <section className="notfound">
        <p className="notfound-code">Google sign-in</p>
        <h1>Completing sign-in…</h1>
        <p>Hang tight — this window will close on its own.</p>
      </section>
    </main>
  );
}

export default function GoogleAuthCallbackPage() {
  return (
    <Suspense
      fallback={
        <main className="shell" id="main-content">
          <section className="notfound">
            <p className="notfound-code">Google sign-in</p>
            <h1>Completing sign-in…</h1>
          </section>
        </main>
      }
    >
      <CallbackHandler />
    </Suspense>
  );
}
