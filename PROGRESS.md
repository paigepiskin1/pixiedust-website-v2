# PixieDust Rebuild — Progress Log

> Running log of decisions, phase status, and open questions so any session can resume cleanly.
> **Read this first each session.** Credentials live in `CLAUDE.local.md` (gitignored).

---

## Mission

Rebuild the legacy PHP/jQuery site at `C:\xampp\htdocs\pixiedustweb` as a modern
**Astro + Tailwind** app on **Cloudflare** (Pages + Workers + D1 + KV + R2), with all
generation through **SyncNode.ai** and user media delivered via **Bunny.net CDN**.
Implements the new design at `C:\xampp\htdocs\Pixiedust APP  DESIGN ONLY- v2`
(note the **double space** in the folder name). Adds an admin backend.

Online design reference (same as the local folder; needs Anthropic auth to view):
`https://api.anthropic.com/v1/design/h/3s1UrvlzDdHQkTTFBa43gA?open_file=PixieDust+Web.html`

---

## Locked decisions (2026-05-26)

| Area | Decision |
|---|---|
| Framework | **Astro + Tailwind** on Cloudflare Pages (chosen over the PRD's Next.js 15) |
| Backend | Cloudflare **Workers** |
| Database | Cloudflare **D1** |
| Cache / sessions / rate-limits | Cloudflare **KV** |
| System assets | Cloudflare **R2** |
| User media | **Bunny.net CDN** via SyncNode (pull zone `pixiecdn.b-cdn.net`) |
| Generation | **All** via SyncNode.ai (Replicate/FAL/Alibaba/OpenAI behind one key). Polling only, no webhooks. |
| Auth | **Firebase** (reuse existing). Methods: **Google + email/password + Apple**. Password UI (NOT the design's magic-link). Apple is net-new. |
| Payments | Existing **Stripe** account |
| Migration | **User accounts + credit balances ONLY** — old media/albums/history NOT migrated (clean content start) |
| Dropped | **Model training** (LoRA) feature — excluded entirely |

### Template system (improved from old site)
Carry over the old dynamic-placeholder template model, improved:
- **Structured `fields[]` + `{{key}}` refs** — params JSON stays clean with `{{key}}`
  placeholders; a separate `fields[]` array holds label/help/default/options/min-max/accept.
- **Single provider payload** — one `provider` enum (replicate/fal/alibaba/openai) + one
  `model` + one `input` block. Everything routes through SyncNode (no dual param blocks).
- **Pricing** = `credit_cost × quantity × qualityMultiplier` (Std/Pro/Cinema), server-side.
- **Workspace hints** — template carries `kind`, `engine`, `eta`, allowed `aspects`/`quantities`.
- **Multi-step templates** — ordered `steps[]` (each with its own `fields[]`) so the rich
  Ad/Avatar/Fashion studios are also admin-editable, incl. chained generation stages.
- Worker **validates** user inputs against the field schema before merging (fixes old IDOR/client-trust).
- Re-implement the old "AI Convert" helper (paste raw provider JSON → auto-insert placeholders).

---

## Phase plan

| # | Phase | Status |
|---|---|---|
| 0 | Discovery + plan | ✅ Done |
| 1 | Scaffold (Astro/Tailwind/CF, bindings stub, archive demo) | ✅ Done |
| 2 | Design system + app shell | ✅ Done |
| 3 | Public/static pages | ✅ Done |
| 4 | Auth (Firebase: Google/email+password/Apple) | ✅ Done |
| 5 | Data model + template system (D1) | ✅ Done |
| 6 | Generation pipeline (Worker → SyncNode → Bunny) | ✅ Done |
| 7 | User features (gallery, account) | ✅ Done |
| 8 | Admin backend (templates, users, content, moderation) | ✅ Done |
| 9 | Monetization (Stripe subs + credit packs, ledger, audit) | ✅ Done |
| 10 | Migration (user accounts + balances) | ✅ Done |
| 11 | Deploy + hardening | ⬜ |

---

## Open questions (need answers before the noted phase)

- **Firebase console (before live auth testing):** the existing `pixie-dust-apps` project already
  has Google + email/password enabled (old site used them). For full end-to-end on the new site:
  (1) add the deployed origin (and `localhost` for dev) to Firebase **Authorized domains**;
  (2) enable the **Apple** provider (net-new — needs an Apple Service ID + key). Until then,
  Google/email work where the project allows; Apple sign-in will error `auth/operation-not-allowed`.
  NOTE: I have NOT created test accounts in the production Firebase project — live sign-in is the
  user's call (it writes real users). The code path is built + the session/me/account plumbing is
  verified locally with the D1/KV bindings.
- **Stripe keys (Phase 9):** still NOT in `CLAUDE.local.md`; hardcoded in old `back/config.php`.
  Pull into Wrangler secrets with user OK. Never commit.
- **Pricing (Phase 9):** subscription tiers + credit-pack SKUs still TBD. PRD reference:
  Free $0 / Plus $15 / Studio $45; top-ups Starter 100cr/$8, Creator 500cr/$32, Pro 2000cr/$96;
  non-subscriber ~5× multiplier (unconfirmed). Rollover & grandfathering policy TBD.
- **Admin scope (Phase 8):** confirm full feature list beyond templates/users/content/monetization
  (old site also had a Telegram-message inbox + email export).
- **Domain:** same `web.pixiedustapp.com` or new? (Phase 11)

---

## Reference: where the audit details live

The full old-site functional inventory and the design audit were produced during discovery
(see conversation history / commit messages). Key facts:

- **Old site:** PHP/jQuery/MySQL at `web.pixiedustapp.com`. Front-controller `index.php`.
  Firebase auth (Google + email/pw). Credit balance (`users.balance`) with refund-on-failure.
  Stripe subs (Lite $9 / Premium $29) + credit packs. Legacy admin panel (template CRUD with
  per-template `token_cost`, media moderation, user/email export) + "overview" message inbox.
  Existing `templates` table already has `sync_node`, `syncnode_model`, `syncnode_params`,
  `replicate_model`, `replicate_params`, `token_cost`, `tag_ids`, `is_featured`, `is_hidden`.
- **Design:** logged-in desktop creative studio. Shell = 232px sidebar + 64px topbar. Screens:
  Home, Trending, Gallery, Presets, Shoots, Video, Motion, Beauty, + Ad/Avatar/Fashion studios,
  the 3-column Workspace (core generation screen), Search, Account, Credits, Legal, Auth.
  Tokens: Space Grotesk (display) / JetBrains Mono (labels) / system sans (body); dark default +
  light; lilac primary accent. The v1–v4 files are undecided MARKETING-site concepts (out of scope).

---

## Phase notes / gotchas

- **Astro pinned to v5** (5.18.2), not v6 — local Node is v20.10.0 and Astro 6 needs a newer
  Node. Cloudflare adapter pinned to v12. Tailwind **v4** via `@tailwindcss/vite`.
- **Design tokens** live in `src/styles/global.css` as `--pd-*` CSS vars (dark default +
  `[data-theme="light"]`), exposed to Tailwind via `@theme` → utilities like `bg-surface`,
  `text-ink-2`, `text-accent`, `font-display`, `border-hairline`. Theme persists to
  `localStorage['pd-web-theme']`; restored before paint by an inline script in `Base.astro`.
- **astro check** had a false-positive Vite duplicate-type error on the Tailwind plugin;
  resolved with a `/** @type {any} */` cast in `astro.config.mjs`. Runtime is unaffected.
- **Sessions binding:** the CF adapter expects a KV binding named `SESSION` for Astro's built-in
  sessions. Our wrangler binding is `SESSIONS` (for our own logic). Reconcile in Phase 4 — either
  rename or add a dedicated `SESSION` binding.
- **wrangler.toml** bindings (DB/SESSIONS/ASSETS_BUCKET) have PLACEHOLDER ids — create real
  resources before remote deploy. Dev uses local miniflare stand-ins via `platformProxy`.
- Demo (fairy-kitty) archived under `/sandbox` (its own package.json + .env, gitignored).

## Changelog

- **2026-05-26** — Discovery complete. Audited old site, new design, SyncNode docs. Locked stack,
  auth, migration, and template-system decisions.
- **2026-05-26** — Phase 1 done. Astro 5 + Tailwind v4 + CF adapter scaffolded; design tokens
  wired and verified in dark+light; wrangler bindings stubbed; demo archived; build + type-check green.
- **2026-05-26** — Phase 2 done. App shell ported to Astro: `Sidebar`/`Topbar`/`MobileDrawer`
  (in `src/components/shell/`), `AppShell.astro` layout, UI atoms `Media`/`Pill`/`CreditChip`/`Dot`/
  `Toast` (in `src/components/ui/`), shared nav model `src/lib/nav.ts`. MPA approach: nav uses real
  `<a>` links, active state from `Astro.url.pathname`. Sidebar collapse + theme persist to
  localStorage, restored pre-paint in `Base.astro`. Verified desktop/collapsed/mobile in both themes.
- **2026-05-27** — Phase 10 done. User migration. `scripts/migrate-users.ts` (run via tsx) connects
  to the legacy RDS MySQL (creds via env, never committed), selects users **with balance > 0**
  (per decision — skip zero-balance accounts), maps old→new schema, and emits idempotent upsert SQL
  keyed by **Firebase uid** so identity + balance carry over. Generated `seed/migrate-users.sql`
  (**gitignored — contains PII**). Applied to local D1: **18 users migrated** with real balances
  preserved (e.g. 52,772 cr). Returning users sign in via Firebase → same uid → the login upsert
  preserves their migrated balance (doesn't reset to the 5-credit default). To migrate prod, run the
  same script then `wrangler d1 execute pixiedust --remote --file=seed/migrate-users.sql` (one-time,
  pre-launch). Added `mysql2` devDep. Committed the script only — no creds, no PII.
- **2026-05-27** — Phase 9 done. Monetization via Stripe. `src/lib/stripe.ts` (REST checkout with
  dynamic price_data — no pre-created products; Web Crypto webhook signature verify). `POST /api/
  billing/checkout` (pack=payment, sub=subscription; subscriber pack pricing if active sub).
  `POST /api/billing/webhook` (verifies sig; checkout.session.completed → pack credit / sub row +
  initial grant; invoice.paid subscription_cycle → renewal grant; subscription.deleted → cancel;
  idempotent by session/invoice id via the ledger). `/credits` page renders tiers + packs from D1.
  VERIFIED: checkout returns a real `cs_test_...` Stripe URL; a signed simulated webhook credited
  the ledger (1000→1100, reason=purchase) and a duplicate was rejected. Using **TEST** Stripe keys
  in `.dev.vars`. NOTE: live webhook delivery to localhost needs the Stripe CLI (`stripe listen`);
  in prod set the webhook endpoint + LIVE keys in Pages env. Old code also has LIVE keys in
  `back/config.php`.
- **2026-05-27** — Phase 8 done. Admin backend (gated by `locals.user.isAdmin`, `AdminShell` chrome).
  `/admin` dashboard (template/user/generation/credit stats). `/admin/templates` list + editor
  (`/admin/templates/edit/[id]`, new+edit) covering the full schema incl. input_json/fields_json/
  steps_json with JSON validation + a "scaffold fields from placeholders" helper. `/admin/users`
  (balance adjust → ledger + audit, admin toggle). `/admin/content` moderation grid (all users) +
  delete. Endpoints under `/api/admin/*` (templates save/delete, users balance/role, generations
  delete) all admin-guarded + `admin_audit` logged (`src/lib/admin.ts`). Verified as claude.admin:
  gating, dashboard stats, balance adjust (990→1040), template create+delete round-trip, content
  grid shows all 4 generations. Dropped the old Telegram inbox / email-export. Note: the sign-in
  page's `busy` guard sticks if a submit is fired repeatedly before completion — reload to reset
  (minor; consider resetting busy on a settled promise later).
- **2026-05-27** — Phase 7 done. Real **Gallery** (`/gallery`, SSR gated): reads the user's
  completed generations from D1 (joined to templates for titles), renders the actual image/video
  grid with tabs (All/Images/Video) and a full **lightbox** (big media, prev/next, download via
  Bunny URL, copy-share, remix → `/studio/[template]`, delete). **Account** (`/account`) rebuilt as
  the tabbed page (Profile/Plan/Creations/Notifications/Privacy/Help): editable name+handle saved
  via `POST /api/profile` (unique-handle guarded), real credits/tier/concurrency/rate-limit, real
  generation counts; invoices/payment are placeholders (Phase 9), notif/privacy toggles are
  client-only. Endpoints `POST /api/generations/delete` (ownership-scoped) + `POST /api/profile`.
  Verified as claude.tester: gallery shows the 4 real kitten generations, lightbox works, profile
  save persists (`username=claude-tester`). **Adult gating dropped** per user (no adult content).
  Public "explore" feed skipped (PRD scopes public profiles/feed out of v1).
- **2026-05-27** — Phase 6 done. Generation pipeline VERIFIED end-to-end with a real flux-schnell
  run (claude.tester): debit → SyncNode → poll → output rendered → output auto-hosted to Bunny
  (`pixiecdn.b-cdn.net/gen_...`). `src/lib/syncnode.ts` (submit/poll, provider routing, status
  normalize). `src/lib/limits.ts` (per-tier KV rate limit + concurrency). Endpoints
  `POST /api/generate` (auth → resolve+validate → cost → concurrency+rate-limit → atomic debit →
  create generation → dispatch → refund+fail on dispatch error) and `GET /api/generate/status`
  (poll → record output_url / refund on failure, idempotent). `/studio/[id]` is now the real
  3-column workspace (template card · inputs with aspect/quality/quantity controls · output canvas)
  with client polling, optimistic credit display, and insufficient-credits → /credits funnel.
  Accounting reconciles (balance = 1000 + Σ ledger deltas; one ledger row per generation).
  `.dev.vars` holds SYNCNODE_API_KEY + BUNNY_* for local Worker env.
- **2026-05-27** — Phase 5 done. Full D1 schema (`migrations/0002_schema.sql`): templates
  (provider/model/input_json + fields_json + steps_json for multi-step + cost/quality/aspects/
  quantities + workspace hints + preview), generations, credit_ledger, subscription_tiers,
  credit_packs, subscriptions, admin_audit. Data layer `src/lib/templates.ts` (list/get,
  `resolveInput` merges user inputs into `{{key}}` placeholders + validates, `computeCost` =
  cost×qty×qualityMult, `templateToCard`/`templateToRail`). `src/lib/credits.ts` (ledger-backed
  `adjustBalance` + atomic `debit`). Seed: `scripts/gen-seed.ts` (run via tsx) expands the catalog
  datasets → `seed/seed.sql` = **106 templates** (flux-schnell images / seedance-1-lite video —
  known-working via SyncNode) + 3 tiers (Free/Plus/Studio) + 3 credit packs; applied `--local`.
  Catalog tool pages + home rails + `/studio/[id]` workspace now read **live from D1** (SSR,
  prerender=false). Verified: /presets = 37 cards from D1, /studio/preset-kodak-portra loads the
  real template (cost 2cr, Flux Schnell, fields). **Tooling:** added `tsx` (devDep).
  TBD (Phase 9): final tier/pack pricing + non-subscriber multiplier — seeded values are placeholders.
  NOTE: re-seeding (`seed/seed.sql`) does `DELETE FROM templates` first — wipes admin-created rows in dev.
- **2026-05-27** — Phase 4 done. Auth: Firebase client (`src/lib/firebase-client.ts`, public config
  in `firebase-config.ts`) for Google/Apple/email+password + verification/reset. Server-side
  ID-token verification via Web Crypto against Google certs (`firebase-verify.ts`) — no service
  account. API endpoints `/api/auth/{session,me,signout}`; opaque sessions in KV; HttpOnly cookie
  (secure only on https so localhost works). D1 `users` table (`migrations/0001_init.sql`, applied
  `--local`). `src/middleware.ts` sets `locals.user` for SSR routes; shell hydrates auth state
  client-side via `/api/auth/me`. Sign-in page `/auth/sign-in` (immersive editorial split,
  signup/login toggle); gated `/account` (SSR, redirects logged-out → sign-in?redirect=). Verified
  locally: `/api/auth/me`→{user:null}, `/account` redirect, toggle, UI in desktop+narrow.
  **Tooling:** pinned **wrangler 3** (v4 needs Node 22; we're on 20). Installed `firebase` v12.
- **2026-05-26** — Phase 3 done. Public pages built + verified: Home (hero carousel, quick-launch,
  rails, feature banners — `src/components/home/`), catalog pages (Presets/Shoots/Video/Motion/
  Beauty/Trending/Fashion/Avatar/Ad/Gallery) via `FilterableCatalog` with client-side filtering
  (`src/components/catalog/`), Search (`/search`, live filter + scopes + suggestions), Legal
  (Terms/Privacy/Acceptable-use via `LegalLayout` with sticky TOC scroll-spy), and a styled 404.
  Placeholder content lives in `src/lib/content.ts` + `src/lib/catalog.ts` + `src/lib/legal.ts`
  (real data comes from D1 in Phase 5). Template card links resolve to a `/studio/[kind]/[id]`
  workspace **stub** (`prerender=false`) until Phase 6. `PageHeader`/`RailHead` added to `ui/`.
  NOTE: Gallery is a placeholder grid; the real user gallery + lightbox are Phase 7.
