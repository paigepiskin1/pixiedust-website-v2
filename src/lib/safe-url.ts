// SSRF-safe URL checks for outbound fetches of user-supplied links
// (product pages, remote images). Used by /api/product-link/*.

const BLOCKED_HOSTS = new Set([
  "localhost",
  "metadata.google.internal",
  "metadata",
  "kubernetes.default",
  "kubernetes.default.svc",
]);

const BLOCKED_SUFFIXES = [".local", ".internal", ".localhost", ".lan", ".home", ".corp"];

/** True if the hostname is a literal IPv4 address. */
function isIpv4(host: string): boolean {
  return /^(?:\d{1,3}\.){3}\d{1,3}$/.test(host);
}

/** True if the hostname is a literal IPv6 address (with or without brackets). */
function isIpv6(host: string): boolean {
  const h = host.replace(/^\[|\]$/g, "");
  return h.includes(":");
}

function ipv4Private(host: string): boolean {
  const parts = host.split(".").map((n) => Number(n));
  if (parts.length !== 4 || parts.some((n) => !Number.isFinite(n) || n < 0 || n > 255)) return true;
  const [a, b] = parts;
  if (a === 10) return true;
  if (a === 127) return true;
  if (a === 0) return true;
  if (a === 169 && b === 254) return true; // link-local / cloud metadata
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT
  if (a >= 224) return true; // multicast / reserved
  return false;
}

function ipv6Private(host: string): boolean {
  const h = host.replace(/^\[|\]$/g, "").toLowerCase();
  if (h === "::1" || h === "::") return true;
  if (h.startsWith("fc") || h.startsWith("fd")) return true; // ULA
  if (h.startsWith("fe80")) return true; // link-local
  if (h.startsWith("::ffff:")) {
    const v4 = h.slice(7);
    if (isIpv4(v4)) return ipv4Private(v4);
  }
  return false;
}

export type SafeUrlResult =
  | { ok: true; url: URL }
  | { ok: false; error: string };

/**
 * Validate a user-supplied URL before any outbound fetch.
 * https only, no credentials, no private/literal IPs, no internal hostnames.
 */
export function assertSafeHttpUrl(raw: string): SafeUrlResult {
  const trimmed = (raw || "").trim();
  if (!trimmed) return { ok: false, error: "Paste a product link first." };
  if (trimmed.length > 2048) return { ok: false, error: "That link is too long." };

  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    return { ok: false, error: "That doesn’t look like a valid URL." };
  }

  if (url.protocol !== "https:") {
    return { ok: false, error: "Only https:// links are allowed." };
  }
  if (url.username || url.password) {
    return { ok: false, error: "Links with usernames or passwords aren’t allowed." };
  }

  const host = url.hostname.toLowerCase();
  if (!host || host === "0.0.0.0") return { ok: false, error: "That host isn’t allowed." };
  if (BLOCKED_HOSTS.has(host)) return { ok: false, error: "That host isn’t allowed." };
  if (BLOCKED_SUFFIXES.some((s) => host.endsWith(s))) {
    return { ok: false, error: "That host isn’t allowed." };
  }
  if (isIpv4(host) && ipv4Private(host)) {
    return { ok: false, error: "That host isn’t allowed." };
  }
  if (isIpv6(host) && ipv6Private(host)) {
    return { ok: false, error: "That host isn’t allowed." };
  }

  return { ok: true, url };
}

/** Re-check a redirect Location against the same rules. */
export function assertSafeRedirect(location: string, base: URL): SafeUrlResult {
  try {
    return assertSafeHttpUrl(new URL(location, base).toString());
  } catch {
    return { ok: false, error: "Redirect blocked." };
  }
}
