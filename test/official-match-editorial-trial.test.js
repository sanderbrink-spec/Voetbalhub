"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { editorialQuality } = require("../editorial-quality");

// A real historical official match page is used for a non-publishing editorial trial.
// Do not mark Flashscore verification true: it has not been independently performed.
test("official-match trial remains blocked until independent score verification", () => {
  const result = editorialQuality({
    headline: "FC Groningen wint met 4-1 van Heracles Almelo",
    standfirst: "FC Groningen boekte op 23 april 2025 een thuiszege tegen Heracles Almelo.",
    body: [
      "FC Groningen speelde op woensdag 23 april 2025 thuis tegen Heracles Almelo. De officiële wedstrijdpagina van de club vermeldt een eindstand van 4-1. Daarmee is de uitslag terug te vinden bij de organiserende club, maar een onafhankelijke controle is nog nodig.",
      "De wedstrijdgegevens van FC Groningen noemen de Euroborg als locatie en Ingmar Oostrom als scheidsrechter. Deze gegevens zijn afkomstig van dezelfde clubpagina. Ze vormen een controleerbaar vertrekpunt voor een eigen verslag, maar nog geen tweede bevestiging.",
      "Volgens de gepubliceerde wedstrijdstatistieken had FC Groningen zes schoten op doel en Heracles Almelo drie. De cijfers zijn nog niet afzonderlijk geverifieerd. Daarom blijft dit proefverslag uitsluitend bestemd voor interne redactionele beoordeling."
    ],
    source: { url: "https://www.fcgroningen.nl/wedstrijd/fc-groningen-vs-heracles-almelo-2/", title: "FC Groningen vs Heracles Almelo", description: "FC Groningen - Heracles Almelo 4-1 op woensdag 23 april." },
    sourceEvidence: { evidenceLevel: "article_text_extracted", content: "FC Groningen Heracles Almelo 4 1 woensdag 23 april Euroborg Ingmar Oostrom zes schoten op doel drie schoten op doel. ".repeat(4) },
    sourcePolicy: { status: "primary_fact_check_only" },
    claims: [],
    languagePolish: "not_run",
    claimsRecheckedAgainstFinalText: false,
    autoPublish: false
  });
  assert.equal(result.publishableAutomatically, false);
  assert.equal(result.independentFactCheck, false);
  assert.ok(result.warnings.some(w => /Flashscore/.test(w)), result.warnings.join(" | "));
});
