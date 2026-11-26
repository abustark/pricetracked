import Link from "next/link";
import type { Session } from "next-auth";
import { AuthButton } from "@/components/AuthButton";
import { ThemeToggle } from "@/components/ThemeToggle";
import { LogoMark } from "@/components/Icons";

const NAV_LINKS = [
  { href: "/", label: "Watchlist" },
  { href: "/alerts", label: "Alerts" },
  { href: "/how-it-works", label: "How it works" }
] as const;

/**
 * Shared top navigation. `path` is the current pathname so the active link
 * gets `aria-current="page"`.
 */
export function SiteHeader({
  session,
  path,
  alertsUnread = 0
}: {
  session?: Session | null;
  path: string;
  alertsUnread?: number;
}) {
  return (
    <header className="topbar">
      <Link className="brand" href="/" aria-label="PriceTracked home">
        <LogoMark />
        <span>PriceTracked</span>
      </Link>
      <nav className="main-nav" aria-label="Main navigation">
        {NAV_LINKS.map((link) => {
          const isActive = link.href === "/" ? path === "/" : path.startsWith(link.href);
          return (
            <Link
              key={link.href}
              className="nav-link"
              href={link.href}
              aria-current={isActive ? "page" : undefined}
            >
              {link.label}
              {link.href === "/alerts" && alertsUnread > 0 ? (
                <span className="nav-badge" aria-label={`${alertsUnread} unread alerts`}>
                  {alertsUnread > 9 ? "9+" : alertsUnread}
                </span>
              ) : null}
            </Link>
          );
        })}
      </nav>
      <div className="top-actions">
        <AuthButton session={session} />
        <ThemeToggle />
      </div>
    </header>
  );
}
