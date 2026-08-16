/**
 * Removes the demo data, so a real review source starts from an empty desk.
 *
 *   npm run demo:clear          # show what would be deleted
 *   npm run demo:clear -- --yes # actually delete it
 *
 * Only touches rows whose source is `mock`. Real reviews pulled from Google are
 * never in scope, so running this against a live database is safe.
 *
 * Deleting a location cascades to its reviews, and each review to its drafts
 * and saved replies — that's declared in the schema, so nothing is left behind.
 */

import { eq } from "drizzle-orm";
import { db } from "../src/db";
import { locations, reviews, syncRuns } from "../src/db/schema";

const MOCK = "mock";

async function main() {
  const confirmed = process.argv.includes("--yes");

  const demoLocations = await db
    .select({ id: locations.id, name: locations.name })
    .from(locations)
    .where(eq(locations.source, MOCK));

  const demoReviews = await db
    .select({ id: reviews.id })
    .from(reviews)
    .where(eq(reviews.source, MOCK));

  if (demoLocations.length === 0 && demoReviews.length === 0) {
    console.log("No demo data found. Nothing to do.");
    return;
  }

  console.log(`Demo stores:  ${demoLocations.length}`);
  console.log(`Demo reviews: ${demoReviews.length}`);
  console.log("Their drafts and saved replies go with them.");

  if (!confirmed) {
    console.log("\nNothing deleted. Re-run with --yes to go ahead:");
    console.log("  npm run demo:clear -- --yes");
    return;
  }

  // Reviews first by id rather than relying only on the cascade: a review row
  // can outlive its location if a source was ever misconfigured, and those
  // would otherwise linger with no store to belong to.
  await db.delete(reviews).where(eq(reviews.source, MOCK));
  await db.delete(locations).where(eq(locations.source, MOCK));
  await db.delete(syncRuns).where(eq(syncRuns.source, MOCK));

  console.log("\nDeleted. Point REVIEW_SOURCE at a real source and run a sync.");
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
