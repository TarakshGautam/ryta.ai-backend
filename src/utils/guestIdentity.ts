const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isValidGuestSessionId(value: unknown): value is string {
  return typeof value === "string" && UUID_RE.test(value.trim());
}

export function parseGuestSessionId(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return isValidGuestSessionId(trimmed) ? trimmed : null;
}
