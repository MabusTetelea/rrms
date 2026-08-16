import { test } from "node:test";
import assert from "node:assert/strict";
import { detectLanguage, extractTopics, sentimentFromRating } from "./text";

/*
 * Language detection is the load-bearing one. It decides what language the
 * model is told to reply in, and it is also the check that throws a draft away
 * when the model answers in the wrong language. If it regresses, a Russian
 * customer gets an English reply published under the brand — which is the one
 * failure here that can't be taken back.
 */

test("detects Russian from Cyrillic script", () => {
  assert.equal(detectLanguage("Кассир нахамила и бросила сдачу на стойку."), "ru");
  assert.equal(detectLanguage("Огромная очередь на кассе."), "ru");
});

test("detects Romanian from diacritics", () => {
  assert.equal(detectLanguage("Am cumpărat iaurt expirat de două zile."), "ro");
  assert.equal(detectLanguage("Prețul de pe raft nu corespunde."), "ro");
});

test("detects Romanian without diacritics, from its stopwords", () => {
  assert.equal(detectLanguage("Magazin bun si personal amabil"), "ro");
});

test("detects English", () => {
  assert.equal(detectLanguage("The staff is very good and the store is clean"), "en");
});

test("ordinary English sentences without obvious keywords still read as English", () => {
  /*
   * Regression guard. The English list was once short enough that perfectly
   * normal sentences scored zero and fell to "other" — which the drafting code
   * treats as "no language", replying in the default instead of English.
   */
  assert.equal(
    detectLanguage("Excellent hours, open late. It has rescued my evening plenty of times."),
    "en",
  );
  assert.equal(
    detectLanguage("I find almost everything I need. Would like a wider gluten free selection."),
    "en",
  );
});

test("Romanian still wins over English on a Romanian sentence", () => {
  // The wider English list must not start stealing Romanian reviews.
  assert.equal(detectLanguage("Magazin bun si personal amabil, preturi corecte"), "ro");
  assert.equal(detectLanguage("Produse proaspete si preturi bune la acest magazin"), "ro");
});

test("gives up rather than guessing", () => {
  // Nothing to go on: no script, no stopwords. "other" lets the caller fall
  // back instead of confidently picking the wrong language.
  assert.equal(detectLanguage("Ok"), "other");
  assert.equal(detectLanguage(""), "other");
  assert.equal(detectLanguage(null), "other");
  assert.equal(detectLanguage("12345 !!!"), "other");
});

test("Cyrillic wins over Latin stopwords in a mixed review", () => {
  // Script is the stronger signal — a stray Latin word must not flip it.
  assert.equal(detectLanguage("Кассир the персонал очень good"), "ru");
});

test("tags topics in Romanian", () => {
  assert.deepEqual(extractTopics("Cozi enorme la case, am stat 25 de minute").sort(), [
    "queues",
  ]);
  assert.ok(extractTopics("Am cumpărat iaurt expirat").includes("freshness"));
  assert.ok(extractTopics("Personalul a fost nepoliticos").includes("staff"));
});

test("tags topics in Russian", () => {
  // Regression guard: a plain \b word boundary is ASCII-only and never matches
  // before a Cyrillic letter, which silently dropped every Russian tag.
  assert.ok(extractTopics("Огромная очередь на кассе").includes("queues"));
  assert.ok(extractTopics("Кассир нахамила").includes("staff"));
  assert.ok(extractTopics("Продукты просроченные").includes("freshness"));
});

test("tags nothing when nothing matches", () => {
  assert.deepEqual(extractTopics("Bine"), []);
  assert.deepEqual(extractTopics(null), []);
});

test("a review can carry more than one topic", () => {
  const topics = extractTopics("Cozi mari la case și personalul nepoliticos");
  assert.ok(topics.includes("queues"));
  assert.ok(topics.includes("staff"));
});

test("sentiment follows the stars", () => {
  assert.equal(sentimentFromRating(1), "negative");
  assert.equal(sentimentFromRating(2), "negative");
  assert.equal(sentimentFromRating(3), "neutral");
  assert.equal(sentimentFromRating(4), "positive");
  assert.equal(sentimentFromRating(5), "positive");
});
