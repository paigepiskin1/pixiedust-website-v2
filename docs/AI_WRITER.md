# AI Writer

Admin → AI Writer (`/admin/writer`). It writes grounded draft articles for Items with Claude Opus 5.5 (OpenRouter, through SyncNode), checks them, suggests internal links, makes a header image, and saves the result as a **draft** item. Nothing is published from here. Publishing stays in the item editor.

## Architecture

```
Admin page (/admin/writer/<job>)                      Server (Pages Function, /api/admin/writer)
  └─ asks for the next stage ──────────────────────▶  runStage(): lease → spend check → stage → save job
     one request per stage, while the page is open      │
                                                        ├─ research  fact sheet (D1 ai_facts) + approved source URLs fetched server-side
                                                        ├─ write     SyncNode /chat-completion → anthropic/claude-opus-5.5 (structured JSON)
                                                        ├─ audit     Opus fact check: every product claim → supported / unsupported / contradicted
                                                        │            + deterministic checks (validate.ts)
                                                        ├─ revise    Opus fixes only what the audit found (once), then audit runs again
                                                        ├─ links     Opus suggests links to stable ids from the live inventory
                                                        └─ image     SyncNode /generate (Replicate seedream-4) → Bunny Optimizer crop to
                                                                     1200×630 JPEG → media/blog/<readable-name>.jpg → SyncNode moderation
Review panel: fields, preview, image, links (accept / remove / replace), claims + sources, validation, costs, versions, log
Save as draft → blog_posts (status 'draft', published_at NULL, ai_job_id) → Items → Drafts → editor → Publish (existing flow)
```

- **Background jobs.** Job state lives in D1 (`ai_jobs`). The review page runs one stage per request until the job is done. If the tab closes, the job stops where it is and carries on when reopened. A Pages Function can't run work after its response is sent, so there is no worker queue. A stage holds a lease (`lock_until`). A second tab or a double-click gets "already running" instead of making a second paid call.
- **Retries.** Each stage retries on its own: writing, image and links separately. Re-running Write also redoes the fact check, revision and links, because those were made on the old text. It keeps the image and the admin's field edits.
- **No overwrites without consent.** Field edits made in review are stored apart from the AI draft (`edits_json`), so re-runs never replace them. Saving into a draft that was edited in the item editor afterwards returns a conflict, and goes ahead only on an explicit "replace". The item as it stood is kept in `ai_versions`. A published or scheduled item is refused outright.
- **Grounding.** The writer gets the approved fact sheet (`ai_facts`, status `approved`), the "needs review" facts labeled DO NOT STATE, any admin-required facts, and fetched sources wrapped in `<source>` tags. Those tags are declared data, not instructions. Every product claim must cite an evidence id, and the writer lists what it couldn't support in `missing_evidence`. The audit re-checks every claim against the same evidence.
- **Retrieval.** Only URLs on approved domains are fetched (Settings → Source domains; default `pixydust.com`, `pixiedustapp.com`). Each fetch is recorded with its URL, time, size and the SHA-256 of the text given to the model. The page for each selected PixyDust tool is fetched automatically. There is no open web search.
- **No drafting notes in public content.** The model returns typed blocks (`p`, `h2`, `h3`, `ul`, `ol`, `quote`), never HTML. `render.ts` is the only code that writes markup, and claims, evidence ids and notes have no path into it. `validate.ts` also fails a draft containing fact ids, link ids, bracketed placeholders or model chatter.
- **SEO.** One H1 (the page title), with H2/H3 order checked. The SEO title, meta description, slug, excerpt, tags and sub-category are reviewed in the panel. `blog_posts.seo_title` and `meta_description` are new; when empty, the page falls back to the title and excerpt as before. The canonical URL, BlogPosting and breadcrumb markup are the existing ones. A taken slug saves as `-2` and says so. The writer never edits a published item, so it can't change a live permalink. Keyword stuffing is flagged above 2.5% density. No ranking promises or search-volume figures.
- **Links.** The inventory covers live items (`item-<id>`), tool and site pages (`page-*`), section index pages and published Help Center articles. Only ids go to the model. A suggestion is dropped at once if its target isn't live, it links to the article itself, its anchor text isn't in the paragraph, it sits in a heading, or it duplicates another link. Ids resolve to canonical URLs again at save time. Only links an editor accepted go into the draft.
- **Image.** One original image, sized 2400×1260 so the 1.91:1 crop loses nothing. The prompt carries the visual guidelines: no text, logos, UI or collages, and blue/cyan accents where they suit. The final file is a 1200×630 JPEG (about 100 KB) with a readable filename. It populates the thumbnail, og:image and alt text, and is listed in the media library. Pages request responsive variants through Bunny Optimizer (`?width=480/768/1200` in `srcset`). The prompt, model, provider job id, original file and moderation result are kept on the job. A screenshot can replace the generated image and goes through the same crop and compression.
- **Credentials.** `SYNCNODE_API_KEY` is a server secret. SyncNode holds the OpenRouter and Replicate keys. Every endpoint checks admin access (session or `ADMIN_API_TOKEN`).
- **Spending.** Per-article and monthly limits (Settings; default $3 and $30). A stage that would cross either limit doesn't start. Spend counts each response's own reported cost (`usage.cost`) plus SyncNode's documented $0.02 per call. SyncNode's response has reported `cost: 0`, so the documented fee is counted to stay on the safe side.
- **Configurable providers.** Model, effort and max tokens per stage; the image provider, model and input; the visual guidelines. All are in Settings, with no deploy needed.

## Services

| Service | Used for | Already in place |
| --- | --- | --- |
| SyncNode `/chat-completion` → OpenRouter → `anthropic/claude-opus-5.5` | write, audit, revise, links | yes (`SYNCNODE_API_KEY`; OpenRouter key on SyncNode) |
| SyncNode `/generate` → Replicate `bytedance/seedream-4` | header image | yes (Replicate key on SyncNode) |
| SyncNode moderation | image check | yes |
| Bunny storage + pull zone (Bunny Optimizer on) | final image file, responsive variants | yes |
| Cloudflare D1 | jobs, facts, topics, usage, versions, log | yes (new tables, `scripts/migration-ai-writer.sql`) |

## Cost per article (measured)

From the first full runs (Opus 5.5 at $4 / $20 per million tokens):

| Stage | Tokens in / out | Cost |
| --- | --- | --- |
| Write (high effort) | ~12k / ~10k (6k reasoning) | $0.26 + $0.02 |
| Fact check, two rounds | ~10k / ~2.5k each | $0.19 + $0.04 |
| Revision (when needed) | ~17k / ~6k | $0.17 + $0.02 |
| Links | ~7k / ~1k | $0.03 + $0.02 |
| Image + moderation | | $0.03 + $0.02 + $0.005 |
| **Total** | | **about $0.80** ($0.55 when no revision is needed) |

The pre-flight estimate is $0.86. A full write takes about 2 to 3 minutes; the whole job takes about 5.

## Fact sheet

Seeded with 40 approved facts and 13 "needs review" by `scripts/seed-ai-facts.sql`, from the live site, code and templates table. Edit them in Admin → AI Writer → Fact sheet. Facts the site contradicts itself on are seeded as "needs review" so the writer can't use them:

- AR experiences created: "300+" vs "more than 100" (About page)
- Photoshoot styles: "100+ styles" and "12–30 frames" on /shoots vs 59 live styles making 1–4 images per run
- Preset count ("120+", "100+", "86+") and preset cost (page says 2 credits, live presets cost 3–5)
- Credit expiry: the Help Center says top-ups never expire; the Terms and the code say add-on credits expire after 90 days
- Refunds: automatic per the Help Center, discretionary per the Terms
- Training on uploads: "not by default" (Privacy) vs "may use to develop, train" (Terms 6.1)
- Referrer rewards: the Help Center says both sides earn; the code rewards the new user only
- iPhone app: no store listing on the site, but a live article ("Meet the New PixyDust for iPhone") describes one
- Taglines: "Imagine. Create. Magnify." vs "Imagine. Create. Captivate."
- Unverified: 3M+ followers, the partner logo wall, the "Featured in" list

Facts nobody has stated yet, which articles will keep running into:

- Photoshoots: recommended photo resolution, format and size; how long uploaded reference photos (not generations) are kept; official guidance on photo quality; how With Friends styles handle a second person; turnaround time
- Subscription plan names, prices, monthly credits and subscriber discount (they exist only in D1)
- Whether outputs are watermarked
- Video lengths and output resolutions per model; upload limits per tool
- Current mobile app status, and whether app and web share accounts and credits
