'use strict';

const {buildStoryStrategy} = require('../editorial-newsroom-strategy103');
const {articleUrl} = require('./editorial-discovery53');
const {AGENTS, isRumour, classifyLeads} = require('./ten-agent-newsroom101');
const {buildScoutHandoffs}=require('./editorial-scout-handoff112');
const config = require('../automatic-editorial.json');
const league = 'https://eredivisie.nl/nieuws/vooruitblik-speelronde-';
const clubSites = {
 'ajax.nl':'Ajax','psv.nl':'PSV','fcgroningen.nl':'FC Groningen','fctwente.nl':'FC Twente',
 'az.nl':'AZ Alkmaar','feyenoord.com':'Feyenoord','peczwolle.nl':'PEC Zwolle',
 'fortunasittard.nl':'Fortuna Sittard','willem-ii.nl':'Willem II'
};
const normalize = value => String(value).normalize('NFD').replace(/\p{M}/gu,'').toLowerCase()
 .replace(/n\.e\.c\./g,'nec').replace(/[^a-z0-9]+/g,' ').trim();
function mentions(text,team) {
 const aliases = {
  'nec nijmegen':['nec nijmegen','nec'], 'az alkmaar':['az alkmaar','az'],
  'sc heerenveen':['sc heerenveen','heerenveen'], 'ado den haag':['ado den haag','ado']
 };
 const name=normalize(team);
 return (aliases[name]||[name]).some(alias=>(' '+normalize(text)+' ').includes(' '+alias+' '));
}
function fresh(doc,now) {
 const age=now-Date.parse(doc?.publishedAt);
 return age>=0 && age<=config.maxAgeHours*3600000;
}
function paragraphs(doc,plain) {
 return Array.from(doc.html.matchAll(/<p\b[^>]*>([\s\S]*?)<\/p>/gi),m=>plain(m[1]))
  .filter(p=>p.length>=30 && doc.text.includes(p));
}
function sentences(paragraph) {
 // Preserve sentence boundaries, including periods in N.E.C. and decimal scores.
 return Array.from(new Intl.Segmenter('nl',{granularity:'sentence'}).segment(paragraph),s=>s.segment.trim())
  .filter(s=>s.length>=30 && s.length<=360 && /[.!]$/.test(s) && !/[?“”"]/.test(s));
}
function clubEvidence(f,docs,now,plain) {
 const teams=[f.home.name,f.away.name];
 for(const doc of docs) {
  const canonical=articleUrl(doc.url,config.newsIndexes);
  if(!canonical||!fresh(doc,now)||!doc.html)continue;
  const club=clubSites[new URL(canonical).hostname.replace(/^www\./,'')];
  if(!teams.includes(club)||/jeugd|vrouwen|jong ajax|jong psv|onder \d+|oefenduel/i.test(doc.title))continue;
  const opponent=teams.find(t=>t!==club);
  const parts=paragraphs(doc,plain).slice(0,7);
  if(!mentions(doc.title+' '+parts[0],opponent))continue;
  const kickoffDay=new Intl.DateTimeFormat('nl',{timeZone:'Europe/Amsterdam',weekday:'long'}).format(new Date(f.date));
  if(!parts.some(p=>normalize(p).includes(kickoffDay)))continue;
  const quotes=parts.flatMap(sentences);
  const event=quotes.find(p=>mentions(p,opponent)&&/thuisduel|thuiswedstrijd|ontvangt|tegen|treft|op bezoek|afreist|hervat|staat .*onder leiding/i.test(p)&&
   !/vorige|afgelopen|verleden|eerder|vorig|laatste uitwedstrijd/i.test(p));
  if(!event||uncertain.test(event))continue;
  return {doc,quotes,event};
 }
}
function competitionEvidence(doc,f,plain) {
 const round=/^Speelronde ([1-9]\d?)$/.exec(f.round);
 if(!round||doc.url!==league+round[1]+'/'||!new RegExp('^Vooruitblik speelronde '+round[1]+'\\b','i').test(doc.title))return;
 const both=s=>mentions(s,f.home.name)&&mentions(s,f.away.name);
 // Never carry facts from another fixture in a multi-match roundup. Only a
 // paragraph independently naming BOTH clubs supplies facts for this fixture.
 const parts=paragraphs(doc,plain).filter(p=>both(p)&&!p.includes('interlandbreak terug met'));
 for(const p of parts){
  const rows=sentences(p);
  const event=rows.find(s=>both(s)&&/ontvangt|terug bij|hervat|ontmoet|treft|tegen|op bezoek|tussen/i.test(s));
  if(event&&!uncertain.test(event))return {event,quotes:parts.flatMap(sentences)};
 }
}
const uncertain=/\b(?:gerucht|mogelijk|vermoedelijk|zou|zouden|naar verluidt|volgens media|wellicht)\b/i;
function investigate(f,club,organiser,now,plain) {
 if(!club||!fresh(organiser,now)||!organiser?.html)return;
 const official=competitionEvidence(organiser,f,plain);
 if(!official)return;
 const day=new Intl.DateTimeFormat('nl',{timeZone:'Europe/Amsterdam',weekday:'long'}).format(new Date(f.date));
 const wrongDay=quote=>Array.from(quote.toLowerCase().matchAll(/\b(maandag|dinsdag|woensdag|donderdag|vrijdag|zaterdag|zondag)(?:ochtend|middag|avond)?\b/g),
  match=>match[1]).some(value=>value!==day);
 if(wrongDay(official.event)||wrongDay(club.event))return;
 const docs=[club.doc,organiser];
 const facts=[];
 function add(quote,source){
  if(!quote||uncertain.test(quote)||facts.some(row=>normalize(row.text)===normalize(quote)))return;
  facts.push({text:quote,evidence:[{source,quote}]});
 }
 add(club.event,0);
 const gaps=buildStoryStrategy(facts.map(row=>row.text),{topic:club.doc.title}).evidenceGaps;
 if(!gaps.length)return;
 const evidenceWords=/\b(?:trainer|training|selectie|geblesseerd\w*|geschorst\w*|competitie\w*|overwinning\w*|punten|speelronde|doelpunten|won|scoorde|terugkeer|vervangen|assists|geblesseerden)\b/i;
 for(const quote of official.quotes.filter(q=>evidenceWords.test(q)&&
  [f.home.name,f.away.name].some(team=>mentions(q,team))&&
  !/^(?:Het is zijn|De cijfers achter|Ook dit|Bij hem)\b/i.test(q)).slice(0,4))add(quote,1);
 for(const quote of club.quotes.filter(q=>evidenceWords.test(q)&&
  [f.home.name,f.away.name].some(team=>mentions(q,team))).slice(0,4))add(quote,0);
 if(facts.length<4||!facts.some(row=>row.evidence[0].source===1))return;
 const eventDate=new Intl.DateTimeFormat('sv-SE',{timeZone:'Europe/Amsterdam'}).format(new Date(f.date));
 const topic=f.home.name+' – '+f.away.name;
 const candidate={topic,kind:'preview',category:'Eredivisie',eventDate,teams:[f.home.name,f.away.name],
  kickoff:Date.parse(f.date),fixture:f,facts,sharedEventEvidence:[{source:0,quote:club.event},{source:1,quote:official.event}]};
 const ledger=facts.map(({text,evidence},index)=>{
  const doc=docs[evidence[0].source];
  return {id:'F'+(index+1),url:doc.url,publishedAt:doc.publishedAt,excerpt:text,
   verification:'literal_first_party_statement',newFromCompetition:evidence[0].source===1&&!normalize(club.doc.text).includes(normalize(text))};
 });
 if(!ledger.some(row=>row.newFromCompetition))return;
 return {group:Object.assign(docs,{clubPreview:candidate}),ledger,gaps};
}
async function research({fixtures,docs,matchGroups,leads,researchNotes=[],now,loadRound,plain,validate,artwork,published=[]}) {
 const topics=[],groups=[],seen=new Set(),rounds=new Map();
 let deep=0;
 const upcoming=fixtures.filter(f=>f.competition==='eredivisie'&&f.status==='NS'&&f.home?.name&&f.away?.name&&
  /^Speelronde [1-9]\d?$/.test(f.round)&&Date.parse(f.date)>now&&Date.parse(f.date)<=now+7*86400000);
 const currentLeads=leads.filter(s=>fresh(s,now)&&typeof s.title==='string'&&typeof s.url==='string');
 const scoutTopics=[];
 const classified=classifyLeads(currentLeads);
 const scoutHandoffs=buildScoutHandoffs(classified.groups,researchNotes,now);
 const questionHandoffByGroup=new Map(scoutHandoffs.map(x=>[x.groupKey,x]));
 const beats=new Set(),usedPersons=new Set();
 for(const g of classified.groups){
  // A briefing on a match is already covered by its fixture dossier.
  const transfer=g.agents.includes('transfers')&&/\b(?:transfer|contract|overstap|vertrekt|tekent|bod|transfernieuws)\b/i.test(g.subject);
  if(!transfer||g.contradictory||!g.sources.length)continue;
  const tokens=normalize(g.subject).split(' ').filter(t=>t.length>4);
  if(tokens.some(t=>usedPersons.has(t)))continue;
  const beat=g.agents.find(a=>!['transfers','geruchten','achtergrond'].includes(a))||'transfers';
  if(beats.has(beat))continue;
  const sources=g.sources.map(s=>s.url);
  const relevant=docs.filter(d=>fresh(d,now)&&tokens.filter(t=>normalize(d.title).includes(t)).length>=2);
  scoutTopics.push({topic:g.subject,sources,scouts:g.agents,primaryCandidates:relevant.map(d=>d.url),
   ...(questionHandoffByGroup.has(g.id)?{researchQuestions:questionHandoffByGroup.get(g.id).questions,
    questionsAreUnverified:true,questionSourceIds:questionHandoffByGroup.get(g.id).sourceUrls}:{}),
   status:g.rumour?'attributed_unconfirmed':'no_verified_transfer_decision'});
  beats.add(beat);tokens.forEach(t=>usedPersons.add(t));
  if(scoutTopics.length===3)break;
 }
 const candidates=upcoming.map(f=>({f,club:clubEvidence(f,docs,now,plain)}));
 candidates.sort((a,b)=>Number(!!b.club)-Number(!!a.club)||Date.parse(a.f.date)-Date.parse(b.f.date));
 for(const {f,club} of candidates){
  if(topics.length>=10-scoutTopics.length)break;
  const key=[f.date,f.home.name,f.away.name].join('|');
  if(seen.has(key)||seen.has(f.id))continue;
  seen.add(f.id);
  seen.add(key);
  const topic=f.home.name+' – '+f.away.name;
  const signals=currentLeads.filter(s=>fresh(s,now)&&mentions(s.title,f.home.name)&&mentions(s.title,f.away.name))
   .slice(0,3).map(s=>({url:s.url,attributedRumour:isRumour(s.title)}));
  const row={topic,fixtureId:f.id,sources:[...(club?[club.doc.url]:[]),...signals.map(s=>s.url)],
   scouts:AGENTS.filter(agent=>agent.pattern.test(topic)).map(agent=>agent.id),signals,
   scheduleSource:'/integrations/football?competition=eredivisie',status:'missing_club_evidence'};
  topics.push(row);
  if(!club)continue;
  if(published.some(a=>a.fixture?.id===f.id&&a.feedLifecycle?.kind==='preview'||a.sources?.[0]?.url===club.doc.url)){row.status='duplicate';continue;}
  if(deep>=3){row.status='research_limit';continue;}
  deep++;
  row.deep=true;
  const url=league+f.round.split(' ')[1]+'/';
  row.sources.push(url);
  if(!rounds.has(url))rounds.set(url,loadRound(url));
  let organiser;
  try{organiser=await rounds.get(url);}catch(e){row.status='source_unavailable';row.reason=e.message;continue;}
  const result=investigate(f,club,organiser,now,plain);
  if(!result){row.status='insufficient_dated_event_evidence';continue;}
  const {group,ledger,gaps}=result;
  const issues=validate(group.clubPreview,group,now);
  if(issues.length){row.status='evidence_rejected';row.reason=issues.join(' ');continue;}
  row.ledger=ledger;row.questions=gaps.map(g=>g.question);
  row.status=artwork(group,group.clubPreview,topic).approved?'ready_for_writer':'awaiting_approved_artwork';
  groups.push(group);
 }
 topics.push(...scoutTopics);
 for(const group of matchGroups){
  if(topics.length===10)break;
  const m=group.matchRecord;
  if(seen.has(m.matchId))continue;
  seen.add(m.matchId);
  topics.push({topic:m.topic,fixtureId:m.matchId,sources:m.sources.map(s=>s.url),verifiedFacts:m.verifiedFacts.length,
   status:artwork(group,{},m.topic).approved?'verified_match':'awaiting_approved_artwork'});
 }
 // Read-only scout questions do not create publication candidates or verified facts.
 return {topics,groups,deep,scoutHandoffs,scoutHandoffCount:scoutHandoffs.length};
}
module.exports={research,investigate,clubEvidence,competitionEvidence};
