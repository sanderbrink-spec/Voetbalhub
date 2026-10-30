(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.DeskModel = factory();
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  const checks = ['originalSourceReviewed', 'claimsIndependentlyChecked', 'duplicateChecked', 'languageChecked'];
  const words = value => String(value || '').trim().split(/\s+/).filter(Boolean).length;
  function host(value) {
    try {
      const url = new URL(value);
      if (url.protocol !== 'https:' || url.username || url.password) return '';
      return url.hostname.toLowerCase().replace(/^(?:(?:www|feeds|m|mobile|amp)\.)+/, '');
    } catch { return ''; }
  }
  function requiresFlashscore(draft) {
    return /\b(?:\d+\s*[-–:]\s*\d+|uitslag|eindstand|ruststand|ranglijst|klassement|standen?|positie op de ranglijst|puntenaantal|doelsaldo|balbezit|schoten op doel|doelpogingen|hoekschoppen|gele kaarten|rode kaarten|xg|expected goals|doelpuntenmaker|scoreverloop)\b/i
      .test([draft.headline, draft.standfirst, ...(Array.isArray(draft.body) ? draft.body : [])].join(' '));
  }
  function publicationIssues(payload) {
    const issues = [], d = payload.draft || {};
    const body = Array.isArray(d.body) ? d.body.filter(p => typeof p === 'string' && p.trim()).map(p => p.trim()) : [];
    if (words(d.headline) < 5 || words(d.headline) > 14) issues.push('Kop: 5 tot 14 woorden.');
    if (words(d.standfirst) < 8 || words(d.standfirst) > 35) issues.push('Intro: 8 tot 35 woorden.');
    if (body.length < 3 || body.length > 5 || body.some(p => p.length < 70 || words(p) < 18 || words(p) > 120)) issues.push('Tekst: 3 tot 5 alinea’s, elk minimaal 70 tekens en 18 tot 120 woorden.');
    if (!Array.isArray(payload.verifiedFacts) || payload.verifiedFacts.filter(x => typeof x === 'string' && x.trim()).length < 2) issues.push('Vul twee zelf gecontroleerde feiten in.');
    const sources = Array.isArray(payload.sources) ? payload.sources : [];
    const hosts = sources.map(s => host(s?.url));
    if (sources.length < 2 || hosts.some(h => !h) || new Set(hosts.filter(Boolean)).size < 2) issues.push('Voeg twee geldige HTTPS-bronnen van verschillende websites toe.');
    if (requiresFlashscore(d) && !hosts.some(h => /^flashscore\.(?:nl|com|be|de|co\.uk)$/.test(h))) issues.push('Uitslagen, standen en statistieken: voeg de gecontroleerde Flashscore-link toe.');
    const missing = checks.filter(key => payload.editorialChecks?.[key] !== true);
    if (missing.length) issues.push('Rond alle vier redactionele controles af.');
    if (payload.imageUrl && (!host(payload.imageUrl) || !payload.imageSource?.trim() || !payload.imageCredit?.trim() || !['cleared','licensed'].includes(payload.imageRights) || !['kitVerified','playerIdentityVerified','aiDisclosureVerified'].every(k => payload.imageReview?.[k] === true))) issues.push('Rond de beeldgegevens en alle drie beeldcontroles af.');
    return issues;
  }
  const paragraphs = x => {
    const value = x?.body ?? x?.draft?.body;
    return (Array.isArray(value) ? value : typeof value === 'string' ? value.split(/\n\s*\n/) : []).filter(p => typeof p === 'string' && p.trim());
  };
  const date = x => Date.parse(x?.source?.publishedAt || x?.sourceEvidence?.publishedAt || x?.publishedAt || '') || 0;
  const rssOnly = x => x?.sourceEvidence?.evidenceLevel === 'rss_title_and_description_only' || String(x?.sourceEvidence?.content || x?.sourceEvidence?.excerpt || '').trim().length < 250;
  const warnings = x => Array.isArray(x?.qualityReview?.warnings) ? x.qualityReview.warnings : [];
  function queue(items, options = {}, now = Date.now()) {
    const cutoff = now - (Number(options.hours) || 36) * 3600000;
    const query = String(options.search || '').toLocaleLowerCase('nl');
    return items.filter(x => {
      if (!x || typeof x.headline !== 'string') return false;
      const time = date(x);
      if (time ? time < cutoff || time > now : !options.undated) return false;
      if (!options.rss && rssOnly(x)) return false;
      if (!options.english && /\b(the|and|with|after|before|could|would|reports)\b/i.test(x.headline) && !/\b(de|het|een|van|voor|bij|met|na|trainer|voetbal|wint|zegt)\b/i.test(x.headline)) return false;
      if (!`${x.headline} ${x.category || ''} ${x.source?.url || ''}`.toLocaleLowerCase('nl').includes(query)) return false;
      if (options.filter === 'text' && !paragraphs(x).length) return false;
      if (options.filter === 'rss' && !rssOnly(x)) return false;
      if (options.filter === 'warnings' && !warnings(x).length && !x.qualityReview?.claimsUnverified) return false;
      return true;
    }).sort((a,b) => options.sort === 'score' ? (Number(b.qualityReview?.qualityScore) || 0) - (Number(a.qualityReview?.qualityScore) || 0) : (date(b) || Date.parse(b.createdAt) || 0) - (date(a) || Date.parse(a.createdAt) || 0));
  }
  return { publicationIssues, requiresFlashscore, host, paragraphs, date, rssOnly, warnings, queue, checks };
});
