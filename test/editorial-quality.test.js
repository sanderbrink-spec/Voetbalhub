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

test("warns when article numbers are not present in stored source text", () => {
  const result = editorialQuality({
    headline: "Ajax scoort zeven keer uit corners",
    standfirst: "De ploeg maakte acht doelpunten uit hoekschoppen.",
    body: ["De cijfers moeten worden gecontroleerd."],
    source: { url: "https://example.com/story", title: "Ajax scoorde zeven keer uit een hoekschop." },
    sourceEvidence: { content: "Ajax scoorde zeven keer uit een hoekschop." },
    claims: []
  });
  assert.ok(result.warnings.some(w => w.includes("Cijfers in kop/intro/tekst") || w.includes("Controleer cijfers")));
  assert.equal(result.publishableAutomatically, false);
});

test("does not call extracted article text RSS-only just because the standard disclaimer exists", () => {
  const result = editorialQuality({
    headline: "Clasie verklaart ruzie met Zerrouki",
    standfirst: "Clasie reageerde na afloop van AZ tegen FC Twente.",
    body: ["De aanvoerder was kritisch op het gedrag na de wedstrijd."],
    source: { url: "https://example.com/story", title: "Clasie verklaart ruzie met Zerrouki" },
    sourceEvidence: {
      evidenceLevel: "article_text_extracted",
      content: "Een volledige en voldoende lange bronpassage met de context van het artikel en de beschreven gebeurtenis. ".repeat(4)
    },
    verification_notes: "RSS-CONTROLE, GEEN ONAFHANKELIJKE FACTCHECK: dit is een standaarddisclaimer.",
    claims: []
  });
  assert.ok(!result.warnings.some(w => w.includes("Alleen RSS-kop/beschrijving beschikbaar")));
  assert.equal(result.independentFactCheck, false);
});


test("flags articles with too few or very short paragraphs", () => {
  const result = editorialQuality({
    headline: "FC Groningen wint thuis",
    standfirst: "FC Groningen boekte een belangrijke overwinning.",
    body: ["FC Groningen won de wedstrijd."],
    source: { url: "https://example.com/story", title: "FC Groningen wint" },
    sourceEvidence: { evidenceLevel: "article_text_extracted", content: "Een volledige bronpassage met meer dan genoeg tekst voor deze test. ".repeat(5) },
    claims: [{ claim: "FC Groningen won", status: "supported_by_feed", evidence: "FC Groningen won de wedstrijd." }]
  });
  assert.ok(result.warnings.some(w => w.includes("minimaal drie inhoudelijke alinea's")));
  assert.ok(result.warnings.some(w => w.includes("korter dan 70 tekens")));
  assert.equal(result.publishableAutomatically, false);
});

test("flags duplicate article paragraphs", () => {
  const paragraph = "FC Groningen speelde een sterke wedstrijd en pakte uiteindelijk drie belangrijke punten.";
  const result = editorialQuality({
    headline: "FC Groningen pakt drie punten",
    standfirst: "De thuisploeg won een belangrijke wedstrijd.",
    body: [paragraph, paragraph, paragraph],
    source: { url: "https://example.com/story", title: "FC Groningen wint" },
    sourceEvidence: { evidenceLevel: "article_text_extracted", content: "Een volledige bronpassage met meer dan genoeg tekst voor deze test. ".repeat(5) },
    claims: [{ claim: "FC Groningen won", status: "supported_by_feed", evidence: "FC Groningen speelde een sterke wedstrijd en pakte uiteindelijk drie belangrijke punten." }]
  });
  assert.ok(result.warnings.some(w => w.includes("Dubbele artikelalinea's")));
  assert.equal(result.publishableAutomatically, false);
});


test("awards 100 only when automated editorial checks are complete", () => {
  const sourceText = "De redactie bewaart aanvullende broninformatie voor controle en archivering. ".repeat(5);
  const result = editorialQuality({
    headline: "FC Groningen bereidt zich voor op trainingsweek",
    standfirst: "De technische staf gebruikt de komende dagen om de selectie verder voor te bereiden.",
    body: [
      "Na de rustdag staat de voorbereiding van de selectie centraal. De training richt zich op de komende wedstrijd en de afspraken binnen het team.",
      "De technische staf werkt de komende dagen aan de organisatie en de uitvoering van het wedstrijdplan. Daarbij blijft de beschikbare informatie over de selectie leidend.",
      "De komende trainingsmomenten moeten duidelijk maken hoe de ploeg de voorbereiding afrondt. Nieuwe details worden pas opgenomen wanneer ze door controleerbare informatie worden ondersteund."
    ],
    source: { url: "https://www.fcgroningen.nl/nieuws/voorbeeld", title: "FC Groningen hervat de training na een rustdag", description: "De club meldt dat de groep de training na een rustdag hervat." },
    sourceEvidence: { evidenceLevel: "article_text_extracted", content: sourceText },
    sourcePolicy: { status: "primary_fact_check_only" },
    languagePolish: "ai_edited_source_limited",
    claimsRecheckedAgainstFinalText: true,
    claims: [{ claim: "FC Groningen hervat de training na een rustdag", status: "supported_by_feed", evidence: "FC Groningen hervat de training na een rustdag" }]
  });
  assert.equal(result.warningCount, 0, result.warnings.join(" | "));
  assert.equal(result.qualityScore, 100);
  assert.equal(result.editorialAssessment, "passed_automated_checks");
  assert.equal(result.publicationRightsStatus, "requires_manual_clearance");
  assert.equal(result.independentFactCheck, false);
  assert.match(result.qualityScoreNote, /geen garantie op feitelijke juistheid/);
});

test("caps quality score for link-only publishers and missing independent article evidence", () => {
  const result = editorialQuality({
    headline: "Nieuws van een uitgever",
    standfirst: "Bron gevonden, controleer de feiten voordat je zelf een verslag maakt.",
    body: [],
    source: { url: "https://www.voetbalprimeur.nl/nieuws/voorbeeld", title: "Nieuws van een uitgever" },
    sourcePolicy: { status: "link_only" },
    sourceEvidence: { evidenceLevel: "rss_title_and_description_only" },
    claims: []
  });
  assert.ok(result.qualityScore <= 25);
  assert.ok(result.scoreLimitations.some(reason => reason.includes("alleen als link")));
});


test("blocks a headline that claims both a 2-0 win and a draw", () => {
  const result = editorialQuality({
    headline: "FC Twente verslaat AZ met 2-0 en haalt gelijkspel in Eredivisie",
    standfirst: "FC Twente zou de wedstrijd hebben gewonnen.",
    body: [
      "Deze alinea bevat voldoende tekst om de minimale lengtecontrole te passeren, maar zegt niets extra's over de uitslag.",
      "Deze tweede alinea bevat aanvullende tekst om de structurele controle te passeren zonder nieuwe wedstrijdfeiten te verzinnen.",
      "Deze derde alinea sluit het concept af en laat zien dat lengtecontroles op zichzelf geen inhoudelijke juistheid garanderen."
    ],
    source: { url: "https://example.com/match", title: "FC Twente wint van AZ" },
    sourceEvidence: { evidenceLevel: "article_text_extracted", content: "Officiële wedstrijdinformatie is nodig om de uitslag te controleren. ".repeat(5) },
    sourcePolicy: { status: "primary_fact_check_only" },
    languagePolish: "ai_edited_source_limited",
    claimsRecheckedAgainstFinalText: true,
    claims: [{ claim: "FC Twente wint van AZ", status: "supported_by_feed", evidence: "FC Twente wint van AZ" }]
  });
  assert.ok(result.warnings.some(w => w.includes("Tegenstrijdige kop")));
  assert.equal(result.qualityScore, 0);
  assert.ok(result.scoreLimitations.some(reason => reason.includes("Tegenstrijdige uitslag")));
  assert.equal(result.publishableAutomatically, false);
});


test("requires recorded match-stat verification for score and scorer claims", () => {
  const result = editorialQuality({
    headline: "FC Twente verslaat AZ met 2-0",
    standfirst: "FC Twente won de wedstrijd met twee doelpunten.",
    body: [
      "De wedstrijd eindigde in een uitslag die inhoudelijk moet worden gecontroleerd voordat er gepubliceerd kan worden.",
      "De doelpuntenmakers en de tijdstippen moeten aan de hand van officiële wedstrijdgegevens worden bevestigd.",
      "Zonder vastgelegde verificatie blijven score en doelpuntenmakers onzeker en mag het concept niet worden goedgekeurd."
    ],
    source: { url: "https://example.com/match", title: "FC Twente verslaat AZ met 2-0", description: "FC Twente wint met 2-0." },
    sourceEvidence: { evidenceLevel: "article_text_extracted", content: "FC Twente verslaat AZ met 2-0. ".repeat(12) },
    sourcePolicy: { status: "primary_fact_check_only" },
    languagePolish: "ai_edited_source_limited",
    claimsRecheckedAgainstFinalText: true,
    claims: [{ claim: "FC Twente wint met 2-0", status: "supported_by_feed", evidence: "FC Twente verslaat AZ met 2-0" }]
  });
  assert.ok(result.warnings.some(w => w.includes("niet als gecontroleerd via Flashscore vastgelegd")));
  assert.equal(result.publishableAutomatically, false);
});


test("trusted publishers accept source facts without secondary source requirement, but never grant publication rights", () => {
  for (const [url, expected] of [
    ["https://www.vi.nl/nieuws/voorbeeld", "VI"],
    ["https://www.voetbalprimeur.nl/nieuws/voorbeeld", "VoetbalPrimeur"],
    ["https://www.flashscore.nl/wedstrijd/voorbeeld", "Flashscore"]
  ]) {
    const result = editorialQuality({headline:"Voorbeeldbericht",standfirst:"Een voorbeeld van een bronmelding.",body:[],source:{url,title:"Voorbeeldbericht"},sourcePolicy:{status:"link_only"},sourceEvidence:{evidenceLevel:"rss_title_and_description_only"},claims:[]});
    assert.equal(result.trustedSource,expected);
    assert.equal(result.sourceFactAcceptance,"accepted_without_secondary_source");
    assert.equal(result.publishableAutomatically,false);
    assert.equal(result.publicationRightsStatus,"blocked");
  }
  const spoofed = editorialQuality({source:{url:"https://vi.nl.evil.example/story"}});
  assert.equal(spoofed.trustedSource,null);
  assert.equal(spoofed.sourceFactAcceptance,"requires_source_review");
});


test("final Flashscore result must match article score", () => {
  const base = {headline:"FC Groningen wint met 2-0",standfirst:"De thuisploeg wint de wedstrijd.",body:["Een voorbeeldalinea met wedstrijdinformatie die later wordt gecontroleerd.","De tweede alinea geeft aanvullende wedstrijdinformatie voor redactionele toetsing.","De derde alinea sluit het concept af zonder onbevestigde spelersnamen."],source:{url:"https://www.fcgroningen.nl/nieuws/voorbeeld",title:"FC Groningen wint met 2-0"},sourceEvidence:{evidenceLevel:"article_text_extracted",content:"FC Groningen wint met 2-0. ".repeat(20)},sourcePolicy:{status:"primary_fact_check_only"},claims:[],statsVerification:{provider:"Flashscore",verified:true,matchStatus:"finished",url:"https://www.flashscore.nl/wedstrijd/voorbeeld",finalScore:"2-0"}};
  const good = editorialQuality(base);
  assert.ok(!good.warnings.some(w=>w.includes("UITSLAGBLOKKADE")),good.warnings.join(" | "));
  const bad = editorialQuality({...base,statsVerification:{...base.statsVerification,finalScore:"1-0"}});
  assert.ok(bad.warnings.some(w=>w.includes("UITSLAGBLOKKADE")));
  const missing = editorialQuality({...base,flashscoreVerified:true,statsVerification:undefined});
  assert.ok(missing.warnings.some(w=>w.includes("UITSLAGBLOKKADE")));
  const live = editorialQuality({...base,statsVerification:{...base.statsVerification,matchStatus:"live"}});
  assert.ok(live.warnings.some(w=>w.includes("UITSLAGBLOKKADE")));
});


test("trusted VI and VP RSS leads can be accepted without pretending to be publishable articles", () => {
  for (const url of ["https://www.vi.nl/nieuws/test", "https://www.voetbalprimeur.nl/nieuws/test"]) {
    const result = editorialQuality({headline:"Een voetbalbericht met betrouwbare bron",standfirst:"Bronverwijzing",body:[],source:{url,title:"Nieuwsbericht"},sourceEvidence:{title:"Nieuwsbericht",description:"De club heeft een nieuwsbericht bekendgemaakt.",evidenceLevel:"publisher_link_only"},sourcePolicy:{status:"link_only"},claims:[]});
    assert.equal(result.leadAssessment,"accepted_news_lead");
    assert.equal(result.editorialAssessment,"needs_review");
    assert.equal(result.publicationRightsStatus,"blocked");
    assert.equal(result.publishableAutomatically,false);
  }
});

test("impossible victories in matches are flagged even from trusted publisher", () => {
  const result = editorialQuality({headline:"Liverpool in vorm",standfirst:"Bronverwijzing",body:[],source:{url:"https://www.vi.nl/nieuws/liverpool",title:"Liverpool"},sourceEvidence:{title:"Liverpool",description:"Liverpool boekte vijf overwinningen in vier wedstrijden.",evidenceLevel:"publisher_link_only"},sourcePolicy:{status:"link_only"},claims:[]});
  assert.equal(result.leadAssessment,"needs_lead_review");
  assert.match(result.leadReviewReason,/Onmogelijke verhouding/);
});
