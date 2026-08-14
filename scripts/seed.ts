/**
 * Fills the database from whichever source REVIEW_SOURCE points at.
 *
 *   npm run db:seed
 *
 * With the default `mock` source this produces a stable demo dataset; running
 * it repeatedly updates rows in place rather than duplicating them.
 */
import { runSync } from "../src/lib/sync";

async function main() {
  const configured = process.env.REVIEW_SOURCE ?? "mock";
  console.log(`Syncing from: ${configured}`);

  const results = await runSync({ full: true });

  for (const result of results) {
    console.log(
      `  ${result.source}: ${result.locationsUpserted} locations, ` +
        `${result.reviewsUpserted} reviews (${result.reviewsNew} new).`,
    );
  }
  console.log("Done.");
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
