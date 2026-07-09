/**
 * Derive a friendly first name for greetings and notifications.
 * Prefers the first token of `user.name` (from Google/Apple auth), then
 * falls back to the email local-part.
 */
export function getFirstName(user) {
  const fromName = (user?.name || '').trim().split(/\s+/)[0];
  if (fromName) {
    return fromName.charAt(0).toUpperCase() + fromName.slice(1).toLowerCase();
  }

  const emailLocal = (user?.email || '').split('@')[0];
  if (!emailLocal) return '';

  return emailLocal.charAt(0).toUpperCase() + emailLocal.slice(1).toLowerCase();
}
