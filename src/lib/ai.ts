// Admin AI-assist via OpenRouter (Anthropic Opus). Converts pasted provider
// params / a freeform description into a PixieDust template scaffold.
const MODEL = "anthropic/claude-opus-4.1";

const SYSTEM = `You convert a Replicate model's example input JSON (or a plain description) into a PixieDust template.
Return STRICT JSON only (no prose, no markdown fences) shaped exactly as:
{ "input_json": <object>, "fields_json": <array> }
Rules:
- input_json is the provider payload. For values the END USER should supply, use a placeholder string "{{key}}" (add * for required: "{{key*}}"). Keep sensible defaults as static values for everything else.
- fields_json is an array of field defs, one per {{key}} used: { "key", "type", "label", "required", "help"?, "options"?, "default"?, "min"?, "max"?, "accept"? }.
- field "type" is one of: text, textarea, number, select, file, toggle, url. Use textarea for prompts, file for image/photo inputs, select (with options:[{value,label}]) for enumerated choices, number for numeric.
- Every {{key}} in input_json MUST have a matching field. Do not invent unrelated params.`;

export interface AiTemplate {
  input: unknown;
  fields: unknown;
}

const TEMPLATE_SYSTEM = `You design a PixieDust generation template from a plain-language request, returning STRICT JSON only (no prose/markdown):
{ "id","title","kind","type","model","input_json","fields_json","credit_cost","tone","engine","subtitle","tags","aspects","quantities" }
Rules:
- id: lowercase slug (a–z,0–9,dash). type: "image" or "video". kind: one of preset|shoot|cinema|i2v|fashion-video|game-video|motion|beauty|fashion|avatar|ad.
- model: a Replicate model id (owner/name). If a base schema is provided, KEEP its model + start from its input/fields.
- input_json: provider payload object; use "{{key}}" ("{{key*}}" required) for user-supplied values, static values otherwise.
- fields_json: array of { key,type,label,required,help?,options?,default? } — one per {{key}}. type ∈ text,textarea,number,select,file,toggle,url.
- credit_cost: small integer (image 1–4, video 6–12). tone ∈ teal,lilac,mint,pink,noir,dusk,ice,amber. tags: short string array. aspects: e.g. ["1:1","16:9","9:16"]. quantities: e.g. [1,2,4] (images) or [1] (video).`;

export interface AiFullTemplate {
  id: string; title: string; kind: string; type: string; model: string;
  input_json: unknown; fields_json: unknown; credit_cost?: number; tone?: string;
  engine?: string; subtitle?: string; tags?: unknown; aspects?: unknown; quantities?: unknown;
}

export async function aiTemplate(
  apiKey: string,
  prompt: string,
  schema?: { model: string; type: string; input: unknown; fields: unknown }
): Promise<AiFullTemplate> {
  const user = schema
    ? `Request: ${prompt}\n\nBase model schema to start from:\n${JSON.stringify({ model: schema.model, type: schema.type, input: schema.input, fields: schema.fields }).slice(0, 4000)}`
    : `Request: ${prompt}`;
  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model: MODEL, temperature: 0.3, max_tokens: 2000, messages: [{ role: "system", content: TEMPLATE_SYSTEM }, { role: "user", content: user }] }),
  });
  const data = (await res.json()) as any;
  if (!res.ok) throw new Error(data.error?.message || `OpenRouter ${res.status}`);
  let text: string = data.choices?.[0]?.message?.content ?? "";
  text = text.replace(/^```(?:json)?/i, "").replace(/```$/i, "").trim();
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start >= 0 && end > start) text = text.slice(start, end + 1);
  return JSON.parse(text) as AiFullTemplate;
}

export async function aiConvert(apiKey: string, raw: string): Promise<AiTemplate> {
  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: MODEL,
      temperature: 0.2,
      max_tokens: 1800,
      messages: [
        { role: "system", content: SYSTEM },
        { role: "user", content: raw.slice(0, 6000) },
      ],
    }),
  });
  const data = (await res.json()) as any;
  if (!res.ok) throw new Error(data.error?.message || `OpenRouter ${res.status}`);
  let text: string = data.choices?.[0]?.message?.content ?? "";
  text = text.replace(/^```(?:json)?/i, "").replace(/```$/i, "").trim();
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start >= 0 && end > start) text = text.slice(start, end + 1);
  const parsed = JSON.parse(text);
  return { input: parsed.input_json, fields: parsed.fields_json };
}
