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
function auditClaims(item) {
  const source = normalizeEvidence(sourceTextFor(item));
  const claims = Array.isArray(item?.claims) ? item.claims : [];
  const audited = claims.map(claim => {
    if (!claim || typeof claim !== "object") return { claim: String(claim || ""), status: "unverified", evidence: "Geen controleerbaar bewijs opgeslagen.", auditReason: "missing_claim_record" };
    const evidence = String(claim.evidence || "").trim();
    const normalizedEvidence = normalizeEvidence(evidence);
    const evidencePresentInSource = normalizedEvidence.length >= 12 && source.includes(normalizedEvidence);
    const claimWords = normalizeEvidence(claim.claim || "").split(/\\s+/).filter(w => w.length > 2 && !new Set(["the","and","but","for","with","from","that","this","zijn","heeft","heeft","wordt","werd","zijn","een","het","van","voor","bij","door","over","na","als","was","met","een","dat","die","der","des","und","ist","the"]).has(w));
    const evidenceWords = new Set(normalizedEvidence.split(/\\s+/).filter(w => w.length > 2));
    const sharedClaimWords = claimWords.filter(w => evidenceWords.has(w));
    const claimMatchesEvidence = claimWords.length > 0 && sharedClaimWords.length > 0;
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
  if (ev.evidenceLevel === "rss_title_and_description_only" || /RSS-CONTROLE, GEEN ONAFHANKELIJKE FACTCHECK/i.test(String(item?.verification_notes || item?.verificationNotes || ""))) add("Alleen RSS-gegevens gebruikt; dit is geen onafhankelijke factcheck.");
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
  const strongClaims = /\b(topfit|volledig hersteld|onschuldig verklaard|garandeert|bevestigt|zeker dat|zal zeker|definitief bewezen|zonder twijfel)\b/i;
  if (strongClaims.test(text) && !strongClaims.test(feedText)) add("Mogelijk sterkere bewering dan de bron ondersteunt; controleer de nuance.");
  if (item?.languagePolish === "failed" || item?.languagePolish === "failed_invalid_response") add("Automatische taalredactie is mislukt; controleer en herschrijf de tekst handmatig.");
  else if (!item?.languagePolish || item?.languagePolish === "not_run" || item?.languagePolish === "skipped_no_source_text") add("Automatische taalredactie is niet uitgevoerd; controleer de Nederlandse tekst handmatig.");
  const claims = Array.isArray(item?.claims) ? item.claims : []; const unverified = claims.filter(c => !c || c.status !== "supported_by_feed");
  if (unverified.length) add(String(unverified.length) + " claim(s) zijn niet letterlijk onderbouwd door de opgeslagen brongegevens.");
  if (claims.length === 0) add("Geen claim-voor-claim-bewijs opgeslagen; controleer alle feitelijke beweringen handmatig.");
  return { warnings, warningCount: warnings.length, claimsChecked: claims.length, claimsUnverified: unverified.length, independentFactCheck: false, publishableAutomatically: false };
}
module.exports = { auditClaims, editorialQuality, normalizeEvidence, sourceTextFor };
