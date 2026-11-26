"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { signOut } from "next-auth/react";
import type { Session } from "next-auth";
import { Icon } from "@/components/Icons";

const THEMES = [
  { id: "light", label: "Light", hint: "Bright, print-ready console" },
  { id: "dark", label: "Dark", hint: "Low-light reading" },
  { id: "system", label: "System", hint: "Follows your device preference" }
] as const;

/**
 * Appearance (theme) and account panel. Theme preference is persisted
 * client-side exactly like the header toggle, so it works without a backend.
 */
export function SettingsPanel({
  session,
  signedIn
}: {
  session: Session | null;
  signedIn: boolean;
}) {
  const router = useRouter();
  const [theme, setTheme] = useState<string>("system");
  const [signingOut, setSigningOut] = useState(false);

  function applyTheme(next: string) {
    if (next === "system") {
      document.documentElement.dataset.theme = "light";
      const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
      document.documentElement.dataset.theme = prefersDark ? "dark" : "light";
    } else {
      document.documentElement.dataset.theme = next;
    }
    localStorage.setItem("pricetracked-theme", next);
  }

  async function handleSignOut() {
    setSigningOut(true);
    await signOut({ callbackUrl: "/" });
    router.refresh();
  }

  return (
    <div className="grid settings-grid">
      <section className="panel" aria-labelledby="appearance-heading">
        <div className="panel-heading-row">
          <h2 id="appearance-heading">Appearance</h2>
          <Icon name="sun" size={16} />
        </div>
        <div className="theme-options" role="radiogroup" aria-label="Theme">
          {THEMES.map((option) => (
            <button
              key={option.id}
              type="button"
              role="radio"
              aria-checked={theme === option.id}
              className={`theme-option ${theme === option.id ? "is-active" : ""}`}
              onClick={() => {
                setTheme(option.id);
                applyTheme(option.id);
              }}
            >
              <strong>{option.label}</strong>
              <small className="muted">{option.hint}</small>
            </button>
          ))}
        </div>
      </section>

      <section className="panel" aria-labelledby="account-heading">
        <div className="panel-heading-row">
          <h2 id="account-heading">Account</h2>
          <Icon name="user" size={16} />
        </div>
        {signedIn ? (
          <div className="account-detail">
            <strong>{session?.user?.name || session?.user?.email || "Signed in"}</strong>
            <span className="muted">{session?.user?.email || "Google account"}</span>
            <button
              type="button"
              className="button ghost"
              onClick={handleSignOut}
              disabled={signingOut}
            >
              <Icon name="logout" size={15} /> {signingOut ? "Signing out…" : "Sign out"}
            </button>
          </div>
        ) : (
          <p className="muted">
            You are browsing as a guest. Sign in with Google to keep your watchlist and alerts
            tied to your account across devices and browsers.
          </p>
        )}
      </section>
    </div>
  );
}
