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
  // A first-party decision with four independently supported details is not
  // automatically a three-paragraph story. Choose the shape from the factual
  // packet, but retain full structure for substantive coaching/staff stories.
  // This only selects an article FORMAT; it changes no fact or review gate.
  const briefEligible = payload => {
    const facts=payload?.verifiedFacts;
    // 102F: the writer and desk must agree on the same short format for
    // a KNVB/UEFA draw already validated by the separate two-source gate.
    // This is a format choice, never proof of facts or publication approval.
    if(payload?.verifiedDrawBrief===true&&payload.articleKind==='announcement'&&
      !payload.primaryAuthority&&!payload.transferStatus&&
      Array.isArray(facts)&&facts.length>=4&&facts.length<=8&&
      payload.sources?.length===2&&
      /^https:\/\/www\.onsoranje\.nl\/nieuws\/nederlands-elftal-mannen\/\d+\//.test(payload.sources[0]?.url||'')&&
      /^https:\/\/www\.uefa\.com\/uefanationsleague\/news\//.test(payload.sources[1]?.url||''))
     return true;
    // An official UEFA status overview can contain ten source sentences but
    // only one meaningful news event. Use a short, selected journalistic angle
    // rather than forcing three repetitive paragraphs from group tables.
    // This changes article shape only, never evidence or review thresholds.
    const officialLeagueStatus=payload?.articleKind==='announcement'&&
      payload.primaryAuthority==='association_decision'&&!payload.transferStatus&&
      payload.sources?.length===1&&
      /^https:\/\/www\.uefa\.com\/uefanationsleague\/news\/02[a-z0-9-]+\/?$/.test(payload.sources[0]?.url||'')&&
      Array.isArray(facts)&&facts.length>=5&&facts.length<=10&&
      facts.filter(f=>/\bGroup A[1-4]\b/i.test(String(f))).length>=2&&
      facts.some(f=>/\bare confirmed in (?:first|second) place and have qualified for the quarter-finals\b/i.test(String(f)));
    if(officialLeagueStatus)return true;
    // A verified UEFA promotion may have a group table and a few connected
    // placement decisions, but not three genuinely separate story angles.
    // Only the organiser's actual decision and literal group table qualify.
    const officialPromotion=payload?.articleKind==='announcement'&&
      payload.primaryAuthority==='association_decision'&&!payload.transferStatus&&
      payload.sources?.length===1&&
      /^https:\/\/www\.uefa\.com\/uefanationsleague\/news\/02[a-z0-9-]+\/?$/.test(payload.sources[0]?.url||'')&&
      Array.isArray(facts)&&facts.length>=5&&facts.length<=8&&
      facts.some(f=>/^Group [B-D][1-4]\s+/i.test(String(f)))&&
      facts.some(f=>/\bare confirmed in first place and will be promoted to League [A-C]\b/i.test(String(f)));
    if(officialPromotion)return true;
    if(payload?.articleKind!=='announcement'||
      !['club_decision','association_decision'].includes(payload.primaryAuthority)||
      payload.sources?.length!==1||!host(payload.sources[0]?.url)||
      payload.transferStatus||!Array.isArray(facts)||facts.length<1||facts.length>6)return false;
    // Bondsbesluiten with five-plus facts need an explicit source-specific
    // proof rule, not the general club-decision exception. This also prevents
    // a forged publisher type on an unrelated official football domain.
    if(facts.length>4&&payload.primaryAuthority==='association_decision')return false;
    if(facts.length<=3)return true;
    // A list of disconnected snippets is not a journalistic news decision.
    // Retain the existing full structure unless the primary source facts
    // literally contain an identifiable announcement or decision.
    if(facts.length>=5&&!facts.some(f=>/\b(?:bevestigt|bevestigd|meldt|bekendgemaakt|besluit|besloten|benoemd|aangesteld|contract|tekent|verlengd|aanvaard|geaccepteerd|announced|confirmed|appointed|signed|agreement|promoted)\b/i.test(String(f))))return false;
    // Five or six source-verified details can still describe one compact decision.
    // Avoid forcing three repetitive paragraphs solely because of fact count.
    // Longer packets and staffing appointments retain the full story format.
    // This grants no exemption from claim checking or independent editorial review.
    // Complex staffing appointments still require independent body sections.
    return !facts.some(f=>/\b(?:hoofdtrainer|head coach|assistent(?:-trainer|-bondscoach)?|keeperstrainer|interim|technische staf|coach staff)\b/i.test(String(f)));
  };
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
    if (!['match_report','score_update'].includes(payload.articleKind) && !payload.match && (!factAudit.needsMatch(d) || factAudit.verifiedClubPreviewHistory(payload))) return [];
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
  const previewStyle = 'Schrijf een bondige voorbeschouwing in natuurlijk voetbal-Nederlands. Kies zoals in de redactionele voorbeelden de gebeurtenissen die de sportieve inzet verklaren. Gebruik de kop voor één invalshoek en de intro om die met de bevestigde consequentie uit te werken. Vermeld de consequentie alleen in deze opening. Geef daarna bij voldoende feiten exact twee korte bodyalinea’s. Begin de eerste met een concreet moment uit de eerdere onderlinge ontmoeting, met de bevestigde uitslag als uitkomst. Begin de tweede met een afzonderlijk bewezen moment uit het meest recente duel en gebruik het resultaat als context. Als een van die twee onderdelen niet beschikbaar is, gebruik één inhoudelijk sterke alinea of geef skip. Noem geen speelwijze, voorspellende betekenis of oorzakelijk verband dat de bronnen niet vaststellen. Sla kalenderzinnen en algemene duiding over. Schrijf iedere alinea vanuit een nieuw feit, zonder de opening te herhalen, in andere zinsbouw dan de bron.';
  const federationCoachStyle = 'Zet de bevestigde nieuwe functie of bestemming in de kop als die de belangrijkste ontwikkeling is. Verbind in de body de laatste opdracht, het concrete resultaat van de vertrekkende coach en de tijdelijke opvolging. Gebruik de feiten die de overstap betekenis geven. Laat algemene verklaringen over het zoeken naar kandidaten weg als ze geen concreet nieuws toevoegen. Verzin geen reden voor de overstap. Geef de bond bronvermelding in de intro en bij minstens één inhoudelijk vervolgfeit.';
  const previewStructure = 'body (1-3 inhoudelijke alinea’s, elk 10-120 woorden)';
  function previewWritingFacts(facts) {
    return facts.filter(fact => !/^(?:.+ staat op \d{4}-|.+ speelt thuis tegen |de wedstrijd wordt gespeeld in |.+ is een wedstrijd in |de offici[eë]le speelstad |het duel hoort bij groep |het andere geplande groepsduel |dit is de laatste groepswedstrijd )/i.test(fact));
  }
  function previewAssignment(facts) {
    const stakes=facts.filter(fact=>/groepswinst|plek bij de eerste twee|neemt Oranje afstand/i.test(fact));
    const previousMeeting=facts.filter(fact=>/^(?:Eerdere ontmoeting|Bij de vorige ontmoeting)/i.test(fact));
    const recentForm=facts.filter(fact=>/^(?:De vorige groepswedstrijd|.+maakte tegen .+zijn eerste hattrick)/i.test(fact));
    if(!stakes.length||!previousMeeting.length||!recentForm.length)return null;
    return {opening:stakes,firstParagraph:previousMeeting,secondParagraph:recentForm};
  }
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
  // Official men international results require both named source URLs and
  // a score/date record. The server separately re-fetches and reconstructs
  // this proof before draft approval or publication.
  function officialInternationalFinal(payload) {
    const proof=payload?.officialFinalProof,match=payload?.match,sources=payload?.sources;
    const uefa='https://www.uefa.com/uefanationsleague/news/02a2-1fea7079900a-801b2c5f6c9e-1000--2026-27-uefa-nations-league-league-phase-fixtures-and-results-by-team/';
    const dfb='https://datencenter.dfb.de/teams/deutschland/seasonplan';
    const secondary=proof?.uefaResultsUrl||proof?.dfbResultsUrl;
    const uniqueSource=Boolean(proof?.uefaResultsUrl)!==Boolean(proof?.dfbResultsUrl);
    if(payload?.articleKind!=='announcement'||payload?.matchId||payload?.primaryAuthority||
      !proof||!match||!Array.isArray(sources)||sources.length!==3||
      !Array.isArray(payload.verifiedFacts)||payload.verifiedFacts.length<4||
      JSON.stringify(proof.match)!==JSON.stringify(match)||
      proof.knvbResultsUrl!=='https://www.onsoranje.nl/teams/185184/uitslagen'||
      !uniqueSource||![uefa,dfb].includes(secondary)||
      !/^https:\/\/www\.onsoranje\.nl\/nieuws\/nederlands-elftal-mannen\/\d+\//.test(proof.sourceNewsUrl||'')||
      sources[0]?.url!==proof.sourceNewsUrl||
      sources[1]?.url!==proof.knvbResultsUrl||
      sources[2]?.url!==secondary||
      !/^\d{4}-\d{2}-\d{2}$/.test(match.playedAt||'')||
      ![match.homeScore,match.awayScore].every(n=>Number.isInteger(n)&&n>=0&&n<=25)||
      ![match.homeTeam,match.awayTeam].every(n=>typeof n==='string'&&n.length>=3&&n.length<=55)||
      (match.homeTeam==='Nederland')===(match.awayTeam==='Nederland'))return false;
    const first=payload.verifiedFacts[0];
    return typeof first==='string'&&first.includes(match.homeTeam)&&first.includes(match.awayTeam)&&
      first.includes(match.homeScore+'-'+match.awayScore)&&first.includes(match.playedAt);
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
    if (!matchSource && !factAudit.hasOfficialPreviewResult(payload) && !factAudit.verifiedUefaCompetitionStatus(payload) && !officialInternationalFinal(payload) && requiresFlashscore(d) && !officialDisciplinaryCardNotice(payload) && !hosts.some(h => /^flashscore\.(?:nl|com|be|de|co\.uk)$/.test(h))) issues.push('Uitslagen, standen en statistieken: voeg de gecontroleerde Flashscore-link toe.');
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
  return { storyStyle, previewStyle, previewWritingFacts, previewAssignment, federationCoachStyle, previewStructure, storyIssues, officialDisciplinaryCardNotice, briefEligible, compactStructure, standardStructure, factAuditIssues:factAudit.audit, needsMatch:factAudit.needsMatch, verifiedClubPreviewHistory:factAudit.verifiedClubPreviewHistory, verifiedUefaCompetitionStatus:factAudit.verifiedUefaCompetitionStatus, draftIssues, excludedBy, publicationIssues, officialInternationalFinal, matchSourceStyleIssues, requiresFlashscore, host, paragraphs, date, rssOnly, warnings, queue, checks };
});
