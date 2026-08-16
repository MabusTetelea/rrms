import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { clearAll, hit, reset } from "./rate-limit";

beforeEach(() => clearAll());

const LIMIT = { max: 3, windowMs: 60_000 };

test("allows up to the limit, then stops", () => {
  assert.equal(hit("a", LIMIT).ok, true);
  assert.equal(hit("a", LIMIT).ok, true);
  assert.equal(hit("a", LIMIT).ok, true);
  assert.equal(hit("a", LIMIT).ok, false);
});

test("counts each key separately", () => {
  hit("a", LIMIT);
  hit("a", LIMIT);
  hit("a", LIMIT);
  assert.equal(hit("a", LIMIT).ok, false);
  assert.equal(hit("b", LIMIT).ok, true, "one user's limit must not block another");
});

test("reports what is left", () => {
  assert.equal(hit("a", LIMIT).remaining, 2);
  assert.equal(hit("a", LIMIT).remaining, 1);
  assert.equal(hit("a", LIMIT).remaining, 0);
  assert.equal(hit("a", LIMIT).remaining, 0, "never goes negative");
});

test("retrying while blocked does not let you through", () => {
  const now = 1_000_000;
  for (let i = 0; i < 10; i++) hit("a", LIMIT, now);
  // Still inside the window, and the extra hits kept it tripped.
  assert.equal(hit("a", LIMIT, now + 59_000).ok, false);
});

test("opens up again once the window passes", () => {
  const now = 1_000_000;
  hit("a", LIMIT, now);
  hit("a", LIMIT, now);
  hit("a", LIMIT, now);
  assert.equal(hit("a", LIMIT, now).ok, false);
  assert.equal(hit("a", LIMIT, now + 60_001).ok, true);
});

test("reset clears a key", () => {
  hit("a", LIMIT);
  hit("a", LIMIT);
  hit("a", LIMIT);
  assert.equal(hit("a", LIMIT).ok, false);
  // A successful sign-in does this, so a typo earlier doesn't lock you out.
  reset("a");
  assert.equal(hit("a", LIMIT).ok, true);
});
