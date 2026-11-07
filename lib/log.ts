/**
 * Minimal structured logging for operational signals (scan outcomes, cron batch
 * summaries). One JSON line per event so Vercel log drains can parse it.
 *
 * Never pass URLs, cookies, auth tokens, emails, names, user ids or raw
 * environment values — only non-sensitive operational fields.
 */
type LogFields = Record<string, string | number | boolean | undefined>;
type LogLevel = "info" | "warn" | "error";

export function logEvent(event: string, fields: LogFields = {}, level: LogLevel = "info"): void {
  const entry: Record<string, unknown> = {
    level,
    event,
    ts: new Date().toISOString()
  };

  for (const [key, value] of Object.entries(fields)) {
    if (value !== undefined) entry[key] = value;
  }

  const line = JSON.stringify(entry);
  if (level === "error") {
    console.error(line);
  } else if (level === "warn") {
    console.warn(line);
  } else {
    console.log(line);
  }
}
