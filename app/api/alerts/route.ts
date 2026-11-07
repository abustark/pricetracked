import { NextResponse } from "next/server";
import { dismissAlert, loadAlertEvents, markAlertsRead } from "@/lib/alerts";
import { sanitizeErrorMessage } from "@/lib/errors";
import { getViewer } from "@/lib/viewer";

/** List the signed-in user's in-app alert events (most recent first). */
export async function GET() {
  const viewer = await getViewer();
  if (!viewer.signedIn || !viewer.userId) {
    return NextResponse.json({ error: "Sign in required.", alerts: [] }, { status: 401 });
  }

  try {
    const alerts = await loadAlertEvents(viewer.userId);
    return NextResponse.json({ alerts });
  } catch (error) {
    return NextResponse.json(
      { error: sanitizeErrorMessage(error, "Could not load alerts. Please try again."), alerts: [] },
      { status: 400 }
    );
  }
}

/** Mark one event (body {id}) or all events (body {all: true}) as read. */
export async function PATCH(request: Request) {
  const viewer = await getViewer();
  if (!viewer.signedIn || !viewer.userId) {
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  }

  let body: { id?: string; all?: boolean };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  if (!body.all && (!body.id || typeof body.id !== "string")) {
    return NextResponse.json({ error: "Provide an alert id, or {all: true}." }, { status: 400 });
  }

  try {
    const updated = await markAlertsRead(viewer.userId, { id: body.id, all: body.all === true });
    return NextResponse.json({ ok: true, updated });
  } catch (error) {
    return NextResponse.json(
      { error: sanitizeErrorMessage(error, "Could not update alerts. Please try again.") },
      { status: 400 }
    );
  }
}

/** Dismiss (delete) one alert event: /api/alerts?id=<id>. */
export async function DELETE(request: Request) {
  const viewer = await getViewer();
  if (!viewer.signedIn || !viewer.userId) {
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  }

  const id = new URL(request.url).searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "Provide the alert id to dismiss." }, { status: 400 });
  }

  try {
    const dismissed = await dismissAlert(viewer.userId, id);
    if (!dismissed) {
      return NextResponse.json({ error: "Alert not found." }, { status: 404 });
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { error: sanitizeErrorMessage(error, "Could not dismiss the alert. Please try again.") },
      { status: 400 }
    );
  }
}
