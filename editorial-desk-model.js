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
    // A publication clock (14:40, 08:45) is not a football score.
    // Strip only valid two-digit 24-hour times; 2:1, 1-2, and real
    // score/statistic claims still require the existing source check.
    const text=[draft.headline,draft.standfirst,...(Array.isArray(draft.body)?draft.body:[])]
      .join(' ').replace(/\b(?:[01]\d|2[0-3]):[0-5]\d\b/g,' ');
    return /\b(?:\d+\s*[-–:]\s*\d+|uitslag|eindstand|ruststand|ranglijst|klassement|standen?|positie op de ranglijst|puntenaantal|doelsaldo|balbezit|schoten op doel|doelpogingen|hoekschoppen|gele kaarten|rode kaarten|xg|expected goals|doelpuntenmaker|scoreverloop)\b/i.test(text);
  }
  // A verified club disciplinary announcement may mention a red or yellow
  // card as the cause of a suspension. This is not a scoreboard/statistics
  // article. The exemption never applies to scores, standings or match stats.
  function officialDisciplinaryCardNotice(payload) {
    const d = payload?.draft || {};
    const body = [d.headline,d.standfirst,...(Array.isArray(d.body)?d.body:[])].join(' ');
    const facts = (payload?.verifiedFacts||[]).join(' ');
    // An explicit clock ("om 14:40") is not a football score. Its date
    // and time still fail the separate fact audit when not in verifiedFacts.
    const withoutClock=body.replace(/\bom\s+\d{1,2}:\d{2}\b/gi,'om [tijdstip]');
    const realStats = /\b(?:\d+\s*[-–:]\s*\d+|uitslag|eindstand|ruststand|ranglijst|klassement|standen?|positie op de ranglijst|puntenaantal|doelsaldo|balbezit|schoten op doel|doelpogingen|hoekschoppen|xg|expected goals|doelpuntenmaker|scoreverloop)\b/i;
    return payload?.articleKind==='announcement'&&
      ['club_decision','association_decision'].includes(payload?.primaryAuthority)&&
      payload?.sources?.length===1&&Boolean(host(payload.sources[0]?.url))&&
      /\b(?:schikkingsvoorstel|tuchtvoorstel)\b/i.test(facts)&&
      /\b(?:geaccepteerd|aanvaard|aanvaardt|accepteert)\b/i.test(facts)&&
      /\b(?:gele kaart|gele kaarten|rode kaart|rode kaarten|hands)\b/i.test(facts)&&
      !realStats.test(withoutClock);
  }
  const briefEligible = payload => payload.articleKind === 'announcement' &&
    ['club_decision','association_decision'].includes(payload.primaryAuthority) &&
    payload.sources?.length === 1 && Boolean(host(payload.sources[0]?.url)) &&
    !payload.transferStatus && payload.verifiedFacts?.length >= 1 && payload.verifiedFacts.length <= 3;
  const compactStructure = 'body (1-2 inhoudelijke alinea’s, elk 10-65 woorden)';
  const standardStructure = 'body (3-5 alinea’s, elk 18-120 woorden en minimaal 70 tekens)';
  function draftIssues(d = {}, compact = false, preview = false) {
    const issues = [];
    const body = Array.isArray(d.body) ? d.body.filter(p => typeof p === 'string' && p.trim()).map(p => p.trim()) : [];
    if (words(d.headline) < 5 || words(d.headline) > 14) issues.push('Kop: 5 tot 14 woorden.');
    if (words(d.standfirst) < 8 || words(d.standfirst) > 35) issues.push('Intro: 8 tot 35 woorden.');
    if (preview) {
      if (body.length < 1 || body.length > 3 || body.some(p => words(p) < 10 || words(p) > 120)) issues.push('Voorbeschouwing: één tot drie inhoudelijke alinea’s van 10 tot 120 woorden.');
    } else if (compact ? body.length < 1 || body.length > 2 || body.some(p => words(p) < 10 || words(p) > 65) : body.length < 3 || body.length > 5 || body.some(p => p.length < 70 || words(p) < 18 || words(p) > 120)) issues.push(compact ? 'Compacte tekst: één of twee korte inhoudelijke alinea’s.' : 'Tekst: 3 tot 5 alinea’s, elk minimaal 70 tekens en 18 tot 120 woorden.');
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
  // Supplier provenance belongs in source metadata, never in a match story.
  // Reject the draft rather than stripping sentences: the remaining text
  // might lose essential match facts and must be rewritten and rechecked.
  function matchSourceStyleIssues(payload = {}) {
    const d=payload.draft || {};
    if (!['match_report','score_update'].includes(payload.articleKind) && !payload.match && !factAudit.needsMatch(d)) return [];
    const requiredCredit='Football data provided by the Football-Data.org API';
    const body=Array.isArray(d.body)?d.body:[];
    const text=[d.headline,d.standfirst,...body.filter(p=>payload.sources?.[0]?.url!=='https://www.football-data.org/'||p!==requiredCredit)]
      .filter(x=>typeof x==='string').join(' ');
    const provider=/\b(?:sports?\s*monks|openfootball|football-data\.org|api(?:['’]s)?)\b/i;
    const registry=/\b(?:volgens|blijk(?:t|en)\s+uit|bevestigd\s+door|geregistreerd\s+(?:volgens|door|in)|gekoppeld\s+aan)\b[^.!?]{0,95}\b(?:wedstrijdregistratie|doelpuntenregistratie|data(?:bron|leverancier)|bron(?:gegevens)?|api)\b/i;
    const evidenceMeta=/\b(?:de\s+)?(?:offici[eë]le\s+)?wedstrijdregistratie\b|\b(?:geverifieerd|bevestigd)\s+(?:door|volgens|aan\s+de\s+hand\s+van)\s+(?:de\s+)?(?:bron|provider|registratie)\b/i;
    return provider.test(text)||registry.test(text)||evidenceMeta.test(text)
      ? ['Wedstrijdverslag bevat bron- of leveranciersverantwoording in de lopende tekst. Schrijf de gebeurtenis direct, zonder Sportmonks, API, wedstrijdregistratie of verificatieclaims; behoud brongegevens afzonderlijk.']
      : [];
  }
  const storyStyle = 'Schrijf direct en natuurlijk Nederlands voetbalnieuws. Kies één bewezen invalshoek voor kop en intro. Laat iedere alinea daarop voortbouwen met nieuw bewijs. Vermijd herhaling en opvulling. Sla over als een onderbouwde invalshoek ontbreekt.';
  const previewStyle = 'Open met de bewezen inzet van het duel, een vorige ontmoeting of concreet selectienieuws. Schrijf één of twee korte alinea’s als die de invalshoek dekken. De body geeft nieuwe informatie. Noem aftrap, stadion en groep elk hooguit één keer in intro en body samen. Laat praktische details weg die niets toevoegen. Vermijd voorspellingen, onbewezen thuisvoordeel en woorden als cruciaal of spannend zonder concreet bewijs. Geef skip bij uitsluitend kalendergegevens.';
  const federationCoachStyle = 'Zet de bevestigde nieuwe functie of bestemming in de kop als die de belangrijkste ontwikkeling is. Verbind in de body de laatste opdracht, het concrete resultaat van de vertrekkende coach en de tijdelijke opvolging. Gebruik de feiten die de overstap betekenis geven. Laat algemene verklaringen over het zoeken naar kandidaten weg als ze geen concreet nieuws toevoegen. Verzin geen reden voor de overstap. Geef de bond bronvermelding in de intro en bij minstens één inhoudelijk vervolgfeit.';
  const previewStructure = 'body (1-3 inhoudelijke alinea’s, elk 10-120 woorden)';
  function storyIssues(payload) {
    const draft = payload.draft || {};
    const body = Array.isArray(draft.body) ? draft.body : [];
    const filler = /\b(?:dit stadion is de offici[eë]le locatie|waarin verschillende europese landen strijden om de groepswinst|strijden in deze groep om de beste positie in het toernooi)\b/i;
    const issues = [];
    if ([draft.headline, draft.standfirst, ...body].some(block => filler.test(String(block || '')))) {
      issues.push('Schrap opvultekst over de locatie of competitie. Voeg een concreet detail toe dat de invalshoek versterkt.');
    }
    if (payload.articleKind === 'preview' && !(Array.isArray(payload.verifiedFacts) ? payload.verifiedFacts : []).some(fact =>
      typeof fact === 'string' && !/^(?:.+ staat op \d{4}-|.+ speelt thuis tegen |de wedstrijd wordt gespeeld in |.+ is een wedstrijd in |de offici[eë]le speelstad |het duel hoort bij groep |het andere geplande groepsduel |dit is de laatste groepswedstrijd )/i.test(fact))) {
      issues.push('Voorbeschouwing mist bevestigde sportieve context, zoals de vorige ontmoeting, de inzet of selectienieuws.');
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
    issues.push(...draftIssues(d, (registeredMatch && !richMatch) || brief, payload.articleKind === 'preview'));
    issues.push(...storyIssues(payload));
    issues.push(...matchSourceStyleIssues(payload));
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
    if (!matchSource && !factAudit.hasOfficialPreviewResult(payload) && requiresFlashscore(d) && !officialDisciplinaryCardNotice(payload) && !hosts.some(h => /^flashscore\.(?:nl|com|be|de|co\.uk)$/.test(h))) issues.push('Uitslagen, standen en statistieken: voeg de gecontroleerde Flashscore-link toe.');
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
  return { storyStyle, previewStyle, federationCoachStyle, previewStructure, storyIssues, officialDisciplinaryCardNotice, briefEligible, compactStructure, standardStructure, factAuditIssues:factAudit.audit, needsMatch:factAudit.needsMatch, draftIssues, excludedBy, publicationIssues, matchSourceStyleIssues, requiresFlashscore, host, paragraphs, date, rssOnly, warnings, queue, checks };
});
