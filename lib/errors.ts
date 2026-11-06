/**
 * Sanitizes errors before returning them to client callers or displaying in user-facing UI.
 * Prevents leaking environment variables, database strings, connection hostnames, or internal stack traces.
 */
export function sanitizeErrorMessage(error: unknown, fallback = "Service temporarily unavailable. Please try again."): string {
  if (!error) return fallback;

  const raw = error instanceof Error ? error.message : String(error);
  const normalized = raw.trim();

  // Explicitly check for internal/system configurations or connection failures
  if (
    /MONGODB|DATABASE|MONGO|ECONNREFUSED|ENOTFOUND|ETIMEDOUT|AUTH_SECRET|CLIENT_SECRET|PRICETRACKED_|ENV_/i.test(normalized) ||
    /failed to connect|connection string|server selection|topology closed|authentication failed/i.test(normalized)
  ) {
    return "Service temporarily unavailable. Please try again later.";
  }

  // Preserve safe, user-actionable error messages from known validation and scrapers
  if (
    /sign in|paste a|supported|ecommerce|product link|redirected|bot-check|proxy|captcha|valid URL|blocked/i.test(normalized)
  ) {
    return normalized;
  }

  // If the message looks like a raw code or internal exception, use fallback
  if (/^[A-Z_]+Error:|^Error:|\.js:\d+|\.ts:\d+/i.test(normalized)) {
    return fallback;
  }

  // Cap message length to prevent oversized payloads
  return normalized.length > 200 ? `${normalized.slice(0, 197)}...` : normalized;
}
