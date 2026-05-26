---
name: syncnode
description: Build apps with SyncNode (syncnode.ai) — a unified AI API gateway that fronts Replicate, OpenAI, OpenRouter, FAL, and Alibaba DashScope behind a single billing, auth, and file-hosting surface. TRIGGER when the user mentions "syncnode", wants to add image/video/chat/moderation to an app through a single endpoint instead of integrating each provider separately, asks about combining multiple AI providers behind one key, or wants pay-as-you-go AI without provisioning each provider's SDK. Includes endpoint reference, auth flow, async polling pattern, and code samples in cURL/JavaScript/Python. SKIP when the user is building directly against a specific provider's native SDK (e.g. only OpenAI, only Replicate) and has no interest in aggregation, billing, or CDN auto-hosting.
---

# SyncNode Integration Skill

SyncNode is a unified AI API gateway hosted at `https://run.syncnode.ai`. Users register once, store their provider credentials (OpenAI, Replicate, OpenRouter, FAL, Alibaba DashScope), and then make all AI calls through a single endpoint surface using one SyncNode API key. SyncNode handles routing, balance billing, async job tracking, and auto-uploading generated media to the user's configured CDN host (Bunny / S3).

## When to use this skill

- User says "use syncnode" / "integrate syncnode" / "add AI to my app with syncnode"
- User wants pay-as-you-go AI without managing per-provider auth or billing
- User wants to swap between providers (Replicate vs FAL vs Alibaba) without rewriting glue code
- User needs auto-CDN-hosted outputs for generated images/videos

## When NOT to use this skill

- User is building directly against a provider SDK and isn't using SyncNode
- User is working on the SyncNode codebase itself (worker, frontend) — that's a regular codebase task, not an integration task

## Core concepts the user must understand first

Before writing any code, make sure these are settled:

1. **API key** — your SyncNode account credential. Get it by signing up at `https://syncnode.ai/register` and copying it from `/api_keys`. It's sent in every request as the JSON body field `apiKey` (or `api_key`). The legacy field name `uid` is also accepted for backward compatibility — all three behave identically. Every request needs it.
2. **Access token** — a JWT issued by SyncNode for additional authentication on protected endpoints. Sent as `Authorization: Bearer <token>`. Grab it from the `/api_keys` page. Most generation endpoints accept the API key alone (see Public Endpoints below).
3. **Provider Credentials** — the user must store their own Replicate / OpenAI / OpenRouter / FAL / Alibaba keys in the "Connected Provider Credentials" section of `/api_keys` *before* calling endpoints that route to those providers. SyncNode never proxies a call without the user's own provider credential.
4. **Job lifecycle** — image/video calls are async. `POST /generate` returns a `job_id` and `status: in_progress`. The actual output arrives later via webhook or by polling `/prediction-status?job_id=...`. Chat calls are synchronous.
5. **Pricing** — flat per-call, debited from the user's SyncNode balance. New accounts get $5 free. Auto-recharge fires when balance drops below the cheapest call.

If the user hasn't signed up yet, point them at `https://syncnode.ai/register` before generating any client code.

## Base URLs

| Service | Base URL |
|---|---|
| AI tasks (chat, image, FAL, Alibaba, face swap) | `https://run.syncnode.ai` |
| Content moderation | `https://moderate.syncnode.ai` |

## Authentication

Most endpoints require both:
- `apiKey` in the request body (or query string for GET) — `uid` and `api_key` are also accepted as aliases
- `Authorization: Bearer <JWT>` header

**Public endpoints** (API key only, no Bearer token needed) — useful for server-to-server flows where the JWT would be a hassle:
- `POST /generate`
- `POST /chat-completion`
- `POST /chatgpt-completion`
- `POST /fal/generate` + `GET /fal/status`
- `POST /alibaba/generate` + `GET /alibaba/status`
- `POST /face-swap/run` + `GET /face-swap/status`
- `GET /prediction-status`
- `GET /balance`
- `POST https://moderate.syncnode.ai`

`/api-keys`, `/tasks`, `/billing-history`, `/dashboard`, `/hosts`, `/profile` etc. require the Bearer token AND the JWT subject must match the supplied API key.

## Endpoint reference

### Image / video generation via Replicate

```
POST /generate
Body: { apiKey, model, input }
```

- `model` — Replicate model identifier or version hash (e.g. `bytedance/seedance-1-lite`)
- `input` — model-specific input object (e.g. `{ prompt, width, height, num_outputs }`)
- **Returns** `{ success, job_id, status: "in_progress" }` immediately. Poll `/prediction-status?job_id=...` for the result.
- **Cost** $0.02 per successful call (charged on completion, not on submit)

### Image / video / multimodal via FAL

```
POST /fal/generate
Body: { apiKey, model, input }
GET  /fal/status?job_id=<job_id>
```

- `model` — full FAL model path (e.g. `fal-ai/recraft/v4.1/text-to-image`, `fal-ai/flux/dev`)
- `input` — FAL model parameters (e.g. `{ prompt, image_size, ... }`)
- **Returns** `{ success, job_id, provider_job_id, task_status: "IN_QUEUE", status: "in_progress" }`
- Polled server-side every 60s by a cron, or call `/fal/status?job_id=...` manually to force a poll
- **Cost** $0.02 per successful call

### Image / video via Alibaba DashScope (Wan models)

```
POST /alibaba/generate
Body: { apiKey, model, input, parameters?, endpoint? }
GET  /alibaba/status?job_id=<job_id>
```

- `model` — DashScope model name (e.g. `wan2.7-image-pro`, `wan2.7-i2v`)
- `input` — DashScope input object (`{ messages: [...] }` for multimodal, `{ prompt, media: [...] }` for video)
- `parameters` — model-specific params (`size`, `resolution`, `duration`, etc.)
- Video models are async; auto-polled by cron or via `/alibaba/status`
- **Cost** $0.02 per successful call

### Chat completion via OpenRouter

```
POST /chat-completion
Body: { apiKey, model, messages, max_tokens?, temperature?, ... }
```

- Routes to `https://openrouter.ai/api/v1/chat/completions`. Pass any OpenRouter-supported params.
- Returns OpenRouter's response shape directly (synchronous).
- **Cost** $0.02 per call

### Chat completion via OpenAI direct

```
POST /chatgpt-completion
Body: { apiKey, model, messages, max_tokens?, temperature?, ... }
```

- Routes to `https://api.openai.com/v1/chat/completions`. Synchronous, returns OpenAI shape.
- **Cost** $0.02 per call

### Face swap

```
POST /face-swap/run
Body: { apiKey, source_image, target_image }
GET  /face-swap/status?job_id=<job_id>
```

- Both images can be public URLs or base64 data URIs.
- Async; poll status by `job_id`.
- **Cost** $0.02 per call

### Content moderation

```
POST https://moderate.syncnode.ai
Body: { apiKey, text?, imageUrl?, imageBase64?, imageMime? }
```

- No provider credential required. SyncNode runs the moderation server-side.
- Returns granular per-category scores plus an `overall_moderation.safe` flag (`1` = safe, `0` = flagged).
- **Cost** $0.005 per call

### Prediction status (Replicate)

```
GET /prediction-status?job_id=<job_id>
```

Returns `{ job_id, replicate_status, output, updated }`. Call repeatedly until `replicate_status === "succeeded"` (or `"failed"`).

### Balance

```
GET /balance?apiKey=<api_key>
```

Returns `{ balance }`. Public — useful to surface remaining credit in the user's UI before making expensive calls.

### Listing tasks

```
GET /tasks?apiKey=<api_key>&page=1&size=10
Headers: Authorization: Bearer <jwt>
```

Returns `{ tasks, page, size, total }`. `tasks[].status` is one of `in_progress | completed | failed`.

## Polling pattern (canonical)

For async endpoints (`/generate`, `/fal/generate`, `/alibaba/generate`, `/face-swap/run`), the canonical client loop is:

```js
const { job_id } = await submitTask();
let result;
while (true) {
  const status = await fetchStatus(job_id);
  if (status.replicate_status === 'succeeded' || status.task_status === 'COMPLETED' || status.task_status === 'SUCCEEDED') {
    result = status.output;
    break;
  }
  if (status.replicate_status === 'failed' || status.task_status === 'FAILED') {
    throw new Error(status.output || 'Task failed');
  }
  await new Promise(r => setTimeout(r, 2000));  // poll every 2s
}
```

Don't poll faster than every 1–2 seconds. Each status call hits SyncNode and the upstream provider; aggressive polling can rate-limit you.

## Error reference

| Status | Meaning | Fix |
|---|---|---|
| 400 `Missing API key or model` | Client forgot a required field | Send required fields |
| 400 `No <provider> API key found` | User didn't save that provider's credential under "Connected Provider Credentials" on `/api_keys` | Direct user to `https://syncnode.ai/api_keys` |
| 401 `Unauthorized` | Bearer token missing or doesn't match the API key | Re-authenticate to get a fresh access token |
| 402 `Insufficient balance` | User has no balance and no card on file | Direct to billing `/billing` to add card or top up |
| 404 from provider (Replicate / FAL) | Job was rejected (often moderation), or model name wrong | Check model spelling; for FAL, ensure model path includes `fal-ai/` prefix |
| 500 `Failed to save provider credentials` | SyncNode-side issue | Retry; if it persists, contact SyncNode support |

## Code samples

Self-contained examples live in `examples/`:

- `examples/curl.sh` — every endpoint as a cURL command
- `examples/syncnode.js` — minimal Node.js client (uses native `fetch`)
- `examples/syncnode.py` — minimal Python client (uses `httpx` or `requests`)

When generating client code for a user, **strongly prefer** writing a thin wrapper around `fetch` (or `httpx`) over pulling in a custom SDK — SyncNode doesn't ship one and the surface is small enough that a 30-line wrapper is more maintainable than a generated stub.

## Conventions when generating apps that use SyncNode

1. **Never put the API key or Bearer token in client-side code that hits the AI endpoints from a browser.** Even though `/generate`, `/fal/generate` etc. are public, the JWT-required endpoints aren't, and you don't want to mix patterns. Build a thin server-side proxy.
2. **Always show the user remaining balance before a call** that costs >$0.10 total (e.g. a long video). Use `GET /balance`. Keeps surprise out of the loop.
3. **Default to async polling, never long-running blocking calls.** If you're tempted to wrap a polling loop in a synchronous request handler that waits >10s, push the polling to the client instead and return the `job_id` immediately.
4. **For media outputs, expect either a SyncNode-hosted URL (if the user configured a Bunny/S3 host) or the raw provider URL.** Both are stable enough to display; the SyncNode-hosted one is preferred since it won't expire.
5. **Surface the actual error string from SyncNode responses.** The worker passes through provider error messages — don't swallow them.

## Quick start prompt (paste-ready)

If the user just says "set me up with SyncNode," do this in order:

1. Confirm they have an API key (ask them to paste it from `/api_keys`, or send them there)
2. Confirm which providers they want (image? chat? video? moderation?)
3. Ask them to add the corresponding provider credential on `/api_keys` if they haven't
4. Scaffold a tiny working call (probably `/chat-completion` if they have OpenRouter, since it's synchronous and fastest to verify)
5. Verify it returns, then expand to the rest of their use case

## Reference data freshness

If the user asks about new endpoints not listed here, check `https://syncnode.ai/docs` — that's the source of truth and updates more often than this skill. The endpoint surface is stable but pricing and new providers may have changed since this skill was last updated.
