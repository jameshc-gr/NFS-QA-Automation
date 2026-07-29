/**
 * Extracts a numeric verification code from arbitrary message/email text.
 * Prefers codes that appear next to verification wording, then falls back to
 * the first standalone 4-8 digit number.
 */
export function extractCodeFromText(text: string, preferredLength?: number): string | null {
  if (!text) return null;

  const flattened = text.replace(/\s+/g, ' ');

  if (preferredLength) {
    const exact = flattened.match(new RegExp(`(?<!\\d)\\d{${preferredLength}}(?!\\d)`));
    if (exact) return exact[0];
  }

  const contextual = flattened.match(
    /(?:code|passcode|pin|otp)\D{0,40}?(?<!\d)(\d{4,8})(?!\d)/i
  );
  if (contextual?.[1]) return contextual[1];

  const trailing = flattened.match(/(?<!\d)(\d{4,8})(?!\d)\D{0,40}?(?:is your|verification|security)/i);
  if (trailing?.[1]) return trailing[1];

  const fallback = flattened.match(/(?<!\d)\d{4,8}(?!\d)/);
  return fallback ? fallback[0] : null;
}
