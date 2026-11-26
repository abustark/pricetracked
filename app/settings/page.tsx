import Link from "next/link";
import { getViewer } from "@/lib/viewer";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { Icon } from "@/components/Icons";
import { SettingsPanel } from "@/components/SettingsPanel";
import { EmptyState } from "@/components/EmptyState";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const viewer = await getViewer();

  return (
    <>
      <SiteHeader session={viewer.session} path="/settings" />
      <main className="shell" id="main-content">
        <div className="page-head">
          <div>
            <h1>Settings</h1>
            <p className="muted">Appearance and account preferences.</p>
          </div>
        </div>

        <SettingsPanel
          session={viewer.session}
          signedIn={Boolean(viewer.userId)}
        />

        {viewer.userId ? null : (
          <EmptyState
            icon="lock"
            title="Sign in for account features"
            description="Sign in with Google to keep your watchlist and alerts tied to your account instead of the current browser."
            action={
              <Link className="button primary" href="/api/auth/signin">
                <Icon name="user" size={16} /> Sign in with Google
              </Link>
            }
          />
        )}
        <SiteFooter />
      </main>
    </>
  );
}
