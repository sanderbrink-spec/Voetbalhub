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
  const result = normalizeEditorialResponse({ editorialDecision: "keep", headline: " Nederlandse kop ", standfirst: " Korte intro ", body: [" Eerste alinea met voldoende inhoud om een zelfstandig nieuwsverslag te ondersteunen en de belangrijkste feiten helder te beschrijven. ", "", " Tweede alinea met aanvullende context die uitlegt wat er gebeurde en waarom dat relevant is voor de club en de competitie. ", "Derde alinea met extra controleerbare details en een duidelijke afronding zonder nieuwe onbewezen beweringen."] });
  assert.equal(result.ok, true);
  assert.equal(result.value.headline, "Nederlandse kop");
  assert.deepEqual(result.value.body, ["Eerste alinea met voldoende inhoud om een zelfstandig nieuwsverslag te ondersteunen en de belangrijkste feiten helder te beschrijven.", "Tweede alinea met aanvullende context die uitlegt wat er gebeurde en waarom dat relevant is voor de club en de competitie.", "Derde alinea met extra controleerbare details en een duidelijke afronding zonder nieuwe onbewezen beweringen."]);
});
test("normalizes a string body with line separators", () => {
  const result = normalizeEditorialResponse({ editorialDecision: "keep", headline: "Kop", standfirst: "Intro", body: "Eerste alinea met voldoende inhoud om een zelfstandig nieuwsverslag te ondersteunen en de belangrijkste feiten helder te beschrijven.\n\nTweede alinea met aanvullende context die uitlegt wat er gebeurde en waarom dat relevant is voor de club en de competitie.\n\nDerde alinea met extra controleerbare details en een duidelijke afronding zonder nieuwe onbewezen beweringen." });
  assert.equal(result.ok, true);
  assert.equal(result.value.body.length, 3);
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
test("rejects keep responses with fewer than three paragraphs", () => {
  const result = normalizeEditorialResponse({ editorialDecision: "keep", headline: "Kop", standfirst: "Intro", body: ["Een voldoende lange alinea met meer dan zeventig tekens zodat de validator deze eerste alinea accepteert.", "Een tweede voldoende lange alinea met extra context en controleerbare informatie voor de lezer."] });
  assert.equal(result.ok, false);
  assert.match(result.reason, /minder dan drie/);
});
test("rejects short paragraphs even when three are supplied", () => {
  const result = normalizeEditorialResponse({ editorialDecision: "keep", headline: "Kop", standfirst: "Intro", body: ["Kort", "Een tweede voldoende lange alinea met extra context en controleerbare informatie voor de lezer.", "Een derde voldoende lange alinea met extra context en controleerbare informatie voor de lezer."] });
  assert.equal(result.ok, false);
  assert.match(result.reason, /korter dan 70 tekens/);
});
test("rejects missing or unknown decisions and non-object responses", () => {
  assert.equal(normalizeEditorialResponse({ headline: "Kop" }).ok, false);
  assert.equal(normalizeEditorialResponse({ editorialDecision: "maybe" }).ok, false);
  assert.equal(normalizeEditorialResponse(null).ok, false);
});
