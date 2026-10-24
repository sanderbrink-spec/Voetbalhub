"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { auditClaims, editorialQuality } = require("../editorial-quality");
test("flags English headlines and phrases", () => {
  const result = editorialQuality({ headline: "Kompany taken to hospital after collapsing at training", standfirst: "Bayern manager is taken to hospital after collapsing.", body: ["The club says he will be checked."], source: { url: "https://example.com/story", title: "Kompany taken to hospital", description: "Bayern manager taken to hospital." }, sourceEvidence: { evidenceLevel: "rss_title_and_description_only" }, claims: [] });
  assert.ok(result.warnings.some(w => w.includes("Engelse zinsdelen")));
  assert.ok(result.warnings.some(w => w.includes("Kop bevat mogelijk Engelse")));
});
test("flags mixed football and unrelated NFL topics", () => {
  const result = editorialQuality({ headline: "PSG nieuws en Trump maakt zich zorgen over NFL-duel", standfirst: "", body: ["Paris Saint-Germain speelt maandag. Trump spreekt over Pittsburgh Steelers."], source: { url: "https://example.com/story", title: "PSG en NFL" }, claims: [] });
  assert.ok(result.warnings.some(w => w.includes("losse onderwerpen")));
});
test("downgrades claims whose alleged evidence is not literally in source text", () => {
  const item = { headline: "Doku is volledig hersteld", source: { url: "https://example.com/story", title: "Doku voelt zich weer sterk", description: "Doku hoopt opnieuw te beginnen." }, claims: [{ claim: "Doku is volledig hersteld", status: "supported_by_feed", evidence: "Doku is volledig hersteld" }] };
  const audited = auditClaims(item);
  assert.equal(audited.claims[0].status, "unverified");
  assert.match(audited.claims[0].evidence, /Niet voldoende letterlijk gekoppeld/);
});
test("preserves supported status only when evidence occurs in the source", () => {
  const item = { source: { url: "https://example.com/story", title: "Middlesbrough wint met 5-1", description: "Middlesbrough verslaat Bolton met 5-1." }, claims: [{ claim: "Middlesbrough verslaat Bolton met 5-1", status: "supported_by_feed", evidence: "Middlesbrough verslaat Bolton met 5-1" }] };
  assert.equal(auditClaims(item).claims[0].status, "supported_by_feed");
});
test("deduplicates warnings and never allows automatic publication", () => {
  const result = editorialQuality({ headline: "Testkop", standfirst: "", body: [], source: {}, sourceEvidence: { evidenceLevel: "rss_title_and_description_only" }, verification_notes: "RSS-CONTROLE, GEEN ONAFHANKELIJKE FACTCHECK", claims: [] });
  assert.equal(result.warnings.filter(w => w.includes("geen onafhankelijke factcheck")).length, 1);
  assert.equal(result.publishableAutomatically, false);
});

test("downgrades evidence that belongs to a different claim", () => {
  const item = { source: { title: "PSG wedstrijd uitgesteld. Trump spreekt over NFL-duel." }, claims: [{ claim: "Trump maakt zich zorgen over NFL-duel", status: "supported_by_feed", evidence: "PSG wedstrijd uitgesteld" }] };
  assert.equal(auditClaims(item).claims[0].status, "unverified");
});
test("does not automatically upgrade a claim that was already unverified", () => {
  const item = { source: { title: "Middlesbrough verslaat Bolton met 5-1." }, claims: [{ claim: "Middlesbrough verslaat Bolton met 5-1", status: "unverified", evidence: "Middlesbrough verslaat Bolton met 5-1" }] };
  assert.equal(auditClaims(item).claims[0].status, "unverified");
});

test("requires more than a single shared word to support a claim", () => {
  const item = { source: { title: "Arsenal probeert zonder Timber in te lopen op City" }, claims: [{ claim: "Arsenal gaat winnen", status: "supported_by_feed", evidence: "Arsenal probeert zonder Timber in te lopen op City" }] };
  assert.equal(auditClaims(item).claims[0].status, "unverified");
});
test("flags quiz and gossip items for separate editorial handling", () => {
  const result = editorialQuality({ headline: "Wie ben ik? plus de andere quizzen van vandaag", standfirst: "Test je voetbalkennis", body: ["BBC Sport biedt voetbalquizzen."], source: { url: "https://example.com/story", title: "Who am I? Plus today's other quizzes" }, claims: [] });
  assert.ok(result.warnings.some(w => w.includes("quiz- of roddelrubriek")));
});

test("warns that AI-rewritten article text has not had its claims extracted again", () => {
  const result = editorialQuality({ headline: "Nieuwe kop", standfirst: "Nieuwe intro", body: ["Nieuwe alinea"], languagePolish: "ai_edited_source_limited", source: { url: "https://example.com/story", title: "Bronkop" }, claims: [{ claim: "Oorspronkelijke claim", status: "supported_by_feed", evidence: "Bronkop" }] });
  assert.ok(result.warnings.some(w => w.includes("niet automatisch opnieuw uit de definitieve tekst gehaald")));
  assert.equal(result.publishableAutomatically, false);
});


test("warns when saved claims do not match the final article text", () => {
  const result = editorialQuality({
    headline: "Messi krijgt lof van Perez",
    standfirst: "Kenneth Perez prijst Lionel Messi.",
    body: ["De analist noemt Messi een uitzonderlijke speler."],
    source: { url: "https://example.com/story", title: "Perez over Messi" },
    claims: [{ claim: "Arsenal verslaat Chelsea met 4-0 in de finale", status: "supported_by_feed", evidence: "Arsenal verslaat Chelsea met 4-0 in de finale" }]
  });
  assert.ok(result.warnings.some(w => w.includes("sluiten onvoldoende aan op de definitieve tekst")));
  assert.equal(result.publishableAutomatically, false);
});
