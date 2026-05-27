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
