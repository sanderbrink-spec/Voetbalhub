"use strict";
function normalizeEvidence(value) {
  return String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase()
    .replace(/&amp;/g, "&").replace(/[’‘]/g, "'").replace(/[^a-z0-9]+/g, " ").trim().replace(/\s+/g, " ");
}
function sourceTextFor(item) {
  const src = item?.source || {}; const ev = item?.sourceEvidence || {};
  return [src.title, src.description, ev.title, ev.description, ev.excerpt, ev.content,
    item?.feedTitle, item?.feedDescription, item?.sourceTitle, item?.sourceDescription]
    .filter(v => typeof v === "string").join("\n");
}
function hasLongVerbatimOverlap(source, draft) {
  const words = value => normalizeEvidence(value).split(/\s+/).filter(Boolean);
  const sourceWords = words(source), draftWords = words(draft);
  if (sourceWords.length < 8 || draftWords.length < 8) return false;
  const phrases = new Set();
  for (let i = 0; i <= sourceWords.length - 8; i++) phrases.add(sourceWords.slice(i, i + 8).join(" "));
  let matches = 0;
  for (let i = 0; i <= draftWords.length - 8; i++) {
    if (phrases.has(draftWords.slice(i, i + 8).join(" ")) && ++matches >= 2) return true;
  }
  return false;
}
function headlineContradictions(item) {
  const headline = String(item?.headline || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  const saysWin = /\b(wint|won|verslaat|versloeg|zege|gewonnen|winst|wint met|zege met)\b/.test(headline);
  const saysDraw = /\b(gelijkspel|speelt gelijk|speelden gelijk|eindigt gelijk|eindigde gelijk|haalt gelijkspel|puntendeling|deling van punten)\b/.test(headline);
  const winScore = /\b(?:wint met|zege met|verslaat|versloeg)\s+(?:een\s+)?\d+\s*[-–:]\s*\d+\b/.test(headline);
  // A past draw mentioned as context is not a contradictory result for today.
  const historicalDraw = /\b(?:na|sinds|ondanks)\s+(?:(?:het|een)\s+)?gelijkspel\b/.test(headline);
  const otherDraw = headline.replace(/\b(?:na|sinds|ondanks)\s+(?:(?:het|een)\s+)?gelijkspel\b/g, "");
  const remainingDraw = /\b(gelijkspel|speelt gelijk|speelden gelijk|eindigt gelijk|eindigde gelijk|haalt gelijkspel|puntendeling|deling van punten)\b/.test(otherDraw);
  return (saysWin || winScore) && saysDraw && (!historicalDraw || remainingDraw);
}
function auditClaims(item) {
  const source = normalizeEvidence(sourceTextFor(item));
  const claims = Array.isArray(item?.claims) ? item.claims : [];
  const audited = claims.map(claim => {
    if (!claim || typeof claim !== "object") return { claim: String(claim || ""), status: "unverified", evidence: "Geen controleerbaar bewijs opgeslagen.", auditReason: "missing_claim_record" };
    const evidence = String(claim.evidence || "").trim();
    const normalizedEvidence = normalizeEvidence(evidence);
    const evidencePresentInSource = normalizedEvidence.length >= 12 && source.includes(normalizedEvidence);
    const claimWords = normalizeEvidence(claim.claim || "").split(/\s+/).filter(w => w.length > 2 && !new Set(["the","and","but","for","with","from","that","this","zijn","heeft","heeft","wordt","werd","zijn","een","het","van","voor","bij","door","over","na","als","was","met","een","dat","die","der","des","und","ist","the"]).has(w));
    const evidenceWords = new Set(normalizedEvidence.split(/\s+/).filter(w => w.length > 2));
    const sharedClaimWords = claimWords.filter(w => evidenceWords.has(w));
    const claimMatchesEvidence = claimWords.length >= 2 && sharedClaimWords.length >= 2 && sharedClaimWords.length / claimWords.length >= 0.25;
    const supported = evidencePresentInSource && claimMatchesEvidence;
    if (claim.status === "supported_by_feed" && !supported) return {
      ...claim, status: "unverified", evidence: "Niet voldoende letterlijk gekoppeld aan de claim in de opgeslagen brongegevens.",
      auditReason: !evidence ? "missing_evidence" : (!evidencePresentInSource ? "evidence_not_literal_source_match" : "claim_evidence_mismatch")
    };
    if (claim.status === "supported_by_feed" && supported) return { ...claim, auditReason: "evidence_literal_source_match" };
    return {
      ...claim, status: "unverified",
      evidence: supported ? evidence : "Niet voldoende letterlijk gekoppeld aan de claim in de opgeslagen brongegevens.",
      auditReason: supported ? "evidence_literal_source_match_but_claim_not_preapproved" : (!evidence ? "missing_evidence" : (!evidencePresentInSource ? "evidence_not_literal_source_match" : "claim_evidence_mismatch"))
    };
  });
  return { ...item, claims: audited };
}
function editorialQuality(item) {
  const headline = String(item?.headline || ""); const standfirst = String(item?.standfirst || "");
  const body = Array.isArray(item?.body) ? item.body.filter(v => typeof v === "string") : [];
  const text = [headline, standfirst, ...body].join(" "); const src = item?.source || {};
  const ev = item?.sourceEvidence || {}; const feedText = sourceTextFor(item); const warnings = [];
  const add = message => { if (!warnings.includes(message)) warnings.push(message); };
  if (!src.url && !item?.sourceUrl) add("Geen oorspronkelijke bronlink opgeslagen.");
  if (!feedText.trim()) add("Geen bronkop of bronbeschrijving opgeslagen; feitelijke controle is niet mogelijk.");
  if (item?.sourcePolicy?.status === "link_only") add("Bronbeleid staat alleen doorlinken toe; gebruik de uitgeverspagina niet als grondtekst voor een vervangend artikel.");
  if (["unapproved", "unknown"].includes(item?.sourcePolicy?.status)) add("Bronbeleid is niet goedgekeurd; controleer gebruiksrechten en onafhankelijk bewijs voordat je een artikel maakt.");
  if (feedText.trim() && text.trim() && hasLongVerbatimOverlap(feedText, text)) add("Mogelijke lange letterlijke tekstoverlap met de bron; herschrijf zelfstandig op basis van gecontroleerde feiten.");
  // The standard disclaimer is attached to every draft, including drafts with extracted article text.
  // Do not mistake that disclaimer for evidence that the item is RSS-only; inspect the evidence level/content.
  const hasUsableArticleEvidence = (ev.evidenceLevel === "article_text_extracted" &&
    ((typeof ev.content === "string" && ev.content.trim().length >= 250) ||
     (typeof ev.excerpt === "string" && ev.excerpt.trim().length >= 250)));
  if (ev.evidenceLevel === "rss_title_and_description_only" || (!hasUsableArticleEvidence && !String(ev.content || "").trim() && !String(ev.excerpt || "").trim())) {
    add("Alleen RSS-kop/beschrijving beschikbaar; dit is geen onafhankelijke factcheck.");
  }
  const englishPhrases = /\b(happy at|unsure about|according to|the club|is taken to|was taken to|could be|will be|he said|she said|they said|after collapsing|over the summer|in difficult position|best team in|today's other quizzes|saturday's gossip|could be sidelined)\b/i;
  const englishHeadlineWords = /\b(happy|unsure|after|before|could|would|should|taken|hospital|collapsing|training|deal|transfer|says|said|January|February|March|April|May|June|July|August|September|October|November|December|fear|fears|gossip|quizzes)\b/i;
  const englishStopWords = (headline.match(/\b(the|and|but|after|before|could|would|says|said|with|from|over|for|to|in|at|may|fear|fears)\b/gi) || []).length;
  if (englishPhrases.test(text)) add("Engelse zinsdelen gevonden; herschrijf naar natuurlijk Nederlands.");
  if (englishHeadlineWords.test(headline) || (headline.trim().split(/\s+/).length >= 5 && englishStopWords >= 2)) add("Kop bevat mogelijk Engelse formuleringen; controleer de Nederlandse vertaling.");
  const normWords = value => new Set(normalizeEvidence(value).split(/\s+/).filter(w => w.length > 3));
  const introWords = normWords(standfirst); const bodyWords = normWords(body.join(" ")); let shared = 0;
  for (const word of introWords) if (bodyWords.has(word)) shared++;
  if (introWords.size > 8 && shared / introWords.size > 0.8) add("Intro en artikeltekst herhalen grotendeels dezelfde informatie; maak de body aanvullend.");
  if (/\b(NFL|American football|Pittsburgh Steelers|New Orleans Saints)\b/i.test(text) && /\b(Trump|Paris Saint-Germain|PSG|Eredivisie|Champions League|voetbalclub|voetbaltrainer)\b/i.test(text)) add("Mogelijk zijn losse onderwerpen samengevoegd; houd het concept bij één voetbalnieuwsgebeurtenis.");
  if (/\b(quiz(?:zen|zes)?|brainteaser|who am i|five in five|gossip|transfer gossip|roddelrubriek)\b/i.test([headline, standfirst].join(" "))) add("Dit lijkt een quiz- of roddelrubriek in plaats van zelfstandig voetbalnieuws; zet apart of sla over.");
  if (/\b(plus more|and more|other stories|also today)\b/i.test(text)) add("Mogelijk een verzamelbericht met meerdere onderwerpen; splits het op in afzonderlijke nieuwsitems.");
  const strongClaims = /\b(topfit|volledig hersteld|onschuldig verklaard|garandeert|bevestigt|zeker dat|zal zeker|definitief bewezen|zonder twijfel)\b/i;
  if (strongClaims.test(text) && !strongClaims.test(feedText)) add("Mogelijk sterkere bewering dan de bron ondersteunt; controleer de nuance.");
  // A numerical claim is a high-risk factual detail: warn if any number in the final
  // headline/intro/body cannot be found in the stored source text. This is a signal,
  // not proof of an error, because the source extraction may be incomplete.
  const sourceNumbers = new Set((normalizeEvidence(feedText).match(/\b\d+(?:[.,]\d+)?\b/g) || []).map(n => n.replace(",", ".")));
  const articleNumbers = [...new Set((normalizeEvidence(text).match(/\b\d+(?:[.,]\d+)?\b/g) || []).map(n => n.replace(",", ".")))];
  const unsupportedNumbers = articleNumbers.filter(n => !sourceNumbers.has(n));
  // Also compare number words: editorial copy often spells out scores/counts
  // (for example "acht doelpunten") instead of using digits ("8 doelpunten").
  const numberWords = ["twee","drie","vier","vijf","zes","zeven","acht","negen","tien","elf","twaalf","dertien","veertien","vijftien","zestien","zeventien","achttien","negentien","twintig","dertig","veertig","vijftig","zestig","zeventig","tachtig","negentig","honderd","duizend"];
  const sourceNumberWords = new Set(normalizeEvidence(feedText).split(/\s+/).filter(w => numberWords.includes(w)));
  const articleNumberWords = [...new Set(normalizeEvidence(text).split(/\s+/).filter(w => numberWords.includes(w)))];
  const unsupportedNumberWords = articleNumberWords.filter(w => !sourceNumberWords.has(w));
  if ((unsupportedNumbers.length || unsupportedNumberWords.length) && feedText.trim()) {
    const missing = [...unsupportedNumbers, ...unsupportedNumberWords];
    add("Controleer cijfers in kop/intro/tekst die niet letterlijk in de opgeslagen bron staan: " + missing.slice(0, 8).join(", ") + (missing.length > 8 ? "…" : "") + ". Mogelijk ontbreekt broncontext of is een uitslag/statistiek onjuist.");
  }
  if (item?.languagePolish === "ai_edited_source_limited" && item?.claimsRecheckedAgainstFinalText !== true) add("AI heeft kop en artikeltekst herschreven; de opgeslagen claims zijn niet automatisch opnieuw uit de definitieve tekst gehaald. Controleer elke feitelijke bewering in kop, intro en body rechtstreeks bij de oorspronkelijke bron.");
  const finalText = normalizeEvidence(text);
  const claimRecords = Array.isArray(item?.claims) ? item.claims : [];
  const unrelatedClaims = claimRecords.filter(c => {
    const words = normalizeEvidence(c?.claim || "").split(/\s+/).filter(w => w.length > 3);
    if (words.length < 3) return false;
    const finalWords = new Set(finalText.split(/\s+/));
    return words.filter(w => finalWords.has(w)).length / words.length < 0.25;
  });
  if (unrelatedClaims.length) add(unrelatedClaims.length + " opgeslagen claim(s) sluiten onvoldoende aan op de definitieve tekst; controleer de claims opnieuw.");
  if (item?.languagePolish === "skipped_rss_only_source") add("AI-herschrijving bewust overgeslagen: alleen RSS-kop/beschrijving beschikbaar. Dit concept niet als uitgewerkt artikel behandelen; open de oorspronkelijke bron en controleer alle feiten.");
  if (item?.languagePolish === "failed" || item?.languagePolish === "failed_invalid_response") add("Automatische taalredactie is mislukt; controleer en herschrijf de tekst handmatig.");
  else if (!item?.languagePolish || item?.languagePolish === "not_run" || item?.languagePolish === "skipped_no_source_text") add("Automatische taalredactie is niet uitgevoerd; controleer de Nederlandse tekst handmatig.");
  const claims = Array.isArray(item?.claims) ? item.claims : []; const unverified = claims.filter(c => !c || c.status !== "supported_by_feed");
  if (unverified.length) add(String(unverified.length) + " claim(s) zijn niet letterlijk onderbouwd door de opgeslagen brongegevens.");
  if (claims.length === 0) add("Geen claim-voor-claim-bewijs opgeslagen; controleer alle feitelijke beweringen handmatig.");
  if (headlineContradictions(item)) add("Tegenstrijdige kop: de tekst stelt zowel een overwinning als een gelijkspel. Controleer de officiële eindstand en herschrijf de kop.");
  if (!headline.trim()) add("Geen definitieve kop; concept is niet klaar voor redactionele beoordeling.");
  if (!standfirst.trim()) add("Intro ontbreekt; controleer of het belangrijkste nieuwsfeit helder wordt uitgelegd.");
  if (body.length === 0) add("Geen artikelalinea's beschikbaar; dit is nog geen uitgewerkt verslag.");
  if (body.length > 0 && body.length < 3) add("Te weinig artikelalinea's voor een zelfstandig nieuwsverslag; streef naar minimaal drie inhoudelijke alinea's.");
  if (body.some(p => String(p).trim().length < 70)) add("Minstens één artikelalinea is korter dan 70 tekens; controleer of die inhoudelijk voldoende toevoegt.");
  const normalizedParagraphs = body.map(p => normalizeEvidence(p)).filter(Boolean);
  if (new Set(normalizedParagraphs).size !== normalizedParagraphs.length) add("Dubbele artikelalinea's gevonden; verwijder herhaling.");
  if (body.some(p => String(p).trim().length < 35)) add("Minstens één artikelalinea is erg kort; controleer of die inhoudelijk iets toevoegt.");
  const sourceUrl = String(src.url || item?.sourceUrl || "").trim();
  if (sourceUrl && !/^https:\/\//i.test(sourceUrl)) add("Bronlink gebruikt geen HTTPS; controleer de link voordat je deze opent of publiceert.");
  const hasArticleText = typeof ev.content === "string" && ev.content.trim().length >= 250 ||
    typeof ev.excerpt === "string" && ev.excerpt.trim().length >= 250;
  // Mandatory Flashscore check for match/player statistics. A source article or RSS text alone is not verification.
  const statsClaimPattern = /\b(statistiek(?:en)?|balbezit|schoten|schoten op doel|corners|hoekschoppen|doelpuntenmaker|assist(?:s)?|xg|expected goals|reddingen|passes|passnauwkeurigheid|gele kaarten|rode kaarten|wedstrijdcijfers|score van|eindstand|won met \d|versloeg .* met \d|\d+\s*[-–:]\s*\d+)\b/i;
  const hasMatchStatsClaims = statsClaimPattern.test([headline, standfirst, ...body].join(" "));
  const flashscoreVerified = item?.flashscoreVerified === true || item?.verification?.flashscoreVerified === true || item?.statsVerification?.provider === "Flashscore" && item?.statsVerification?.verified === true;
  if (hasMatchStatsClaims && !flashscoreVerified) add("VERPLICHT: wedstrijd- en spelersstatistieken zijn niet als gecontroleerd via Flashscore vastgelegd. Controleer uitslag, doelpuntenmakers, assists en genoemde cijfers op Flashscore voordat je publiceert.");
  if (!hasArticleText) add("Geen volledige artikeltekst opgeslagen; RSS-kop en -beschrijving zijn onvoldoende voor inhoudelijke factcontrole.");
  const normalizedBody = body.map(p => normalizeEvidence(p)).filter(Boolean);
  const structureReady = !!headline.trim() && !!standfirst.trim() && body.length >= 3 && body.length <= 5 &&
    body.every(p => String(p).trim().length >= 70) && new Set(normalizedBody).size === normalizedBody.length;
  const sourceReady = /^https:\/\//i.test(sourceUrl) && hasArticleText && ev.evidenceLevel === "article_text_extracted";
  const claimsReady = claims.length > 0 && unverified.length === 0 && item?.claimsRecheckedAgainstFinalText === true && unrelatedClaims.length === 0;
  const languageReady = item?.languagePolish === "ai_edited_source_limited" && item?.claimsRecheckedAgainstFinalText === true &&
    !englishPhrases.test(text) && !englishHeadlineWords.test(headline) && !["failed", "failed_invalid_response", "not_run", "skipped_no_source_text"].includes(item?.languagePolish);
  const hasHeadlineContradiction = headlineContradictions(item);
  const scoreLimitations = [];
  let scoreCap = 100;
  if (hasHeadlineContradiction) { scoreCap = 0; scoreLimitations.push("Tegenstrijdige uitslag in de kop: publicatie moet worden geblokkeerd."); }
  if (!structureReady) { scoreCap = Math.min(scoreCap, 35); scoreLimitations.push("Artikelstructuur voldoet nog niet aan de minimale eisen."); }
  if (!sourceReady) { scoreCap = Math.min(scoreCap, 45); scoreLimitations.push("Volledige broninformatie of een geldige bronlink ontbreekt."); }
  if (!claimsReady) { scoreCap = Math.min(scoreCap, 65); scoreLimitations.push("Claims zijn niet allemaal onderbouwd en opnieuw gecontroleerd tegen de definitieve tekst."); }
  if (!languageReady) { scoreCap = Math.min(scoreCap, 70); scoreLimitations.push("Taalredactie en hercontrole van de definitieve tekst zijn niet aantoonbaar afgerond."); }
  if (item?.sourcePolicy?.status === "link_only") { scoreCap = Math.min(scoreCap, 25); scoreLimitations.push("Deze bron mag volgens het opgeslagen bronbeleid alleen als link worden gebruikt."); }
  else if (["unapproved", "unknown"].includes(item?.sourcePolicy?.status)) { scoreCap = Math.min(scoreCap, 40); scoreLimitations.push("Bronbeleid en gebruiksrechten zijn niet goedgekeurd."); }
  else if (item?.sourcePolicy?.status === "data_provider") { scoreCap = Math.min(scoreCap, 80); scoreLimitations.push("Voorwaarden en attributie van de dataleverancier moeten nog worden bevestigd."); }
  if (item?.editorialStatus === "rejected_low_priority" || item?.editorialStatus === "rejected_verbatim_overlap") { scoreCap = Math.min(scoreCap, 20); scoreLimitations.push("Concept is redactioneel afgewezen."); }
  const automaticQualityScore = Math.max(0, Math.min(scoreCap, 100 - warnings.length * 6 - unverified.length * 4));
  const riskLevel = warnings.length >= 5 || unverified.length >= 3 ? "high" :
    warnings.length >= 2 || unverified.length >= 1 ? "medium" : "low";
  return {
    warnings,
    qualityScore: automaticQualityScore,
    qualityScoreLabel: automaticQualityScore >= 90 ? "Uitstekend" : automaticQualityScore >= 75 ? "Goed, laatste controles nodig" : automaticQualityScore >= 50 ? "Herzien" : "Onvoldoende",
    qualityScoreNote: "Automatische redactiescore, geen garantie op feitelijke juistheid; onafhankelijke factcheck blijft apart vereist.",
    scoreLimitations,
    warningCount: warnings.length,
    claimsChecked: claims.length,
    claimsUnverified: unverified.length,
    riskLevel,
    readiness: warnings.length || unverified.length || !headline.trim() || !standfirst.trim() || !body.length ? "review_required" : "ready_for_human_review",
    independentFactCheck: false,
    publishableAutomatically: false
  };
}
module.exports = { auditClaims, editorialQuality, headlineContradictions, normalizeEvidence, sourceTextFor };
