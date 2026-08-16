import { test } from "node:test";
import assert from "node:assert/strict";
import { resolveZone } from "./zones";

/*
 * Zones drive the "start here" line on the overview, so a store filed in the
 * wrong area quietly sends the operator to the wrong place. Nothing is entered
 * by hand — it is all derived from the city, name and address on every sync.
 */

test("files a store by its city", () => {
  assert.equal(resolveZone({ name: "Northgate", city: "North District" }), "north");
  assert.equal(resolveZone({ name: "Southbank", city: "South District" }), "south");
  assert.equal(resolveZone({ name: "Eastfield", city: "East District" }), "east");
  assert.equal(resolveZone({ name: "Westport", city: "West District" }), "west");
  assert.equal(
    resolveZone({ name: "Central High Street", city: "Central District" }),
    "central",
  );
});

test("matches the name or address when the city says nothing useful", () => {
  assert.equal(
    resolveZone({ name: "Riverside", city: "Springfield", address: "8 North Parade" }),
    "north",
  );
  assert.equal(resolveZone({ name: "Westport Retail Park", city: "" }), "west");
});

test("the outer ring wins over a compass word", () => {
  /*
   * A suburban store whose address happens to mention a direction belongs in
   * the outer ring, not the inner area — otherwise the outskirts get silently
   * folded into whichever compass word appeared first.
   */
  assert.equal(
    resolveZone({ name: "Stonebridge", city: "Suburbs", address: "40 North Bridge Road" }),
    "suburbs",
  );
  assert.equal(resolveZone({ name: "Lakeside", city: "Outskirts" }), "suburbs");
});

test("both spellings of centre work", () => {
  assert.equal(resolveZone({ name: "Shop", city: "City Centre" }), "central");
  assert.equal(resolveZone({ name: "Shop", city: "City Center" }), "central");
  assert.equal(resolveZone({ name: "Shop", city: "Downtown" }), "central");
});

test("ignores accents", () => {
  // "Chișinău Centre" should behave exactly like "Chisinau Centre".
  assert.equal(resolveZone({ name: "Shop", city: "Chișinău Centre" }), "central");
});

test("an unmatched store is flagged, not guessed", () => {
  assert.equal(resolveZone({ name: "Shop", city: "Springfield" }), "unassigned");
  assert.equal(resolveZone({ name: "Shop" }), "unassigned");
});
