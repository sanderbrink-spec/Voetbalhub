(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require("./editorial-facts"));
  else root.DeskModel = factory(root.DeskFacts);
})(typeof globalThis !== 'undefined' ? globalThis : this, function (factAudit) {
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
  // A verified club disciplinary announcement may mention a red or yellow
  // card as the cause of a suspension. This is not a scoreboard/statistics
  // article. The exemption never applies to scores, standings or match stats.
  function officialDisciplinaryCardNotice(payload) {
    const d = payload?.draft || {};
    const body = [d.headline,d.standfirst,...(Array.isArray(d.body)?d.body:[])].join(' ');
    const facts = (payload?.verifiedFacts||[]).join(' ');
    const realStats = /\b(?:\d+\s*[-–:]\s*\d+|uitslag|eindstand|ruststand|ranglijst|klassement|standen?|positie op de ranglijst|puntenaantal|doelsaldo|balbezit|schoten op doel|doelpogingen|hoekschoppen|xg|expected goals|doelpuntenmaker|scoreverloop)\b/i;
    return payload?.articleKind==='announcement'&&
      ['club_decision','association_decision'].includes(payload?.primaryAuthority)&&
      payload?.sources?.length===1&&Boolean(host(payload.sources[0]?.url))&&
      /\b(?:schikkingsvoorstel|tuchtvoorstel)\b/i.test(facts)&&
      /\b(?:geaccepteerd|aanvaard|aanvaardt|accepteert)\b/i.test(facts)&&
      /\b(?:gele kaart|gele kaarten|rode kaart|rode kaarten|hands)\b/i.test(facts)&&
      !realStats.test(body);
  }
  const briefEligible = payload => payload.articleKind === 'announcement' &&
    ['club_decision','association_decision'].includes(payload.primaryAuthority) &&
    payload.sources?.length === 1 && Boolean(host(payload.sources[0]?.url)) &&
    !payload.transferStatus && payload.verifiedFacts?.length >= 1 && payload.verifiedFacts.length <= 3;
  const compactStructure = 'body (1-2 inhoudelijke alinea’s, elk 10-65 woorden)';
  const standardStructure = 'body (3-5 alinea’s, elk 18-120 woorden en minimaal 70 tekens)';
  function draftIssues(d = {}, compact = false) {
    const issues = [];
    const body = Array.isArray(d.body) ? d.body.filter(p => typeof p === 'string' && p.trim()).map(p => p.trim()) : [];
    if (words(d.headline) < 5 || words(d.headline) > 14) issues.push('Kop: 5 tot 14 woorden.');
    if (words(d.standfirst) < 8 || words(d.standfirst) > 35) issues.push('Intro: 8 tot 35 woorden.');
    if (compact ? body.length < 1 || body.length > 2 || body.some(p => words(p) < 10 || words(p) > 65) : body.length < 3 || body.length > 5 || body.some(p => p.length < 70 || words(p) < 18 || words(p) > 120)) issues.push(compact ? 'Compacte tekst: één of twee korte inhoudelijke alinea’s.' : 'Tekst: 3 tot 5 alinea’s, elk minimaal 70 tekens en 18 tot 120 woorden.');
    const normalize = value => String(value || '').toLowerCase().normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
    const blocks = [d.standfirst, ...body].map(normalize).filter(Boolean);
    for (let i=0;i<blocks.length;i++) for(let j=i+1;j<blocks.length;j++) {
      const first=new Set(blocks[i].split(' ').filter(w=>w.length>3));
      const second=new Set(blocks[j].split(' ').filter(w=>w.length>3));
      const smaller=Math.min(first.size,second.size);
      const overlap=smaller?[...first].filter(w=>second.has(w)).length/smaller:0;
      if(blocks[i]===blocks[j]||(smaller>=8&&overlap>=0.82)) {
        issues.push('Intro en alinea’s herhalen te veel dezelfde inhoud. Gebruik per alinea andere aangeleverde feiten.');
        return issues;
      }
    }
    return issues;
  }
  function publicationIssues(payload) {
    const issues = [], d = payload.draft || {};
    const registeredMatch = /^(?:of-nl-\d{4}-[a-z0-9-]+|fd-cl-\d+|sm-\d+)$/.test(payload.matchId || '') && ['score_update','match_report'].includes(payload.articleKind);
    const brief = briefEligible(payload);
    // Rich reports supported by a complete verified goal timeline or an
    // official score-consistent event record must meet the full article format.
    // Bare results and half-time-only updates retain the compact standard.
    const richMatch = registeredMatch && payload.articleKind === 'match_report' &&
      (Boolean(payload.matchEvidence) || (payload.verifiedFacts || []).length >= 5);
    issues.push(...draftIssues(d, (registeredMatch && !richMatch) || brief));
    issues.push(...factAudit.audit(payload));
    if (!Array.isArray(payload.verifiedFacts) || payload.verifiedFacts.filter(x => typeof x === 'string' && x.trim()).length < (brief ? 1 : 2)) issues.push(brief ? 'Vul het gecontroleerde besluit in.' : 'Vul twee zelf gecontroleerde feiten in.');
    const sources = Array.isArray(payload.sources) ? payload.sources : [];
    const hosts = sources.map(s => host(s?.url));
    const primary = payload.articleKind === 'announcement' && sources.length === 1 &&
      ['club_decision','association_decision'].includes(payload.primaryAuthority) && Boolean(hosts[0]);
    const matchRegistry = [
      'https://github.com/openfootball/football.json',
      'https://www.football-data.org/',
      'https://www.sportmonks.com/football-api/'
    ];
    // A verified official event timeline is extra evidence, not a reason to
    // demand an unrelated third-party scoreboard. The server separately
    // reconstructs matchEvidence from the official source before accepting it.
    const officialMatchEvidence = registeredMatch && sources.length === 2 &&
      payload.matchEvidence?.url === sources[1]?.url &&
      typeof payload.matchEvidence?.text === 'string' && payload.matchEvidence.text.length >= 120 &&
      Number.isFinite(Date.parse(payload.matchEvidence?.publishedAt || '')) &&
      hosts[0] !== hosts[1];
    const matchSource = registeredMatch && matchRegistry.includes(sources[0]?.url) &&
      (sources.length === 1 || officialMatchEvidence);
    if (!primary && !matchSource && (sources.length < 2 || hosts.some(h => !h) || new Set(hosts.filter(Boolean)).size < 2)) issues.push('Voeg twee geldige HTTPS-bronnen van verschillende websites toe.');
    if (!matchSource && requiresFlashscore(d) && !officialDisciplinaryCardNotice(payload) && !hosts.some(h => /^flashscore\.(?:nl|com|be|de|co\.uk)$/.test(h))) issues.push('Uitslagen, standen en statistieken: voeg de gecontroleerde Flashscore-link toe.');
    const missing = checks.filter(key => payload.editorialChecks?.[key] !== true);
    if (missing.length) issues.push('Rond alle vier redactionele controles af.');
    if (payload.imageUrl && (!host(payload.imageUrl) || !payload.imageSource?.trim() || !payload.imageCredit?.trim() || !['cleared','licensed'].includes(payload.imageRights) || !['kitVerified','playerIdentityVerified','aiDisclosureVerified'].every(k => payload.imageReview?.[k] === true))) issues.push('Rond de beeldgegevens en alle drie beeldcontroles af.');
    return issues;
  }
  const paragraphs = x => {
    const value = x?.body ?? x?.draft?.body;
    return (Array.isArray(value) ? value : typeof value === 'string' ? value.split(/\n\s*\n/) : []).filter(p => typeof p === 'string' && p.trim());
  };
  function date(x) {
    // A malformed legacy date must not shadow another valid source timestamp.
    for (const value of [x?.source?.publishedAt, x?.sourceEvidence?.publishedAt, x?.publishedAt, x?.source?.pubDate, x?.sourceEvidence?.pubDate]) {
      const timestamp = Date.parse(value || '');
      if (Number.isFinite(timestamp) && timestamp > 0) return timestamp;
    }
    return 0;
  }
  function excludedBy(x, options, now) {
    if (!x || typeof x.headline !== 'string') return 'invalid';
    const time = date(x), allTime = options.hours === 'all';
    const cutoff = now - (Number(options.hours) || 36) * 3600000;
    if (time ? !allTime && (time < cutoff || time > now) : !options.undated) return 'date';
    if (!options.rss && rssOnly(x)) return 'rss';
    if (!options.english && /\b(the|and|with|after|before|could|would|reports)\b/i.test(x.headline) && !/\b(de|het|een|van|voor|bij|met|na|trainer|voetbal|wint|zegt)\b/i.test(x.headline)) return 'english';
    const query = String(options.search || '').toLocaleLowerCase('nl');
    if (!`${x.headline} ${x.category || ''} ${x.source?.url || ''}`.toLocaleLowerCase('nl').includes(query)) return 'search';
    if (options.filter === 'text' && !paragraphs(x).length) return 'type';
    if (options.filter === 'rss' && !rssOnly(x)) return 'type';
    if (options.filter === 'warnings' && !warnings(x).length && !x.qualityReview?.claimsUnverified) return 'type';
    return '';
  }
  const rssOnly = x => x?.sourceEvidence?.evidenceLevel === 'rss_title_and_description_only' || String(x?.sourceEvidence?.content || x?.sourceEvidence?.excerpt || '').trim().length < 250;
  const warnings = x => Array.isArray(x?.qualityReview?.warnings) ? x.qualityReview.warnings : [];
  function queue(items, options = {}, now = Date.now()) {
    return items.filter(x => !excludedBy(x, options, now)).sort((a,b) => options.sort === 'score' ? (Number(b.qualityReview?.qualityScore) || 0) - (Number(a.qualityReview?.qualityScore) || 0) : (date(b) || Date.parse(b.createdAt) || 0) - (date(a) || Date.parse(a.createdAt) || 0));
  }
  return { officialDisciplinaryCardNotice, briefEligible, compactStructure, standardStructure, factAuditIssues:factAudit.audit, needsMatch:factAudit.needsMatch, draftIssues, excludedBy, publicationIssues, requiresFlashscore, host, paragraphs, date, rssOnly, warnings, queue, checks };
});
