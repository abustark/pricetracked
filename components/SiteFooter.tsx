import Link from "next/link";
import { LogoMark } from "@/components/Icons";

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="footer-brand">
        <Link className="brand" href="/" aria-label="PriceTracked home">
          <LogoMark />
          <span>PriceTracked</span>
        </Link>
        <p>Price history for online shopping — paste a link, see the trail, buy at the right time.</p>
      </div>

      <nav className="footer-cols" aria-label="Footer">
        <div className="footer-col">
          <strong>Product</strong>
          <Link href="/how-it-works">How it works</Link>
          <Link href="/#watchlist">Watchlist</Link>
          <Link href="/#main-content">Track a product</Link>
        </div>
        <div className="footer-col">
          <strong>Stores</strong>
          <a href="https://www.amazon.in/" target="_blank" rel="noopener noreferrer">Amazon</a>
          <a href="https://www.flipkart.com/" target="_blank" rel="noopener noreferrer">Flipkart</a>
          <a href="https://www.myntra.com/" target="_blank" rel="noopener noreferrer">Myntra</a>
          <a href="https://www.ajio.com/" target="_blank" rel="noopener noreferrer">AJIO</a>
        </div>
        <div className="footer-col">
          <strong>Legal</strong>
          <Link href="/privacy">Privacy</Link>
          <Link href="/terms">Terms</Link>
        </div>
      </nav>

      <div className="footer-base">
        <div className="footer-base-copy">
          <p>© 2026 PriceTracked</p>
          <p>Price data is informational. Always confirm the final price at checkout.</p>
        </div>
        <a
          className="footer-portfolio"
          href="https://abufolio.vercel.app"
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Open my portfolio at abufolio.vercel.app"
        >
          <span className="footer-portfolio-kicker">Like this build? There&apos;s more of my work</span>
          <span className="footer-portfolio-link">Open my portfolio <span aria-hidden="true">↗</span></span>
        </a>
      </div>
    </footer>
  );
}
