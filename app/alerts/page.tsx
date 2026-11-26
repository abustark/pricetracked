import Link from "next/link";
import { getViewer } from "@/lib/viewer";
import { loadAlertEvents } from "@/lib/alerts";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { Icon } from "@/components/Icons";
import { AlertsList } from "@/components/AlertsList";
import { EmptyState } from "@/components/EmptyState";

export const dynamic = "force-dynamic";

export default async function AlertsPage() {
  const viewer = await getViewer();

  if (!viewer.userId) {
    return (
      <>
        <SiteHeader session={null} path="/alerts" />
        <main className="shell" id="main-content">
          <div className="page-head">
            <div>
              <h1>Alerts</h1>
              <p className="muted">Target-price and availability alerts for your watchlist.</p>
            </div>
          </div>
          <EmptyState
            icon="bell"
            title="Sign in to see your alerts"
            description="Alerts are delivered in-app for the products you track. Sign in with Google to pick up your watchlist."
            action={
              <Link className="button primary" href="/api/auth/signin">
                <Icon name="user" size={16} /> Sign in with Google
              </Link>
            }
          />
          <SiteFooter />
        </main>
      </>
    );
  }

  const alerts = await loadAlertEvents(viewer.userId, 25);

  return (
    <>
      <SiteHeader session={viewer.session} path="/alerts" />
      <main className="shell" id="main-content">
        <div className="page-head">
          <div>
            <h1>Alerts</h1>
            <p className="muted">Target-price and availability alerts for your watchlist.</p>
          </div>
          <Link className="button ghost" href="/"><Icon name="arrow" size={16} /> Back to watchlist</Link>
        </div>

        {alerts.length > 0 ? (
          <AlertsList initialAlerts={alerts} />
        ) : (
          <EmptyState
            icon="bell"
            title="No alerts yet"
            description="When a tracked product hits its target price, or drops noticeably, an alert will appear here. Set a target price on any product to get started."
            action={
              <Link className="button primary" href="/">
                <Icon name="tag" size={16} /> Browse your watchlist
              </Link>
            }
          />
        )}
        <SiteFooter />
      </main>
    </>
  );
}
