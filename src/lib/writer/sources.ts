// Retrieval for the AI Writer: server-side fetches of approved source URLs.
//
// "Approved" means the URL's domain is on the Settings allowlist. Each fetch is
// recorded (URL, time, size, SHA-256 of the text) so the review panel shows
// exactly what evidence the article was written from. Fetched text is passed to
// the model wrapped in <source> tags as data; prompts tell the model to ignore
// instructions inside it.
import type { SourceRecord } from "./types";

const MAX_BYTES = 1_500_000;
const MAX_CHARS = 9000;

export function domainAllowed(url: string, domains: string[]): boolean {
  let host: string;
  try {
    const u = new URL(url);
    if (u.protocol !== "https:" && u.protocol !== "http:") return false;
    host = u.hostname.toLowerCase();
  } catch {
    return false;
  }
  return domains.some((d) => host === d || host.endsWith(`.${d}`));
}

async function sha256(text: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

const decode = (s: string) =>
  s.replace(/&nbsp;/gi, " ").replace(/&amp;/gi, "&").replace(/&lt;/gi, "<").replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"').replace(/&#39;|&apos;/gi, "'").replace(/&rsquo;|&lsquo;/gi, "'")
    .replace(/&rdquo;|&ldquo;/gi, '"').replace(/&mdash;/gi, " - ").replace(/&ndash;/gi, "-")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)));

/** Readable text of an HTML page: the main/article region when there is one,
 *  without scripts, styles, navigation, headers or footers. */
export function htmlToText(html: string): { title: string; text: string } {
  const title = decode((/<title[^>]*>([\s\S]*?)<\/title>/i.exec(html)?.[1] ?? "").trim());
  let h = html.replace(/<!--[\s\S]*?-->/g, " ");
  h = h.replace(/<(script|style|noscript|svg|template|iframe)\b[\s\S]*?<\/\1>/gi, " ");
  const main = /<main\b[\s\S]*?<\/main>/i.exec(h)?.[0] ?? /<article\b[\s\S]*?<\/article>/i.exec(h)?.[0];
  if (main) h = main;
  h = h.replace(/<(nav|header|footer|aside|form)\b[\s\S]*?<\/\1>/gi, " ");
  h = h.replace(/<(br|\/p|\/h[1-6]|\/li|\/div|\/section|\/tr)\b[^>]*>/gi, "\n");
  const text = decode(h.replace(/<[^>]+>/g, " "))
    .split("\n")
    .map((l) => l.replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .join("\n");
  return { title, text };
}

export async function fetchSource(id: string, url: string): Promise<SourceRecord> {
  const fetchedAt = new Date().toISOString();
  const fail = (error: string): SourceRecord => ({ id, url, title: "", fetchedAt, chars: 0, sha256: "", ok: false, error });
  let res: Response;
  try {
    res = await fetch(url, {
      headers: { "User-Agent": "PixyDust-Writer/1.0 (+https://pixydust.com)", Accept: "text/html,text/plain;q=0.9" },
      redirect: "follow",
      signal: AbortSignal.timeout(15000),
    });
  } catch (err) {
    return fail(`Fetch failed: ${(err as Error).message}`);
  }
  if (!res.ok) return fail(`HTTP ${res.status}`);
  const type = res.headers.get("content-type") || "";
  if (!/text\/html|text\/plain|application\/xhtml/i.test(type)) return fail(`Unsupported content type ${type || "unknown"}`);
  const len = Number(res.headers.get("content-length") || 0);
  if (len > MAX_BYTES) return fail("Page too large");
  const raw = (await res.text()).slice(0, MAX_BYTES);
  const { title, text } = /text\/plain/i.test(type) ? { title: url, text: raw } : htmlToText(raw);
  const clipped = text.slice(0, MAX_CHARS);
  if (clipped.length < 200) return { ...fail("Too little readable text on the page"), title };
  return { id, url, title: title || url, fetchedAt, chars: clipped.length, sha256: await sha256(clipped), ok: true, text: clipped };
}
