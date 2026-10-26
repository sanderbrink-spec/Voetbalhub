"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { headlineContradictions, editorialQuality } = require("../editorial-quality");

const contradictory = [
  "FC Twente wint en speelt gelijk tegen AZ",
  "AZ versloeg Twente, maar het duel eindigde gelijk",
  "FC Twente boekt zege en haalt gelijkspel",
  "PSV won met 2-0 en de wedstrijd eindigde in een puntendeling"
];
for (const headline of contradictory) {
  test("blocks contradictory headline: " + headline, () => {
    assert.equal(headlineContradictions({ headline }), true);
    const review = editorialQuality({ headline });
    assert.equal(review.qualityScore, 0);
    assert.ok(review.warnings.some(w => w.includes("Tegenstrijdige kop")));
    assert.equal(review.publishableAutomatically, false);
  });
}
const valid = [
  "FC Twente wint met 2-0 van AZ",
  "AZ speelt met 2-2 gelijk tegen FC Twente",
  "PSV wint, terwijl Ajax gelijk speelt",
  "Na het gelijkspel van vorige week wint PSV nu"
];
for (const headline of valid) {
  test("does not flag a valid headline: " + headline, () => {
    assert.equal(headlineContradictions({ headline }), false);
  });
}
