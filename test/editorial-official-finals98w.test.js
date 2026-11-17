'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {KNVB_RESULTS,UEFA_RESULTS,DFB_RESULTS,officialRecentFinals}=require('../scripts/editorial-official-finals98w');
const now=Date.parse('2026-11-17T19:20:00Z');
const knvb={url:KNVB_RESULTS,text:'Nederlands elftal mannen Uitslagen UEFA Nations League Duitsland 16 nov 2026 5 - 0 Nederland Olympiastadion, Berlijn.'};
const uefa={url:UEFA_RESULTS,text:'UEFA Nations League 2026/27 Netherlands (A2) 13/11: Netherlands 7-0 Greece 16/11: Germany 5-0 Netherlands'};
const article={url:'https://www.onsoranje.nl/nieuws/nederlands-elftal-mannen/82839/oranje-slikt-bittere-nederlaag-duitsland-wel-kwartfinales',
 title:'Oranje slikt nederlaag in Duitsland',
 publishedAt:'2026-11-16T21:30:00Z',
 text:[
  'Oranje leed een 5-0 nederlaag tegen Duitsland in Berlijn.',
  'Nederland eindigde desondanks als tweede in groep A2 en bereikte daarmee de kwartfinales.',
  'Voor rust was de Nederlandse ploeg onzorgvuldig aan de bal en had het moeite met de opbouw.',
  'Na rust kreeg Nederland nauwelijks kansen en werd het steeds verder teruggedrongen.',
  'In de 60e minuut maakte Florian Wirtz een doelpunt voor de Duitsers.'
 ].join(' ')};

test('98W: only matching KNVB and UEFA men results make a verified final packet',()=>{
 const result=officialRecentFinals(knvb,uefa,[article],now);
 assert.equal(result.length,1);
 const {candidate,documents,proof}=result[0];
 assert.equal(candidate.kind,'announcement');
 assert.equal(candidate.verifiedOfficialFinal,true);
 assert.deepEqual(candidate.match,{homeTeam:'Duitsland',awayTeam:'Nederland',homeScore:5,awayScore:0,playedAt:'2026-11-16'});
 assert.equal(candidate.facts.length,5);
 assert.equal(candidate.sharedEventEvidence.length,2);
 assert.equal(proof.uefaResultsUrl,UEFA_RESULTS);
 assert.deepEqual(documents.map(x=>x.url),[article.url,KNVB_RESULTS,UEFA_RESULTS]);
 assert.equal(candidate.facts[0].evidence[1].quote,'16/11: Germany 5-0 Netherlands');
});

test('98W: scoreboard disagreements or missing dates never create a match fact',()=>{
 assert.deepEqual(officialRecentFinals(knvb,{...uefa,text:uefa.text.replace('5-0','4-0')},[article],now),[]);
 assert.deepEqual(officialRecentFinals(knvb,{...uefa,text:uefa.text.replace('Germany 5-0 Netherlands','Netherlands 5-0 Germany')},[article],now),[]);
 assert.deepEqual(officialRecentFinals({...knvb,text:knvb.text.replace('16 nov 2026','16 2026')},uefa,[article],now),[]);
 assert.deepEqual(officialRecentFinals(knvb,{...uefa,text:uefa.text.replace('2026/27','2025/26')},[article],now),[]);
 assert.deepEqual(officialRecentFinals({...knvb,text:knvb.text.replace('5 - 0','4 - 0')},uefa,[article],now),[]);
});
test('98W: excludes women, youths, distant matches and a result without distinct proven context',()=>{
 assert.deepEqual(officialRecentFinals(knvb,uefa,[{...article,title:'Oranje vrouwen slikt nederlaag'}],now),[]);
 assert.deepEqual(officialRecentFinals(knvb,uefa,[{...article,url:'https://www.onsoranje.nl/nieuws/jeugd-mannen/818/a'}],now),[]);
 assert.deepEqual(officialRecentFinals(knvb,uefa,[article],Date.parse('2026-11-20T12:00:00Z')),[]);
 assert.deepEqual(officialRecentFinals(knvb,uefa,[{...article,text:'Oranje leed een 5-0 nederlaag tegen Duitsland. Er is geen verder wedstrijdnieuws beschikbaar.'}],now),[]);
});
test('98W: repeat source listing does not create duplicate article packets',()=>{
 const reports=[article,structuredClone(article)];
 assert.equal(officialRecentFinals(knvb,uefa,reports,now).length,1);
});

test('98W: fully evidenced announcement passes normal source gates, tampering cannot bypass them',()=>{
 const {candidate,documents,proof}=officialRecentFinals(knvb,uefa,[article],now)[0];
 const {validateEvidence}=require('../scripts/automatic-publication');
 const desk=require('../editorial-desk-model');
 assert.deepEqual(validateEvidence(candidate,documents,now),[]);
 const payload={articleKind:'announcement',category:'Nations League',match:candidate.match,
  officialFinalProof:proof,
  verifiedFacts:candidate.facts.map(f=>f.text),
  sources:documents.map(doc=>({url:doc.url}))
 };
 assert.equal(desk.officialInternationalFinal(payload),true);
 assert.equal(desk.officialInternationalFinal({...payload,match:{...candidate.match,awayScore:4}}),false);
 assert.equal(desk.officialInternationalFinal({...payload,sources:payload.sources.slice(0,2)}),false);
 assert.equal(desk.officialInternationalFinal({...payload,verifiedFacts:payload.verifiedFacts.slice(0,2)}),false);
 assert.equal(desk.officialInternationalFinal({...payload,officialFinalProof:{...proof,sourceNewsUrl:'https://example.org/false'}}),false);
 const altered=structuredClone(candidate);
 altered.sharedEventEvidence[1].quote='An independent football website confirms nothing.';
 assert.ok(validateEvidence(altered,documents,now).some(issue=>/bevestiging|broncitaat/i.test(issue)));
});

test('98W: full official HTML beats 14k article truncation and preserves literal excerpts',()=>{
 const knvbHtml='<main><h1>Nederlands elftal mannen</h1><div>UEFA Nations League</div>'+
   '<a href="/teams/185184/programma/wedstrijd/123">Duitsland <time>16 nov 2026</time> <strong>5 - 0</strong> Nederland</a></main>';
 const uefaHtml='<article><h1>2026/27 UEFA Nations League results</h1>'+
   '<p>Published league-phase results</p><section><h3>Netherlands (A2)</h3>'+
   '<p><b>16/11</b>: <a href="/uefanationsleague/match/123--germany-vs-netherlands/">Germany 5-0 Netherlands</a></p></section></article>';
 const knvbRaw={...knvb,text:'Nederlands elftal mannen resultaten',html:knvbHtml};
 const uefaRaw={...uefa,text:'2026/27 UEFA Nations League',html:uefaHtml};
 const rows=officialRecentFinals(knvbRaw,uefaRaw,[article],now);
 assert.equal(rows.length,1);
 assert.equal(rows[0].candidate.facts.length,5);
 const [story,knvbDoc,uefaDoc]=rows[0].documents;
 assert.equal(story.url,article.url);
 for(const piece of rows[0].candidate.facts[0].evidence){
  assert.ok(rows[0].documents[piece.source].text.includes(piece.quote),piece.quote);
 }
 assert.match(knvbDoc.text,/UEFA Nations League Duitsland 16 nov 2026 5 - 0 Nederland/);
 assert.match(uefaDoc.text,/16\/11 : Germany 5-0 Netherlands/);
 const {validateEvidence}=require('../scripts/automatic-publication');
 assert.deepEqual(validateEvidence(rows[0].candidate,rows[0].documents,now),[]);
});

test('98W: DFB official men schedule independently replaces a blocked UEFA index',()=>{
 const dfb={url:DFB_RESULTS,text:'DFB Datencenter UEFA Nations League Div. A Montag, 16.11.2026 20:45 Uhr Deutschland 5 : 0 Niederlande'};
 const rows=officialRecentFinals(knvb,dfb,[article],now);
 assert.equal(rows.length,1);
 const {candidate,documents,proof}=rows[0];
 assert.deepEqual(candidate.match,{homeTeam:'Duitsland',awayTeam:'Nederland',homeScore:5,awayScore:0,playedAt:'2026-11-16'});
 assert.equal(proof.dfbResultsUrl,DFB_RESULTS);
 assert.equal(proof.uefaResultsUrl,undefined);
 assert.equal(documents[2].url,DFB_RESULTS);
 assert.deepEqual(require('../scripts/automatic-publication').validateEvidence(candidate,documents,now),[]);
 const desk=require('../editorial-desk-model');
 const payload={articleKind:'announcement',category:'Nations League',
  match:candidate.match,officialFinalProof:proof,
  verifiedFacts:candidate.facts.map(f=>f.text),sources:documents.map(d=>({url:d.url}))};
 assert.equal(desk.officialInternationalFinal(payload),true);
 assert.equal(desk.officialInternationalFinal({...payload,officialFinalProof:{...proof,uefaResultsUrl:UEFA_RESULTS}}),false);
 assert.equal(desk.officialInternationalFinal({...payload,officialFinalProof:{...proof,dfbResultsUrl:'https://example.org/stale'}}),false);
});
test('98W: DFB score, date, gender and competition conflicts fail closed',()=>{
 const base={url:DFB_RESULTS,text:'DFB Datencenter UEFA Nations League Div. A Montag, 16.11.2026 20:45 Uhr Deutschland 5 : 0 Niederlande'};
 assert.deepEqual(officialRecentFinals(knvb,{...base,text:base.text.replace('5 : 0','5 : 1')},[article],now),[]);
 assert.deepEqual(officialRecentFinals(knvb,{...base,text:base.text.replace('16.11.2026','15.11.2026')},[article],now),[]);
 assert.deepEqual(officialRecentFinals(knvb,{...base,text:base.text.replace('UEFA Nations League Div. A','Frauen Bundesliga')},[article],now),[]);
 assert.deepEqual(officialRecentFinals(knvb,{...base,text:base.text.replace('Deutschland 5 : 0 Niederlande','Niederlande 5 : 0 Deutschland')},[article],now),[]);
});

test('98X: draft storage preserves official final proof and rejects altered identity',()=>{
 const {candidate,documents,proof}=officialRecentFinals(knvb,uefa,[article],now)[0];
 const {cleanPayload}=require('../editorial-drafts');
 const desk=require('../editorial-desk-model');
 const payload={draft:{headline:article.title,body:[]},articleKind:'announcement',
  match:candidate.match,officialFinalProof:proof,
  verifiedFacts:candidate.facts.map(f=>f.text),sources:documents.map(doc=>({url:doc.url})),
  factChecks:{resultVerified:true,namesVerified:true,dateVerified:true,timelineVerified:true}};
 const cleaned=cleanPayload(payload);
 assert.deepEqual(cleaned.officialFinalProof,proof);
 assert.equal(desk.officialInternationalFinal(cleaned),true);
 assert.equal(desk.officialInternationalFinal({...cleaned,officialFinalProof:{...proof,match:{...proof.match,homeScore:1}}}),false);
});

test('98W: an independently verified final is editorially distinct from earlier group-status news',()=>{
 const {duplicate}=require('../scripts/automatic-publication');
 const {candidate,proof,documents}=officialRecentFinals(knvb,{
  url:DFB_RESULTS,
  text:'DFB Datencenter UEFA Nations League Div. A Montag, 16.11.2026 20:45 Uhr Deutschland 5 : 0 Niederlande'
 },[article],now)[0];
 const current={
  articleKind:'announcement',topicTeams:candidate.teams,topicDate:candidate.eventDate,
  match:candidate.match,officialFinalProof:proof,
  sources:documents.map(d=>({url:d.url})),
  verifiedFacts:candidate.facts.map(f=>f.text),
  draft:{headline:'Duitsland Nederland Nations League na 5-0',
   standfirst:'Duitsland versloeg Nederland met 5-0 in de Nations League.',body:['Oorspronkelijk wedstrijdverhaal.']}
 };
 const status={articleKind:'announcement',
  headline:'Duitsland Nederland Nations League kwartfinales 2026',
  standfirst:'Beide landen zijn verzekerd van de volgende ronde.',
  body:['De groepsstatus is officieel vastgelegd.'],
  sources:[{url:'https://www.uefa.com/uefanationsleague/news/02ab-status/'}]};
 assert.equal(duplicate(current,[status]),false);
 assert.equal(duplicate({...current,officialFinalProof:null},[status]),true);
 const oldFullMatch={...status,headline:'Duitsland verslaat Nederland met 5-0',standfirst:'Duitsland 5-0 Nederland in Berlijn.'};
 assert.equal(duplicate(current,[oldFullMatch]),true);
 assert.equal(duplicate(current,[{...status,sources:[{url:proof.sourceNewsUrl}]}]),true);
 assert.equal(duplicate(current,[{...status,match:structuredClone(candidate.match)}]),true);
 assert.equal(duplicate(current,[{...status,headline:current.draft.headline}]),true);
});
