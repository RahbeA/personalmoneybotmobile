import * as Crypto from 'expo-crypto';

/**
 * Normalize a contact number to E.164-ish digits for SHA-256 matching (DEV-536).
 * Does not upload the raw number — callers hash this string first.
 */
export function normalizePhone(raw, defaultCountryCode = '1') {
  const trimmed = String(raw || '').trim();
  if (!trimmed) return '';
  const digits = trimmed.replace(/\D/g, '');
  if (!digits) return '';
  if (trimmed.startsWith('+')) return `+${digits}`;
  if (digits.length === 10) return `+${defaultCountryCode}${digits}`;
  if (digits.length === 11 && digits.startsWith(defaultCountryCode)) return `+${digits}`;
  return `+${digits}`;
}

export async function hashPhone(raw, defaultCountryCode = '1') {
  const e164 = normalizePhone(raw, defaultCountryCode);
  if (!e164) return '';
  return Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, e164);
}

export async function hashPhones(rawList, defaultCountryCode = '1') {
  const unique = [];
  const seen = new Set();
  for (const raw of rawList || []) {
    const digest = await hashPhone(raw, defaultCountryCode);
    if (digest && !seen.has(digest)) {
      seen.add(digest);
      unique.push(digest);
    }
  }
  return unique;
}
