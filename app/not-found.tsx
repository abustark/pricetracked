import Link from "next/link";
import { LogoMark } from "@/components/Icons";
import { SiteFooter } from "@/components/SiteFooter";

export default function NotFound() {
  return (
    <main className="shell" id="main-content">
      <header className="topbar">
        <Link className="brand" href="/" aria-label="PriceTracked home">
          <LogoMark />
          <span>PriceTracked</span>
        </Link>
      </header>

      <section className="notfound">
        <p className="notfound-code">Error 404 · lost trail</p>
        <h1>This trail went cold.</h1>
        <p>
          The page you&apos;re after doesn&apos;t exist, moved, or dropped off the chart. Head back
          home and keep tracking.
        </p>
        <Link className="button" href="/">
          Back to home
        </Link>
      </section>

      <SiteFooter />
    </main>
  );
}
