/**
 * Who this deployment is answering reviews for.
 *
 * The app itself is brand-neutral; a single deployment is not. The name reaches
 * the model's prompt and the search that discovers stores, so it belongs in
 * configuration rather than in the source.
 *
 * No database access here on purpose — the review sources import this, and they
 * must not drag the Postgres driver along with them.
 */

/** The chain's name as customers know it. Empty when nobody configured it. */
export function companyName(): string {
  return (process.env.COMPANY_NAME ?? "").trim();
}

/**
 * How the chain is described to the model — "a supermarket chain in Moldova"
 * reads very differently from "a chain of hardware stores", and the replies
 * follow. Falls back to something true of any deployment.
 */
export function companyDescription(): string {
  return (process.env.COMPANY_DESCRIPTION ?? "").trim() || "a retail chain";
}

/** What the model is told it writes for. Never empty, so the prompt still reads. */
export function companyLabel(): string {
  return companyName() || "the stores";
}
