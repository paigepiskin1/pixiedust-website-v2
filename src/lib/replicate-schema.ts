// Fetches a Replicate model's OpenAPI input schema and converts it into a
// PixieDust template scaffold (input_json with {{placeholders}} + typed fields).
// This is the "no manual mapping" import for the admin editor.

function humanize(key: string): string {
  return key.replace(/[_-]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export interface ImportResult {
  title: string;
  modelRef: string;
  type: "image" | "video";
  input: Record<string, unknown>;
  fields: Array<Record<string, unknown>>;
}

export async function fetchModelSchema(token: string, modelId: string): Promise<ImportResult> {
  const ownerName = modelId.split(":")[0].trim();
  if (!/^[^/]+\/[^/]+$/.test(ownerName)) throw new Error("Model must look like owner/name.");

  const res = await fetch(`https://api.replicate.com/v1/models/${ownerName}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`Replicate API ${res.status}: ${(await res.text().catch(() => "")).slice(0, 160)}`);
  const model = (await res.json()) as any;

  const schema = model.latest_version?.openapi_schema;
  const components = schema?.components?.schemas ?? {};
  const inputSchema = components.Input;
  if (!inputSchema?.properties) throw new Error("This model has no readable input schema.");

  const required = new Set<string>(inputSchema.required ?? []);
  const resolveEnum = (p: any): string[] | null => {
    if (Array.isArray(p.enum)) return p.enum;
    const ref = p.allOf?.[0]?.$ref || p.$ref;
    if (ref) return components[ref.split("/").pop()!]?.enum ?? null;
    return null;
  };

  const entries = Object.entries<any>(inputSchema.properties).sort(
    (a, b) => (a[1]["x-order"] ?? 99) - (b[1]["x-order"] ?? 99)
  );

  const input: Record<string, unknown> = {};
  const fields: Array<Record<string, unknown>> = [];

  for (const [key, p] of entries) {
    const enumVals = resolveEnum(p);
    const isPrompt = /prompt|caption|description/i.test(key);
    const isImageish = /image|img|mask|photo|file/i.test(key) || p.format === "uri";
    const expose = required.has(key) || isPrompt || isImageish;

    if (expose) {
      input[key] = `{{${key}${required.has(key) ? "*" : ""}}}`;
      let type = "text";
      if (enumVals) type = "select";
      else if (isImageish) type = "file";
      else if (p.type === "integer" || p.type === "number") type = "number";
      else if (p.type === "boolean") type = "toggle";
      else if (isPrompt) type = "textarea";

      const field: Record<string, unknown> = { key, type, label: humanize(key), required: required.has(key) };
      if (p.description) field.help = String(p.description).slice(0, 140);
      if (enumVals) field.options = enumVals.map((v) => ({ value: String(v), label: String(v) }));
      if (p.default != null && type !== "file") field.default = p.default;
      if (p.minimum != null) field.min = p.minimum;
      if (p.maximum != null) field.max = p.maximum;
      if (isImageish) field.accept = "image/*";
      fields.push(field);
    } else if (p.default != null) {
      input[key] = p.default; // keep non-exposed params as static defaults
    }
  }

  const ref = ownerName.toLowerCase();
  const type = /video|seedance|kling|veo|wan|hunyuan|ltx|mochi|runway|minimax|svd/.test(ref) ? "video" : "image";

  return { title: humanize(ownerName.split("/").pop()!), modelRef: modelId, type, input, fields };
}
