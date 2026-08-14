/**
 * Thin OpenRouter client. Kept deliberately small — one JSON-returning chat
 * call — so swapping providers later means rewriting this file and nothing else.
 */

const ENDPOINT = "https://openrouter.ai/api/v1/chat/completions";

export const DEFAULT_MODEL = "anthropic/claude-sonnet-4.5";

export class OpenRouterNotConfiguredError extends Error {
  constructor() {
    super("OPENROUTER_API_KEY is not set — add it to .env.local to enable AI drafts.");
    this.name = "OpenRouterNotConfiguredError";
  }
}

export function isOpenRouterConfigured() {
  return Boolean(process.env.OPENROUTER_API_KEY);
}

export function activeModel() {
  return process.env.OPENROUTER_MODEL || DEFAULT_MODEL;
}

type ChatMessage = { role: "system" | "user"; content: string };

export async function chatJson<T>(
  messages: ChatMessage[],
  options: { temperature?: number; maxTokens?: number } = {},
): Promise<{ data: T; model: string }> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) throw new OpenRouterNotConfiguredError();

  const model = activeModel();

  const res = await fetch(ENDPOINT, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      // OpenRouter uses these for attribution on their dashboard.
      "HTTP-Referer": process.env.OPENROUTER_SITE_URL ?? "http://localhost:3000",
      "X-Title": process.env.OPENROUTER_SITE_NAME ?? "Linella Reviews",
    },
    body: JSON.stringify({
      model,
      messages,
      temperature: options.temperature ?? 0.7,
      max_tokens: options.maxTokens ?? 1200,
      response_format: { type: "json_object" },
    }),
    signal: AbortSignal.timeout(90_000),
  });

  if (!res.ok) {
    throw new Error(`OpenRouter ${res.status}: ${(await res.text()).slice(0, 500)}`);
  }

  const body = (await res.json()) as {
    model?: string;
    choices?: { message?: { content?: string } }[];
    error?: { message?: string };
  };

  if (body.error) throw new Error(`OpenRouter: ${body.error.message}`);

  const content = body.choices?.[0]?.message?.content;
  if (!content) throw new Error("OpenRouter returned an empty completion.");

  return { data: parseJson<T>(content), model: body.model ?? model };
}

/**
 * Not every model honours response_format strictly; some wrap JSON in prose or
 * a ```json fence. Salvage the object rather than failing the operator's click.
 */
function parseJson<T>(raw: string): T {
  const cleaned = raw
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "");

  try {
    return JSON.parse(cleaned) as T;
  } catch {
    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");
    if (start !== -1 && end > start) {
      return JSON.parse(cleaned.slice(start, end + 1)) as T;
    }
    throw new Error(`Model did not return JSON: ${cleaned.slice(0, 200)}`);
  }
}
