import { test } from "node:test";
import assert from "node:assert/strict";
import { isFreeModel, parseJson } from "./openrouter";

/*
 * Models are inconsistent about honouring JSON mode — some wrap the object in
 * a fence, some in a sentence. Salvaging it is the difference between the
 * operator getting drafts and getting an error, so the salvage is worth
 * pinning down.
 */

test("parses plain JSON", () => {
  assert.deepEqual(parseJson('{"language":"ro","options":[]}'), {
    language: "ro",
    options: [],
  });
});

test("parses JSON in a fenced block", () => {
  assert.deepEqual(parseJson('```json\n{"language":"ru"}\n```'), { language: "ru" });
  assert.deepEqual(parseJson('```\n{"language":"ru"}\n```'), { language: "ru" });
});

test("digs the object out of surrounding prose", () => {
  const raw = 'Sure! Here are the replies:\n{"language":"ro","options":[{"tone":"brief"}]}\nHope that helps.';
  assert.deepEqual(parseJson(raw), {
    language: "ro",
    options: [{ tone: "brief" }],
  });
});

test("keeps braces that appear inside the reply text", () => {
  const raw = '{"options":[{"text":"Ne pare rău {sincer} pentru situație"}]}';
  assert.deepEqual(parseJson(raw), {
    options: [{ text: "Ne pare rău {sincer} pentru situație" }],
  });
});

test("throws on something that isn't JSON at all", () => {
  assert.throws(() => parseJson("I'm sorry, I can't help with that."), /did not return JSON/);
});

test("only a :free slug counts as free", () => {
  // This is the guard that stops a paid model being called by accident.
  assert.equal(isFreeModel("nvidia/nemotron-3-super-120b-a12b:free"), true);
  assert.equal(isFreeModel("  google/gemma-4-31b-it:free  "), true);
  assert.equal(isFreeModel("anthropic/claude-sonnet-5"), false);
  assert.equal(isFreeModel("some/model:free-ish"), false);
});
