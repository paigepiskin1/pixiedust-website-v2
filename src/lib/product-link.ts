// Inspect a product page URL: SSRF-safe fetch, extract candidate images +
// fit/product details, optionally re-host images to Bunny.
import { uploadToBunny } from "./bunny";
import { assertSafeHttpUrl, assertSafeRedirect } from "./safe-url";

export interface ProductImage {
  /** Bunny-hosted URL ready to use as an outfit input. */
  url: string;
  /** Original remote URL (for debugging / provenance). */
  sourceUrl: string;
  width?: number;
  height?: number;
}

export interface ProductFitDetails {
  title?: string;
  brand?: string;
  price?: string;
  description?: string;
  sizes?: string[];
  colors?: string[];
  material?: string;
  fitNotes?: string[];
}

export interface ProductLinkInspect {
  pageUrl: string;
  images: ProductImage[];
  details: ProductFitDetails;
}

interface BunnyEnv {
  BUNNY_STORAGE_ZONE: string;
  BUNNY_API_KEY: string;
  BUNNY_PULL_ZONE_URL: string;
}

const MAX_HTML_BYTES = 1_500_000;
const MAX_IMAGE_BYTES = 12 * 1024 * 1024;
const MAX_REDIRECTS = 3;
const MAX_IMAGES = 8;
const FETCH_MS = 12_000;
const IMAGE_FETCH_MS = 10_000;
const UA =
  "Mozilla/5.0 (compatible; PixieDustBot/1.0; +https://pixiedustapp.com) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36";

async function safeFetch(
  start: URL,
  opts: { accept: string; maxBytes: number; timeoutMs: number }
): Promise<{ url: URL; contentType: string; body: ArrayBuffer }> {
  let current = start;
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), opts.timeoutMs);
    let res: Response;
    try {
      res = await fetch(current.toString(), {
        method: "GET",
        redirect: "manual",
        signal: ctrl.signal,
        headers: {
          Accept: opts.accept,
          "User-Agent": UA,
          "Accept-Language": "en-US,en;q=0.9",
        },
      });
    } catch (err) {
      clearTimeout(timer);
      if ((err as Error)?.name === "AbortError") throw new Error("That site took too long to respond.");
      throw new Error("Couldn’t reach that link.");
    } finally {
      clearTimeout(timer);
    }

    if ([301, 302, 303, 307, 308].includes(res.status)) {
      const loc = res.headers.get("Location");
      if (!loc) throw new Error("Redirect blocked.");
      const next = assertSafeRedirect(loc, current);
      if (!next.ok) throw new Error(next.error);
      current = next.url;
      continue;
    }

    if (!res.ok) throw new Error(`That page returned an error (${res.status}).`);

    const contentType = (res.headers.get("Content-Type") || "").split(";")[0].trim().toLowerCase();
    const len = Number(res.headers.get("Content-Length") || 0);
    if (len && len > opts.maxBytes) throw new Error("That file is too large.");

    const buf = await res.arrayBuffer();
    if (buf.byteLength > opts.maxBytes) throw new Error("That file is too large.");

    return { url: current, contentType, body: buf };
  }
  throw new Error("Too many redirects.");
}

function decodeHtml(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCharCode(parseInt(n, 16)));
}

function absUrl(href: string, base: URL): string | null {
  try {
    const u = new URL(decodeHtml(href.trim()), base);
    if (u.protocol !== "https:") return null;
    return u.toString();
  } catch {
    return null;
  }
}

function metaContent(html: string, ...keys: string[]): string | undefined {
  for (const key of keys) {
    const re = new RegExp(
      `<meta[^>]+(?:property|name)=["']${key}["'][^>]+content=["']([^"']+)["']`,
      "i"
    );
    const re2 = new RegExp(
      `<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']${key}["']`,
      "i"
    );
    const m = html.match(re) || html.match(re2);
    if (m?.[1]) return decodeHtml(m[1]).trim();
  }
  return undefined;
}

function titleTag(html: string): string | undefined {
  const m = html.match(/<title[^>]*>([^<]{1,200})<\/title>/i);
  return m?.[1] ? decodeHtml(m[1]).trim() : undefined;
}

function collectJsonLd(html: string): any[] {
  const out: any[] = [];
  const re = /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) {
    try {
      const parsed = JSON.parse(m[1].trim());
      if (Array.isArray(parsed)) out.push(...parsed);
      else out.push(parsed);
    } catch {
      /* ignore bad JSON-LD blocks */
    }
  }
  return out;
}

function walkJsonLd(nodes: any[], visit: (n: any) => void) {
  for (const n of nodes) {
    if (!n || typeof n !== "object") continue;
    visit(n);
    if (Array.isArray(n["@graph"])) walkJsonLd(n["@graph"], visit);
  }
}

function isProductType(t: unknown): boolean {
  const s = Array.isArray(t) ? t.join(" ") : String(t || "");
  return /product/i.test(s);
}

function pushUnique(list: string[], url: string | null | undefined, limit = 24) {
  if (!url || list.includes(url) || list.length >= limit) return;
  // Skip obvious non-product assets
  if (/\.(svg)(?:$|\?)/i.test(url)) return;
  if (/sprite|icon|logo|favicon|pixel|tracking|1x1|spacer/i.test(url)) return;
  list.push(url);
}

function extractImageCandidates(html: string, base: URL): string[] {
  const urls: string[] = [];

  for (const key of ["og:image", "og:image:secure_url", "twitter:image", "twitter:image:src"]) {
    const v = metaContent(html, key);
    if (v) pushUnique(urls, absUrl(v, base));
  }

  walkJsonLd(collectJsonLd(html), (n) => {
    if (!isProductType(n["@type"]) && !n.image) return;
    const img = n.image;
    if (typeof img === "string") pushUnique(urls, absUrl(img, base));
    else if (Array.isArray(img)) {
      for (const item of img) {
        if (typeof item === "string") pushUnique(urls, absUrl(item, base));
        else if (item && typeof item === "object" && typeof item.url === "string") {
          pushUnique(urls, absUrl(item.url, base));
        }
      }
    } else if (img && typeof img === "object" && typeof img.url === "string") {
      pushUnique(urls, absUrl(img.url, base));
    }
  });

  // Common product <img> patterns (Shopify, generic ecommerce)
  const imgRe =
    /<img[^>]+(?:src|data-src|data-original|data-zoom-image)=["']([^"']+)["'][^>]*>/gi;
  let m: RegExpExecArray | null;
  while ((m = imgRe.exec(html))) {
    const u = absUrl(m[1], base);
    if (!u) continue;
    if (!/\.(jpe?g|png|webp|gif)(?:$|\?)/i.test(u) && !/cdn\.|images\.|media\.|cloudinary|imgix|shopify/i.test(u)) {
      continue;
    }
    pushUnique(urls, u);
  }

  // srcset first candidate
  const srcsetRe = /srcset=["']([^"']+)["']/gi;
  while ((m = srcsetRe.exec(html))) {
    const first = m[1].split(",")[0]?.trim().split(/\s+/)[0];
    if (first) pushUnique(urls, absUrl(first, base));
  }

  return urls;
}

function extractFitDetails(html: string, pageUrl: URL): ProductFitDetails {
  const details: ProductFitDetails = {};
  details.title = metaContent(html, "og:title", "twitter:title") || titleTag(html);
  details.description = metaContent(html, "og:description", "twitter:description", "description");

  walkJsonLd(collectJsonLd(html), (n) => {
    if (!isProductType(n["@type"])) return;
    if (!details.title && typeof n.name === "string") details.title = n.name;
    if (!details.brand) {
      if (typeof n.brand === "string") details.brand = n.brand;
      else if (n.brand && typeof n.brand.name === "string") details.brand = n.brand.name;
    }
    if (!details.description && typeof n.description === "string") {
      details.description = n.description.slice(0, 600);
    }
    if (!details.material && typeof n.material === "string") details.material = n.material;
    if (n.offers) {
      const offer = Array.isArray(n.offers) ? n.offers[0] : n.offers;
      if (offer) {
        const price = offer.price ?? offer.lowPrice;
        const currency = offer.priceCurrency || "";
        if (price != null) details.price = `${currency ? currency + " " : ""}${price}`.trim();
      }
    }
    // size / color variants
    const sizes = new Set<string>();
    const colors = new Set<string>();
    const variants = Array.isArray(n.hasVariant) ? n.hasVariant : [];
    for (const v of variants) {
      if (typeof v?.size === "string") sizes.add(v.size);
      if (typeof v?.color === "string") colors.add(v.color);
    }
    if (typeof n.size === "string") sizes.add(n.size);
    if (typeof n.color === "string") colors.add(n.color);
    if (sizes.size) details.sizes = Array.from(sizes).slice(0, 20);
    if (colors.size) details.colors = Array.from(colors).slice(0, 12);
  });

  // Heuristic fit/size notes from visible text chunks
  const text = html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .slice(0, 20_000);

  const notes: string[] = [];
  const patterns = [
    /fit[:\s]+([^.!?\n]{8,120})/i,
    /sizing[:\s]+([^.!?\n]{8,120})/i,
    /model is (?:wearing|wears) ([^.!?\n]{4,80})/i,
    /runs (true to size|small|large|big)[^.!?\n]{0,60}/i,
    /composition[:\s]+([^.!?\n]{8,120})/i,
    /fabric[:\s]+([^.!?\n]{8,100})/i,
    /material[:\s]+([^.!?\n]{8,100})/i,
  ];
  for (const re of patterns) {
    const m = text.match(re);
    if (m) {
      const note = (m[0].length < 140 ? m[0] : m[1] || m[0]).trim();
      if (note && !notes.some((n) => n.toLowerCase() === note.toLowerCase())) notes.push(note);
    }
  }
  if (notes.length) details.fitNotes = notes.slice(0, 6);

  if (!details.material) {
    const mat = text.match(/(?:composition|fabric|material)[:\s]+([A-Za-z0-9%,\-\/\s]{8,100})/i);
    if (mat?.[1]) details.material = mat[1].trim();
  }

  // Prefer page host as brand fallback
  if (!details.brand) {
    const host = pageUrl.hostname.replace(/^www\./, "");
    details.brand = host.split(".")[0]?.replace(/-/g, " ");
  }

  // Clean empty strings
  for (const k of Object.keys(details) as (keyof ProductFitDetails)[]) {
    const v = details[k];
    if (typeof v === "string" && !v.trim()) delete details[k];
  }
  return details;
}

function sniffImageType(buf: ArrayBuffer, contentType: string): { mime: string; ext: string } | null {
  const u8 = new Uint8Array(buf.slice(0, 16));
  if (u8[0] === 0xff && u8[1] === 0xd8) return { mime: "image/jpeg", ext: "jpg" };
  if (u8[0] === 0x89 && u8[1] === 0x50 && u8[2] === 0x4e && u8[3] === 0x47) return { mime: "image/png", ext: "png" };
  if (u8[0] === 0x47 && u8[1] === 0x49 && u8[2] === 0x46) return { mime: "image/gif", ext: "gif" };
  if (u8[0] === 0x52 && u8[1] === 0x49 && u8[2] === 0x46 && u8[3] === 0x46) return { mime: "image/webp", ext: "webp" };
  if (/^image\/(jpeg|jpg|png|webp|gif)$/i.test(contentType)) {
    const mime = contentType.toLowerCase().replace("image/jpg", "image/jpeg");
    const ext = mime === "image/jpeg" ? "jpg" : mime.split("/")[1];
    return { mime, ext };
  }
  return null;
}

async function rehostImage(
  env: BunnyEnv,
  uid: string,
  sourceUrl: string
): Promise<ProductImage | null> {
  const safe = assertSafeHttpUrl(sourceUrl);
  if (!safe.ok) return null;
  try {
    const { body, contentType, url } = await safeFetch(safe.url, {
      accept: "image/avif,image/webp,image/apng,image/*,*/*;q=0.8",
      maxBytes: MAX_IMAGE_BYTES,
      timeoutMs: IMAGE_FETCH_MS,
    });
    const sniffed = sniffImageType(body, contentType);
    if (!sniffed) return null;
    // Tiny images are almost never product shots
    if (body.byteLength < 4_000) return null;
    const path = `uploads/${uid}/product-link/${crypto.randomUUID()}.${sniffed.ext}`;
    const hosted = await uploadToBunny(env, path, body, sniffed.mime);
    return { url: hosted, sourceUrl: url.toString() };
  } catch {
    return null;
  }
}

/**
 * Inspect a product URL: validate, fetch HTML (or direct image), extract fit
 * details + candidate images, re-host images to Bunny for the signed-in user.
 */
export async function inspectProductLink(
  env: BunnyEnv,
  uid: string,
  rawUrl: string
): Promise<ProductLinkInspect> {
  const safe = assertSafeHttpUrl(rawUrl);
  if (!safe.ok) throw new Error(safe.error);

  const fetched = await safeFetch(safe.url, {
    accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/*;q=0.8,*/*;q=0.7",
    maxBytes: MAX_HTML_BYTES,
    timeoutMs: FETCH_MS,
  });

  // Direct image link — skip HTML parsing
  if (/^image\//i.test(fetched.contentType) || sniffImageType(fetched.body, fetched.contentType)) {
    const sniffed = sniffImageType(fetched.body, fetched.contentType);
    if (!sniffed) throw new Error("That link isn’t a supported image.");
    if (fetched.body.byteLength < 4_000) throw new Error("That image is too small to use.");
    const path = `uploads/${uid}/product-link/${crypto.randomUUID()}.${sniffed.ext}`;
    const hosted = await uploadToBunny(env, path, fetched.body, sniffed.mime);
    return {
      pageUrl: fetched.url.toString(),
      images: [{ url: hosted, sourceUrl: fetched.url.toString() }],
      details: { title: "Product image", fitNotes: ["Direct image link — no fit details on the page."] },
    };
  }

  if (!/text\/html|application\/xhtml\+xml/i.test(fetched.contentType) && fetched.contentType) {
    // Some shops serve HTML without a proper content-type; only reject clear non-HTML binaries.
    if (/^(application|audio|video|font)\//i.test(fetched.contentType) && !/json/i.test(fetched.contentType)) {
      throw new Error("That link doesn’t look like a product page.");
    }
  }

  const html = new TextDecoder("utf-8", { fatal: false }).decode(fetched.body);
  if (html.length < 40) throw new Error("That page was empty.");

  const details = extractFitDetails(html, fetched.url);
  const candidates = extractImageCandidates(html, fetched.url).slice(0, 16);
  if (!candidates.length) {
    throw new Error("We couldn’t find any product photos on that page.");
  }

  const images: ProductImage[] = [];
  for (const src of candidates) {
    if (images.length >= MAX_IMAGES) break;
    const hosted = await rehostImage(env, uid, src);
    if (hosted) images.push(hosted);
  }

  if (!images.length) {
    throw new Error("We found image links but couldn’t securely download any of them.");
  }

  return {
    pageUrl: fetched.url.toString(),
    images,
    details,
  };
}
