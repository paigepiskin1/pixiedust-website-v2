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
| 1 | Scaffold (Astro/Tailwind/CF, bindings stub, archive demo) | 🚧 In progress |
| 2 | Design system + app shell | ⬜ |
| 3 | Public/static pages | ⬜ |
| 4 | Auth (Firebase: Google/email+password/Apple) | ⬜ |
| 5 | Data model + template system (D1) | ⬜ |
| 6 | Generation pipeline (Worker → SyncNode → Bunny) | ⬜ |
| 7 | User features (gallery, account, explore feed) | ⬜ |
| 8 | Admin backend (templates, users, content, moderation) | ⬜ |
| 9 | Monetization (Stripe subs + credit packs, ledger, audit) | ⬜ |
| 10 | Migration (user accounts + balances) | ⬜ |
| 11 | Deploy + hardening | ⬜ |

---

## Open questions (need answers before the noted phase)

- **Credentials (Phase 4/9):** Firebase config + Stripe keys are NOT in `CLAUDE.local.md`
  (brief said they'd be there). They ARE hardcoded in old `back/config.php` /
  `back/global.functions.php` — can be pulled into Wrangler secrets with user OK. Never commit.
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

## Changelog

- **2026-05-26** — Discovery complete. Audited old site, new design, SyncNode docs. Locked stack,
  auth, migration, and template-system decisions. Started Phase 1 scaffold.
