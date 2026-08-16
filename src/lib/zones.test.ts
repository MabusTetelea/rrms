import { test } from "node:test";
import assert from "node:assert/strict";
import { resolveZone } from "./zones";

/*
 * Zones drive the "start here" line on the overview, so a store filed in the
 * wrong area quietly sends the operator to the wrong place. Nothing is entered
 * by hand — it is all derived from the city and street on every sync.
 */

test("files a Chișinău store by its sector keyword", () => {
  assert.equal(
    resolveZone({
      name: "Linella — Botanica",
      city: "Chișinău",
      address: "bd. Dacia 32, Chișinău",
    }),
    "chisinau-botanica",
  );
});

test("matches the street when the name says nothing about the sector", () => {
  assert.equal(
    resolveZone({ name: "Linella", city: "Chișinău", address: "str. Kiev 7" }),
    "chisinau-riscani",
  );
});

test("ignores diacritics", () => {
  assert.equal(
    resolveZone({ name: "Linella — Chișinău Ciocana", city: "Chisinau" }),
    "chisinau-ciocana",
  );
});

test("matches Râșcani by name, in either spelling", () => {
  /*
   * Regression guard. Stripping the accent from â gives "rascani", not
   * "riscani" — they are different letters — so a store named only "Râșcani",
   * with no other sector hint in its address, used to be filed under Centru.
   */
  for (const name of ["Linella — Râșcani", "Linella — Riscani", "Linella Rascani"]) {
    assert.equal(
      resolveZone({ name, city: "Chișinău", address: null }),
      "chisinau-riscani",
      name,
    );
  }
});

test("falls back to Centru for an unrecognised Chișinău address", () => {
  assert.equal(
    resolveZone({ name: "Linella", city: "Chișinău", address: "str. Necunoscută 1" }),
    "chisinau-centru",
  );
});

test("treats suburbs inside the municipality as the city", () => {
  assert.equal(
    resolveZone({ name: "Linella — Durlești", city: "Durlești", address: "str. Cartușa 4" }),
    "chisinau-buiucani",
  );
});

test("buckets towns outside the capital into regions", () => {
  assert.equal(resolveZone({ name: "Linella — Bălți", city: "Bălți" }), "nord");
  assert.equal(resolveZone({ name: "Linella — Cahul", city: "Cahul" }), "sud");
  assert.equal(resolveZone({ name: "Linella — Orhei", city: "Orhei" }), "raioane-centru");
});

test("a Bălți street that shares a Chișinău keyword still lands in the north", () => {
  // "Independenței" is a Botanica keyword; the city has to win.
  assert.equal(
    resolveZone({
      name: "Linella — Bălți",
      city: "Bălți",
      address: "str. Independenței 20, Bălți",
    }),
    "nord",
  );
});

test("Ștefan Vodă is mapped", () => {
  // Regression guard: the lookup key was written with an underscore, which the
  // normaliser can never produce, so this town silently fell to "unassigned".
  assert.equal(
    resolveZone({ name: "Linella — Ștefan Vodă", city: "Ștefan Vodă" }),
    "sud",
  );
});

test("an unmapped town is flagged, not guessed", () => {
  assert.equal(resolveZone({ name: "Linella", city: "Springfield" }), "unassigned");
});
