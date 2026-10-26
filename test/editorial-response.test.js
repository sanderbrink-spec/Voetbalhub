"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { normalizeEditorialResponse } = require("../editorial-response");

test("accepts a valid skip even when it intentionally has no article body", () => {
  const result = normalizeEditorialResponse({ editorialDecision: "skip", skipReason: "Te weinig onafhankelijke onderbouwing.", headline: "", standfirst: "", body: [] });
  assert.equal(result.ok, true);
  assert.equal(result.value.editorialDecision, "skip");
  assert.match(result.value.skipReason, /onafhankelijke onderbouwing/);
});
test("accepts a valid keep and trims empty paragraphs", () => {
  const result = normalizeEditorialResponse({ editorialDecision: "keep", headline: " Nederlandse kop ", standfirst: " Korte intro ", body: [" Eerste alinea met inhoud. ", "", " Tweede alinea aanvullend. ", "Derde alinea."] });
  assert.equal(result.ok, true);
  assert.equal(result.value.headline, "Nederlandse kop");
  assert.deepEqual(result.value.body, ["Eerste alinea met inhoud.", "Tweede alinea aanvullend."]);
});
test("normalizes a string body with line separators", () => {
  const result = normalizeEditorialResponse({ editorialDecision: "keep", headline: "Kop", standfirst: "Intro", body: "Eerste alinea.\n\nTweede alinea." });
  assert.equal(result.ok, true);
  assert.deepEqual(result.value.body, ["Eerste alinea.", "Tweede alinea."]);
});
test("accepts decision field aliases but preserves strict decisions", () => {
  const result = normalizeEditorialResponse({ editorial_decision: "SKIP", skip_reason: "Lage nieuwswaarde" });
  assert.equal(result.ok, true);
  assert.equal(result.value.editorialDecision, "skip");
  assert.equal(result.value.skipReason, "Lage nieuwswaarde");
});
test("rejects incomplete keep responses", () => {
  const result = normalizeEditorialResponse({ editorialDecision: "keep", headline: "", standfirst: "Intro", body: [] });
  assert.equal(result.ok, false);
  assert.match(result.reason, /mist een kop, intro of artikelalinea/);
});
test("rejects missing or unknown decisions and non-object responses", () => {
  assert.equal(normalizeEditorialResponse({ headline: "Kop" }).ok, false);
  assert.equal(normalizeEditorialResponse({ editorialDecision: "maybe" }).ok, false);
  assert.equal(normalizeEditorialResponse(null).ok, false);
});
