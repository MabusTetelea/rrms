/**
 * Thin OpenRouter client. Kept deliberately small — one JSON-returning chat
 * call — so swapping providers later means rewriting this file and nothing else.
 */

const ENDPOINT = "https://openrouter.ai/api/v1/chat/completions";

/**
 * Free tier by default. The largest free model (nemotron-3-ultra-550b) can't do
 * JSON mode, so this is the biggest one that can. Swap for a paid model in
 * OPENROUTER_MODEL when reply quality matters more than cost.
 */
export const DEFAULT_MODEL = "nvidia/nemotron-3-super-120b-a12b:free";

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

/**
 * Free-only mode is the default. Set OPENROUTER_ALLOW_PAID=true to spend money
 * deliberately; anything else keeps the app pinned to zero-cost models.
 */
export function isFreeOnly() {
  return process.env.OPENROUTER_ALLOW_PAID !== "true";
}

/** A ":free" suffix is OpenRouter's guarantee that a variant costs nothing. */
export function isFreeModel(model: string) {
  return model.trim().endsWith(":free");
}

export class PaidModelBlockedError extends Error {
  constructor(model: string) {
    super(
      `Refusing to call "${model}": it is not a free model and free-only mode is on. ` +
        `Use a model whose slug ends in ":free", or set OPENROUTER_ALLOW_PAID=true.`,
    );
    this.name = "PaidModelBlockedError";
  }
}

type ChatMessage = { role: "system" | "user"; content: string };

export async function chatJson<T>(
  messages: ChatMessage[],
  options: { temperature?: number; maxTokens?: number } = {},
): Promise<{ data: T; model: string }> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) throw new OpenRouterNotConfiguredError();

  const model = activeModel();

  // Fail before the network call, not after a charge.
  const freeOnly = isFreeOnly();
  if (freeOnly && !isFreeModel(model)) throw new PaidModelBlockedError(model);

  /*
   * Optional parameters are not universally supported, and the two failure
   * modes pull in opposite directions: several free models reject
   * `response_format` outright, while Claude's 5-series rejects a non-default
   * `temperature`. Rather than maintain a per-model capability table, send the
   * richer request and retry once without the optional parameters if the
   * provider rejects it. The prompt asks for bare JSON anyway, and parseJson
   * below salvages a fenced or prose-wrapped object.
   */
  async function post(withOptionalParams: boolean) {
    return fetch(ENDPOINT, {
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
        max_tokens: options.maxTokens ?? 1200,
        ...(withOptionalParams
          ? {
              temperature: options.temperature ?? 0.7,
              response_format: { type: "json_object" },
            }
          : {}),
      }),
      signal: AbortSignal.timeout(90_000),
    });
  }

  let res = await post(true);
  if (res.status === 400) {
    res = await post(false);
  }

  if (!res.ok) {
    throw new Error(`OpenRouter ${res.status}: ${(await res.text()).slice(0, 500)}`);
  }

  const body = (await res.json()) as {
    model?: string;
    choices?: { message?: { content?: string } }[];
    error?: { message?: string };
  };

  // OpenRouter can return an error object inside a 200 response.
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
