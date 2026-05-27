# PixieDust Template API

A small HTTP API for managing generation **templates** programmatically — built so an
agent (e.g. Claude Code) or a script can create, edit, and publish templates, and update
the inputs/interface for a specific template.

## Auth

Every endpoint accepts **either** a logged-in admin session (cookie) **or** a bearer token:

```
Authorization: Bearer <ADMIN_API_TOKEN>
```

`ADMIN_API_TOKEN` is set in `.dev.vars` (local) / Pages env (prod). Base URL is the site
origin (local: `http://localhost:4321`).

## Endpoints

### List templates
`GET /api/admin/templates`
→ `{ templates: [{ id, title, kind, type, credit_cost, is_featured, is_hidden, has_example }] }`

### Get one (full row, for editing)
`GET /api/admin/templates/:id` → `{ template: {...all columns...} }`

### Create / update (upsert by `id`)
`POST /api/admin/templates`  (JSON body)
```jsonc
{
  "id": "preset-film-noir",          // slug a–z0–9- ; same id = update
  "title": "Film Noir",
  "kind": "preset",                  // preset|shoot|cinema|i2v|fashion-video|game-video|motion|beauty|fashion|avatar|ad
  "type": "image",                   // image|video
  "provider": "replicate",
  "model": "black-forest-labs/flux-schnell",
  "input_json":  { "prompt": "{{prompt}}, film noir", "num_outputs": 1 },  // object OR string
  "fields_json": [ { "key": "prompt", "type": "textarea", "label": "Prompt", "required": true } ],
  "credit_cost": 2,
  "price_per_second": null,          // set for per-second video pricing
  "durations_json": null,            // e.g. [5,10] -> duration picker
  "quality_json": { "std": 1, "pro": 1.5, "cinema": 2.5 },
  "aspects_json": ["1:1","16:9","9:16"],
  "quantities_json": [1,2,4],
  "tone": "noir", "accent": "var(--pd-lilac)", "tags_json": ["Film"],
  "preview_image": null, "preview_video": null,
  "is_featured": 0, "is_hidden": 0, "sort_order": 0
}
```
JSON columns accept an object/array **or** a JSON string. → `{ ok: true, id }`

### Delete
`POST /api/admin/templates/delete` `{ "id": "preset-film-noir" }`

### Set the frontend example (image/video shown on cards)
`POST /api/admin/templates/set-preview` `{ "id", "url", "type": "image"|"video" }`

### Import a Replicate model's input schema (auto-build input + fields)
`POST /api/admin/replicate-schema` `{ "model": "owner/name" }`
→ `{ title, type, model, input_json, fields_json }` (strings)

### AI helpers (Anthropic Opus via OpenRouter)
- `POST /api/admin/ai-convert` `{ "raw": "<example params or description>" }` → `{ input_json, fields_json }`
- `POST /api/admin/ai-template` `{ "prompt": "a cinematic film-noir preset", "model"?: "owner/name", "publish"?: false }`
  → creates a full template (hidden unless `publish:true`). → `{ ok, id, template }`

## Typical agent flows

**Create from a prompt:** `POST /api/admin/ai-template { prompt }` → review with `GET /:id` → publish via
`POST /api/admin/templates { id, ...changes, is_hidden:0 }`.

**Create from a known model:** `POST /api/admin/replicate-schema { model }` → tweak → `POST /api/admin/templates`.

**Edit a template's interface:** `GET /api/admin/templates/:id` → modify `fields_json`/`input_json` →
`POST /api/admin/templates` (same id).

**Test before publishing:** keep `is_hidden:1`, open `/(site)/studio/:id` to run it, then publish.
