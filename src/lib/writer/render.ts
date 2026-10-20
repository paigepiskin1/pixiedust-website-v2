// Turns a writer draft into item HTML. The model never writes markup: it
// returns typed blocks, and this file is the only place HTML is produced, so
// the output can only contain h2/h3/p/ul/ol/li/blockquote/strong/a with an
// href we resolved ourselves. Claims, evidence ids and review notes live on
// the job and have no path into the page.
import type { Block, Draft, LinkSuggestion } from "./types";

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");

interface Seg {
  text: string;
  bold: boolean;
}

/** Split "**bold**" markers into segments. An unpaired marker is literal. */
function segments(text: string): Seg[] {
  const out: Seg[] = [];
  const re = /\*\*([^*]+?)\*\*/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push({ text: text.slice(last, m.index), bold: false });
    out.push({ text: m[1], bold: true });
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push({ text: text.slice(last), bold: false });
  return out;
}

/** Text as a reader sees it, without bold markers. Anchors are matched here. */
export const plain = (text: string) => segments(text).map((s) => s.text).join("");

/** Where an anchor sits in a piece of text: exact first, then ignoring case. */
export function findAnchor(text: string, anchor: string): number {
  const p = plain(text);
  const a = anchor.trim();
  if (!a) return -1;
  const exact = p.indexOf(a);
  return exact >= 0 ? exact : p.toLowerCase().indexOf(a.toLowerCase());
}

/** Inline text with an optional link over [start, end) of the plain text. A
 *  bold run the link only partly covers loses its bold, so tags never cross. */
function inline(text: string, link?: { start: number; end: number; href: string }): string {
  const segs = segments(text);
  let pos = 0;
  let html = "";
  let open = false;
  for (const s of segs) {
    const a = pos;
    const b = pos + s.text.length;
    pos = b;
    const overlaps = link && link.start < b && link.end > a;
    const covered = link && link.start <= a && link.end >= b;
    const bold = s.bold && (!overlaps || covered);
    const wrap = (t: string) => (bold ? `<strong>${esc(t)}</strong>` : esc(t));
    if (!link || !overlaps) {
      html += wrap(s.text);
      continue;
    }
    const cut1 = Math.max(link.start, a) - a;
    const cut2 = Math.min(link.end, b) - a;
    if (cut1 > 0) html += wrap(s.text.slice(0, cut1));
    if (!open) {
      html += `<a href="${esc(link.href)}">`;
      open = true;
    }
    html += wrap(s.text.slice(cut1, cut2));
    if (link.end <= b) {
      html += "</a>";
      open = false;
      if (cut2 < s.text.length) html += wrap(s.text.slice(cut2));
    }
  }
  if (open) html += "</a>";
  return html;
}

function linked(text: string, anchor: string | undefined, href: string | undefined): string {
  if (!anchor || !href) return inline(text);
  const at = findAnchor(text, anchor);
  if (at < 0) return inline(text);
  return inline(text, { start: at, end: at + anchor.trim().length, href });
}

export const blockLabel = (i: number) => `b${i}`;

/** The text of a block, list items included, as plain text. */
export function blockText(b: Block): string {
  return plain([b.text, ...(b.items ?? [])].filter(Boolean).join("\n"));
}

export interface RenderOptions {
  /** Accepted links only, with their resolved URLs. */
  links: Pick<LinkSuggestion, "where" | "anchor" | "url">[];
  /** Resolved URL for the next step's link target, or null to leave it unlinked. */
  nextStepUrl: string | null;
}

export function renderArticle(draft: Draft, opts: RenderOptions): string {
  const byBlock = new Map<string, { anchor: string; url: string }>();
  for (const l of opts.links) if (l.url && !byBlock.has(l.where)) byBlock.set(l.where, { anchor: l.anchor, url: l.url });

  const parts: string[] = [];
  draft.blocks.forEach((b, i) => {
    const link = byBlock.get(blockLabel(i));
    switch (b.type) {
      case "h2":
      case "h3":
        // Headings never carry links, whatever the suggestion said.
        parts.push(`<${b.type}>${inline(b.text)}</${b.type}>`);
        break;
      case "ul":
      case "ol": {
        let used = false;
        const items = (b.items ?? []).filter((t) => t.trim()).map((t) => {
          if (link && !used && findAnchor(t, link.anchor) >= 0) {
            used = true;
            return `<li>${linked(t, link.anchor, link.url)}</li>`;
          }
          return `<li>${inline(t)}</li>`;
        });
        if (b.text.trim()) parts.push(`<p>${inline(b.text)}</p>`);
        if (items.length) parts.push(`<${b.type}>${items.join("")}</${b.type}>`);
        break;
      }
      case "quote":
        parts.push(`<blockquote><p>${linked(b.text, link?.anchor, link?.url)}</p></blockquote>`);
        break;
      default:
        if (b.text.trim()) parts.push(`<p>${linked(b.text, link?.anchor, link?.url)}</p>`);
    }
  });
  if (draft.next_step?.text?.trim()) {
    parts.push(`<p>${linked(draft.next_step.text, draft.next_step.anchor, opts.nextStepUrl ?? undefined)}</p>`);
  }
  return parts.join("\n");
}

/** The whole article as plain text, for word counts and keyword checks. */
export function articleText(draft: Draft): string {
  return [...draft.blocks.map(blockText), plain(draft.next_step?.text ?? "")].join("\n");
}
