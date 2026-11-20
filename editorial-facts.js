(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory();else root.DeskFacts=factory();})(typeof globalThis!=='undefined'?globalThis:this,function(){
 const normalize=value=>String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim().replace(/\s+/g,' ');
 // Exact HTTPS host is independently checked provenance, not evidence for
 // the club's statements. It may support naming the official publisher only.
 const publisherHosts=Object.freeze({
  'peczwolle.nl':'PEC Zwolle','ajax.nl':'Ajax','psv.nl':'PSV',
  'feyenoord.com':'Feyenoord','fctwente.nl':'FC Twente','az.nl':'AZ',
  'fcgroningen.nl':'FC Groningen','fortunasittard.nl':'Fortuna Sittard',
  'willem-ii.nl':'Willem II','fcemmen.nl':'FC Emmen','fcdenbosch.nl':'FC Den Bosch',
  'knvb.nl':'KNVB','onsoranje.nl':'KNVB','ussoccer.com':'U.S. Soccer','uefa.com':'UEFA','eurojackpotknvbbeker.nl':'KNVB Beker',
  'eredivisie.nl':'Eredivisie','inter.it':'Inter','clubbrugge.be':'Club Brugge',
  'liverpoolfc.com':'Liverpool','fcm.dk':'FC Midtjylland',
  'keukenkampioendivisie.nl':'Keuken Kampioen Divisie'
 });
 function officialPublisherName(url){
  try{
   const u=new URL(url);
   if(u.protocol!=='https:'||u.username||u.password)return null;
   return publisherHosts[u.hostname.toLowerCase().replace(/^www\./,'')]||null;
  }catch{return null;}
 }
 const blocks=d=>[d?.headline,d?.standfirst,...(Array.isArray(d?.body)?d.body:[])].filter(Boolean);
 const text=d=>blocks(d).join(' ');
 const scores=value=>[...String(value||'').matchAll(/(?<![\d-])\b(\d{1,2})\s*[-–]\s*(\d{1,2})\b(?![-–]\d)/g)].map(m=>Number(m[1])+'-'+Number(m[2]));
 // A conditional future qualification is not a played match. In particular,
 // "als Oranje de kwartfinale wint" must not demand a final score and scorers.
 // This exemption changes only that hypothetical clause; actual winning,
 // scores, standings and match-result assertions stay subject to full audit.
 const withoutConditionalQualification=value=>String(value||'')
  .replace(/\b(?:als|wanneer|indien)\s+(?:Oranje|Nederland)\s+de kwartfinale wint\b/gi,'[voorwaardelijk vervolg]');
 const needsMatch=d=>{
  const prose=withoutConditionalQualification(text(d));
  return scores(prose).length>0||
   /\b(?:verslaat|versloeg|gelijkspel|puntendeling|eindstand|ruststand)\b/i.test(prose)||
   (/\b(?:wint|won|overwinning)\b/i.test(prose)&&/\b(?:wedstrijd|duel|speelronde|slotfase|eredivisie|competitie|kwartfinale)\b/i.test(prose));
 };
 const validDate=value=>{if(!/^\d{4}-\d{2}-\d{2}$/.test(value||''))return false;const d=new Date(value+'T12:00:00Z');return Number.isFinite(d.getTime())&&d.toISOString().slice(0,10)===value;};
 function evidenceIssues(draft,facts=[],match=null,sourceName=''){
  const article=text(draft),evidence=facts.filter(x=>typeof x==='string').join(' '),issues=[];
  const anchored=match&&String(match.homeTeam||'').trim()&&String(match.awayTeam||'').trim()&&Number.isInteger(match.homeScore)&&Number.isInteger(match.awayScore);
  const anchor=anchored?`${match.homeTeam} ${match.awayTeam} ${match.homeScore}-${match.awayScore} ${match.playedAt||''}`:'';
  // Known source attribution is metadata, never proof of match events.
  const publisher=['Sportmonks Football API','OpenFootball','football-data.org'].includes(sourceName)?
   sourceName:(officialPublisherName(sourceName)||'');
  const supported=evidence+' '+anchor+' '+publisher;
  const numbers=value=>(String(value).match(/\d+(?:[.,]\d+)?/g)||[]).map(x=>x.replace(',','.'));
  const allowedNumbers=new Set(numbers(supported));
  // The checked date 2026-11-08 proves "8 november", but never
  // an unrelated bare numeral eight or an invented scoreline.
  const months=['januari','februari','maart','april','mei','juni','juli','augustus','september','oktober','november','december'];
  const verifiedDates=[...supported.matchAll(/\b(\d{4})-(\d{2})-(\d{2})\b/g)]
   .map(m=>({month:Number(m[2]),day:Number(m[3])}))
   .filter(d=>d.month>=1&&d.month<=12&&d.day>=1&&d.day<=31);
  const verifiedCalendarDay=m=>verifiedDates.some(d=>
   m[0]===String(d.day)&&new RegExp('^\\s+'+months[d.month-1]+'\\b','i')
    .test(article.slice(m.index+m[0].length)));
  const unknownNumbers=[...new Set([...article.matchAll(/\d+(?:[.,]\d+)?/g)]
   .filter(m=>!allowedNumbers.has(m[0].replace(',','.'))&&!verifiedCalendarDay(m))
   .map(m=>m[0].replace(',','.')))];

  if(unknownNumbers.length)issues.push('Cijfers ontbreken in de gecontroleerde feiten: '+unknownNumbers.join(', ')+'.');
  const allowedScores=new Set(scores(supported));
  const unknownScores=[...new Set(scores(article))].filter(x=>!allowedScores.has(x));
  if(unknownScores.length)issues.push('Uitslag of tussenstand wijkt af van de gecontroleerde feiten: '+unknownScores.join(', ')+'. Controleer ook de volgorde thuis-uit.');
  const names=blocks(draft).flatMap(block=>[...String(block).matchAll(/\b(?:(?:De )?League A-groep|Kwartfinales Nations League)\b|\b(?:[A-ZÀ-Ý][A-Za-zÀ-ÿ'’\-]+|FC|SC|AZ|PSV)(?:\s+(?:van|de|der|den|ten|ter))?\s+[A-ZÀ-Ý][A-Za-zÀ-ÿ'’\-]+\b/g)].map(m=>m[0]));
  const known=normalize(supported);
  const sentenceStarters=new Set(['Voor','Volgens','Ook','Tegen','Na','Bij','Zonder','Sinds','Tijdens']);
  // Match introductions like "De Eredivisie-wedstrijd" are grammar, not invented
  // proper names. Restrict this exception to fixed competition expressions;
  // unknown players and stadiums must still be rejected.
  const verifiedGeographicArticle=name=>
   (/^(?:De Nations|Nations League-(?:wedstrijd|duel|groep|campagne))$/i.test(name)&&/\bnations league\b/.test(known))||
   (/^(?:De )?Verenigde(?: Staten)?$/i.test(name)&&/\b(?:verenigde staten|united states|u s men s national team|usmnt|amerikaans[e]?)\b/.test(known))||
   (/^De Duitse$/.test(name)&&/\bduitsland\b/.test(known))||
   (/^De Nederlandse$/i.test(name)&&/\bnederland\b/.test(known))||
   (/^De Amerikaanse$/i.test(name)&&/\b(?:amerikaans[e]?|u s soccer|usmnt)\b/.test(known));
  const competitionPhrasing=/^(?:(?:De|Het|Een) Eredivisie(?:-wedstrijd|-speelronde)?|In de Eredivisie(?:-wedstrijd|-speelronde)?)$/i;
  const verifiedStadiumArticle=name=>/^(?:De Johan|Het Olympiastadion)$/i.test(name)&&
   (name.toLowerCase().includes('johan')?/\bjohan cruijff arena\b/.test(known):/\bolympiastadion\b/.test(known));
  const verifiedLeagueAbbreviation=name=>/^Major League$/i.test(name)&&/\bmls\b/.test(known);
  // UEFA League A status is first-party competition metadata. Match results,
  // standings and named participants still require literal verified facts.
  let officialUefaLeagueA=false;
  try{
   const u=new URL(sourceName);
   officialUefaLeagueA=u.protocol==='https:'&&u.hostname==='www.uefa.com'&&
    /^\/uefanationsleague\/news\/02[a-z0-9-]+\/?$/.test(u.pathname)&&
    /\b(?:league a|group a[1-4]|quarter.final)\b/i.test(evidence);
  }catch{}
  // Official UEFA data uses English national-team names. A strict, finite
  // dictionary allows Dutch names only for teams present in verified facts.
  const teamAliases=[
   ['France','Frankrijk'],['Belgium','België'],['England','Engeland'],
   ['Spain','Spanje'],['Italy','Italië'],['Germany','Duitsland'],
   ['Netherlands','Nederland'],['Greece','Griekenland'],['Serbia','Servië'],
   ['Türkiye','Turkije'],['Turkey','Turkije'],['Czechia','Tsjechië'],
   ['Portugal','Portugal'],['Denmark','Denemarken'],['Norway','Noorwegen'],
   ['Croatia','Kroatië'],['Wales','Wales']
  ];
  const uefaVerifiedNames=new Set();
  if(officialUefaLeagueA){
   for(const [source,target] of teamAliases)
    if((' '+normalize(evidence)+' ').includes(' '+normalize(source)+' '))
     uefaVerifiedNames.add(normalize(target));
  }
  const verifiedUefaStatusGrammar=name=>{
   if(!officialUefaLeagueA)return false;
   if(/^(?:Kwartfinales Nations League|Nations League(?:-kwartfinales?)?)$/.test(name))return true;
   if(/^(?:De )?League A-groep$/.test(name)&&/\b(?:league a|group a[1-4])\b/i.test(evidence))return true;
   const leading=name.match(/^(?:Zowel|Naast|Met)\s+([A-ZÀ-Ý][\p{L}’'-]+)$/u);
   return Boolean(leading&&
    (uefaVerifiedNames.has(normalize(leading[1]))||
     (' '+normalize(evidence)+' ').includes(' '+normalize(leading[1])+' ')));
  };
  // UEFA Nations League is the verified name of the competition on UEFA's
  // first-party status page. The name detector sees only the first two
  // capitalised words ("UEFA Nations") and must not misclassify that phrase
  // as an unsupported person. This does NOT validate any match or ranking.
  const verifiedUefaCompetitionLabel=name=>{
    if(name!=='UEFA Nations'||publisher!=='UEFA'||!sourceName)return false;
    try{
      const u=new URL(sourceName);
      return u.protocol==='https:'&&u.hostname==='www.uefa.com'&&
        /^\/uefanationsleague\/news\/02[a-z0-9-]+\/?$/.test(u.pathname)&&
        /\bUEFA Nations League\b/.test(article);
    }catch{return false;}
  };
  const grammaticalStatusName=name=>(/^De KNVB$/i.test(name)&&publisher==='KNVB')||
   (/^De UEFA$/i.test(name)&&publisher==='UEFA')||
   (name==='De UEFA-registraties'&&publisher==='UEFA'&&/^https:\/\/www\.uefa\.com\/uefachampionsleague\/clubs\//.test(sourceName)&&/\bUEFA\b/.test(evidence))||
    (/^In Groep$/i.test(name)&&publisher==='UEFA'&&/\b(?:group|groep|league a)\b/i.test(supported));
  // "In League A" is a Dutch sentence opening, not a player or place.
  // Accept that grammar ONLY for verified UEFA Nations League divisions.
  // An unverified division (or a fabricated named participant) still fails.
  const verifiedUefaLeagueOpening=name=>{
    if(name!=='In League'||!officialUefaLeagueA||publisher!=='UEFA')return false;
    const mentioned=[...article.matchAll(/\bIn League\s+([A-D])\b/gi)];
    return mentioned.length>0&&mentioned.every(([,division])=>
      new RegExp('\\b(?:league '+division+'|group '+division+'[1-4])\\b','i').test(evidence));
  };
   const missingNames=[...new Set(names)].filter(name=>!grammaticalStatusName(name)&&!verifiedUefaCompetitionLabel(name)&&!verifiedUefaLeagueOpening(name)&&!verifiedStadiumArticle(name)&&!verifiedLeagueAbbreviation(name)&&!competitionPhrasing.test(name)&&!verifiedGeographicArticle(name)&&!sentenceStarters.has(name.split(' ')[0])&&!verifiedUefaStatusGrammar(name)&&!known.includes(normalize(name)));
  if(missingNames.length)issues.push('Controleer namen die niet in de aangeleverde feiten staan: '+missingNames.join(', ')+'.');
  const quotations=[...article.matchAll(/[“"]([^”"\n]{10,})[”"]/g)].map(m=>m[1]);
  if(quotations.some(q=>!normalize(evidence).includes(normalize(q))))issues.push('Citaat ontbreekt letterlijk in de gecontroleerde feiten. Controleer de uitspraak en de spreker.');

  // The article publication header is not proof of the exact moment that a
  // club accepted or signed a decision. Only an explicit source claim about
  // the event time can justify such a timestamp in the generated narrative.
  if(officialPublisherName(sourceName)&&!match){
   const eventAt=/\b(?:op\s+)?(?:(?:maandag|dinsdag|woensdag|donderdag|vrijdag|zaterdag|zondag)\s+)?\d{1,2}\s+(?:januari|februari|maart|april|mei|juni|juli|augustus|september|oktober|november|december)\s+20\d{2}\s+om\s+\d{1,2}[.:]\d{2}\b/gi;
   const decisionVerb=/\b(?:accepteer\w*|aanvaard\w*|aanvaardt|beslo\w*|benoem\w*|benoemd|tekend\w*|tekende\w*|ingestemd|instem\w*)\b/i;
   for(const claim of article.matchAll(eventAt)){
    // The decision verb may be separated from the claimed time by the
    // subject and object: "om 14:40 heeft de club ... geaccepteerd".
    const rest=article.slice(claim.index+claim[0].length).split(/[.!?]/,1)[0];
    if(!decisionVerb.test(rest))continue;
    if(!facts.some(f=>normalize(f).includes(normalize(claim[0]))&&decisionVerb.test(f))){
     issues.push('Het publicatietijdstip is geen bewezen tijdstip van het clubbesluit. Verwijder de afgeleide datum of tijd.');
     break;
    }
   }
  }

  if(needsMatch(draft)){
   const narrative=[
    [/\b(?:voor rust|na rust|eerste helft|tweede helft|ruststand|voor de pauze|na de pauze|na de onderbreking)\b/i,'verloop per helft en ruststand'],
    [/\b(?:achterstand|terugknok|teruggevochten|omgebogen|comeback)\w*/i,'achterstand of comeback'],
    [/\b(?:domineer|dominantie|overwicht|domina(?:nt|nter))\w*/i,'overwicht of dominantie']
   ];
   for(const [pattern,label] of narrative)if(pattern.test(article)&&!pattern.test(evidence))issues.push('Niet aangeleverd wedstrijdverloop: '+label+'. Voeg controleerbare feiten toe of verwijder deze passage.');
  }
  if(anchored){
   const factScores=new Set(scores(evidence));
   const finalScore=match.homeScore+'-'+match.awayScore;
   if(!factScores.has(finalScore))issues.push('De vastgelegde eindstand thuis-uit staat niet in de gecontroleerde feiten. Leg de bronuitslag expliciet vast.');
   const evidenceText=normalize(evidence);
   for(const team of [match.homeTeam,match.awayTeam]){
    const alias=normalize(team).replace(/^(?:fc|sc|afc)\s+/,'');
    if(!(' '+evidenceText+' ').includes(' '+alias+' '))issues.push('Vastgelegde ploeg ontbreekt in de gecontroleerde feiten: '+team+'.');
   }
   const dates=[...evidence.matchAll(/\b\d{4}-\d{2}-\d{2}\b/g)].map(m=>m[0]);
   if(dates.length&&!dates.includes(match.playedAt))issues.push('De vastgelegde wedstrijddatum wijkt af van de datum in de gecontroleerde feiten.');
   const final=match.homeScore+'-'+match.awayScore;
   const explicitFinal=[...article.matchAll(/\b(?:eindstand|eindscore)\s*(?:was|is|van|:)??\s*(\d{1,2})\s*[-–:]\s*(\d{1,2})\b/gi)].map(m=>Number(m[1])+'-'+Number(m[2]));
   if(explicitFinal.some(x=>x!==final))issues.push('De genoemde eindstand komt niet overeen met de vastgelegde eindstand thuis-uit ('+final+').');
   const head=normalize(draft.headline),alias=value=>normalize(value).replace(/^(?:fc|sc|afc)\s+/,'');
   const win=/\b(?:wint|won|verslaat|versloeg|boekt een zege|boekt zege|pakt de winst)\b/;
   const draw=/\b(?:speelt gelijk|speelde gelijk|gelijkspel|puntendeling)\b/;
   const home=alias(match.homeTeam),away=alias(match.awayTeam);
   if(match.homeScore===match.awayScore&&win.test(head))issues.push('De kop noemt een overwinning terwijl de gecontroleerde eindstand een gelijkspel is.');
   if(match.homeScore!==match.awayScore&&draw.test(head)&&!/^na (?:het |een )?gelijkspel\b/.test(head))issues.push('De kop noemt een gelijkspel terwijl de gecontroleerde eindstand een winnaar heeft.');
   const loser=match.homeScore<match.awayScore?home:match.homeScore>match.awayScore?away:'';
   if(loser){const escaped=loser.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');if(new RegExp('\\b'+escaped+'\\s+(?:wint|won|verslaat|versloeg|boekt (?:een )?zege|pakt de winst)\\b').test(head))issues.push('De kop wijst de verliezende ploeg aan als winnaar. Controleer de teams en thuis-uit-volgorde.');}
   if(validDate(match.playedAt)){
    const day=new Date(match.playedAt+'T12:00:00Z').getUTCDay(),days=['zondag','maandag','dinsdag','woensdag','donderdag','vrijdag','zaterdag'];
    const intro=normalize((draft.headline||'')+' '+(draft.standfirst||''));
    if(days.some((name,i)=>i!==day&&new RegExp('\\b'+name+'\\b').test(intro)))issues.push('De weekdag in kop of intro past niet bij de vastgelegde wedstrijddatum.');
   }
  }
  return [...new Set(issues)];
 }
 function hasOfficialPreviewResult(payload){
  return payload.articleKind==='preview' &&
   Array.isArray(payload.verifiedFacts) && payload.verifiedFacts.some(fact=>/^Eerdere ontmoeting in de Nations League(?: op \d{1,2} [a-z]+)?:/i.test(fact) && scores(fact).length===1) &&
   Array.isArray(payload.sources) && new Set(payload.sources.filter(source=>/^https:\/\/www\.uefa\.com\/uefanationsleague\/match\/\d+--[a-z0-9-]+\/$/.test(source?.url)).map(source=>source.url)).size>=2;
 }

 // An official UEFA qualification announcement is not a match result.
 // This exception never applies to score claims or unverified sources.
 function verifiedUefaCompetitionStatus(payload){
  const d=payload?.draft||{},facts=payload?.verifiedFacts||[];
  const src=payload?.sources?.[0]?.url||'';
  if(payload?.articleKind!=='announcement'||payload.primaryAuthority!=='association_decision'||
     payload.category!=='Nations League'||payload.match||payload.sources?.length!==1||
     !/^https:\/\/www\.uefa\.com\/uefanationsleague\/news\/[^?#]+\/?$/.test(src)||
     facts.length<4||!facts.some(f=>/\b(?:confirmed|qualified|guaranteed|secured)\b/i.test(f))||
     !facts.some(f=>/\b(?:quarter.final(?:s)?|league a|group [a-d])\b/i.test(f)))return false;
  const prose=text(d);
  if(scores(prose).length||
     /\b(?:verslaat|versloeg|gelijkspel|puntendeling|eindstand|ruststand|doelpuntenmakers?|wedstrijdverloop|wedstrijduitslag)\b/i.test(prose)||
     /\b(?:wint|won|gewonnen|overwinning)\s+van\b/i.test(prose))return false;
  return true;
 }
 // An upcoming Eredivisie preview can cite independently proven *past* wins
 // without becoming a report of the fixture that has not been played.
 // This is only a story-type distinction: numerical, naming, originality
 // and the independent review checks still run unmodified.
 function verifiedClubPreviewHistory(payload){
  if(payload?.articleKind!=='preview'||payload.category!=='Eredivisie'||payload.match||payload.matchId||
     payload.feedLifecycle?.kind!=='preview'||payload.fixture?.competition!=='eredivisie'||
     payload.fixture?.status!=='NS'||!payload.fixture?.id||
     !validDate(String(payload.fixture?.date||'').slice(0,10))||
     !Array.isArray(payload.verifiedFacts)||payload.verifiedFacts.length<4||
     !Array.isArray(payload.sources)||payload.sources.length!==2)return false;
  let domains;
  try{domains=payload.sources.map(s=>new URL(s.url).hostname.replace(/^www\./,''));}
  catch{return false;}
  if(new Set(domains).size!==2||!domains.includes('eredivisie.nl')||
     domains.some(d=>!d||d==='flashscore.nl'))return false;
  const facts=payload.verifiedFacts.join(' '),prose=text(payload.draft);
  if(!/\b(?:won|gewonnen|overwinningen|zeges)\b/i.test(facts)||
     !/\b(?:vorige|laatste|eerder|onderlinge|reeks|opeenvolgende|voorgaande)\b/i.test(prose)||
     scores(prose).length||
     /\b(?:eindstand|ruststand|uitslag|scoreverloop|doelpuntenmakers|versloeg|verslaat)\b/i.test(prose))return false;
  return true;
 }
 function audit(payload){
  const draft=payload.draft||{},match=payload.match||null;
  const publisher=payload.sources?.[0]?.url==='https://www.sportmonks.com/football-api/'?'Sportmonks Football API':
   payload.sources?.[0]?.url==='https://www.football-data.org/'?'football-data.org':
   payload.sources?.[0]?.url==='https://github.com/openfootball/football.json'?'OpenFootball':
   payload.articleKind==='announcement'&&payload.officialFinalProof&&payload.sources?.length===3&&
    /^https:\/\/www\.onsoranje\.nl\/nieuws\/nederlands-elftal-mannen\/\d+\//.test(payload.sources[0]?.url||'')?
    payload.sources[0].url:
   payload.articleKind==='announcement'&&['club_decision','association_decision'].includes(payload.primaryAuthority)&&payload.sources?.length===1?
    payload.sources[0].url:'';
  const registry=payload.articleKind==='background'&&payload.sources?.find(s=>
   /^https:\/\/www\.uefa\.com\/uefachampionsleague\/clubs\/(?:players\/)?\d+--[a-z0-9-]+\/(?:squad\/)?$/.test(s?.url||''));
  const issues=evidenceIssues(draft,payload.verifiedFacts||[],match,publisher||registry?.url||'');
  if(match||(needsMatch(draft)&&!hasOfficialPreviewResult(payload)&&!verifiedUefaCompetitionStatus(payload)&&!verifiedClubPreviewHistory(payload))){
   if(!match||!String(match.homeTeam||'').trim()||!String(match.awayTeam||'').trim()||normalize(match.homeTeam)===normalize(match.awayTeam)||![match.homeScore,match.awayScore].every(x=>Number.isInteger(x)&&x>=0&&x<=99)||!validDate(match.playedAt))
    issues.push('Wedstrijdverslag: leg thuisploeg, uitploeg, eindstand thuis-uit en wedstrijddatum vast.');
   for(const [key,label] of [['resultVerified','eindstand en thuis-uit'],['namesVerified','namen en clubs'],['dateVerified','datum en weekdag'],['timelineVerified','wedstrijdverloop en doelpuntenmakers']])if(payload.factChecks?.[key]!==true)issues.push('Feitencontrole ontbreekt: '+label+'.');
  }
  return [...new Set(issues)];
 }
 return {audit,evidenceIssues,needsMatch,hasOfficialPreviewResult,verifiedClubPreviewHistory,officialPublisherName,verifiedUefaCompetitionStatus};
});

