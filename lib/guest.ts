/**
 * Guest viewers are identified by a UUID stored in the httpOnly guest cookie
 * (`pricetracked-guest-id`, see `lib/viewer.ts`). Account ids come from the
 * auth provider (Google `sub`, numeric) and never match this pattern.
 *
 * Guests have no cross-device alert surface, so in-app alert events are only
 * created for account ids — never for guest ids.
 */
const GUEST_ID_PATTERN = /^[0-9a-f-]{36}$/i;

export function isGuestId(value?: string): boolean {
  return Boolean(value && GUEST_ID_PATTERN.test(value));
}
