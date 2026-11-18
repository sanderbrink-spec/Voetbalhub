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

test('98Y: exact official match quality failure gets one bounded source-scoped retry',()=>{
 const {reopenOfficialFinalQuality98Y}=require('../scripts/automatic-publication');
 const crypto=require('node:crypto');
 const reason='Kwaliteitscontrole na 2 herschrijvingen: Controleer namen die niet in de aangeleverde feiten staan: De Nederlandse. Niet aangeleverd wedstrijdverloop: overwicht of dominantie. Voeg controleerbare feiten toe of verwijder deze passage.';
 const hash=crypto.createHash('sha256').update(reason).digest('hex');
 const now=Date.parse('2026-11-17T23:00:00Z');
 const group=Object.assign([{publishedAt:'2026-11-16T21:30:00Z'}],{officialFinalCandidate:{match:{homeTeam:'Duitsland',awayTeam:'Nederland',homeScore:5,awayScore:0,playedAt:'2026-11-16'}}});
 const job={status:'review',failureStage:'quality',failureCategory:'journalistic_rejection',errorHash:hash,attempts:2,checkpoint:{test:1}};
 assert.equal(reopenOfficialFinalQuality98Y(job,group,now),true);
 assert.equal(job.status,'pending');assert.equal(job.attempts,0);assert.equal(job.checkpoint,undefined);
 assert.equal(reopenOfficialFinalQuality98Y(job,group,now),false);
 assert.equal(reopenOfficialFinalQuality98Y({...job,status:'review'},group,now),false);
 assert.equal(reopenOfficialFinalQuality98Y({...job,status:'review',officialFinalQualityRetry98Y:false,errorHash:'wrong'},group,now),false);
 assert.equal(reopenOfficialFinalQuality98Y({...job,status:'review',officialFinalQualityRetry98Y:false},group,Date.parse('2026-11-22T00:00:00Z')),false);
});

test('98Y: official final extracts distinctive proven timeline events from both halves',()=>{
 const rich={...article,text:[
  'Oranje verloor de uitwedstrijd tegen Duitsland met 5-0.',
  'Nederland eindigde als tweede in groep A2 en plaatste zich voor de kwartfinales van de Nations League.',
  'Voor rust maakten beide ploegen weinig kansen vanuit het veldspel.',
  'In de 19e minuut kreeg Crysencio Summerville de bal in het strafschopgebied.',
  'Een kansrijke positie, maar de speler gleed uit voordat hij kon schieten.',
  'In de 32e minuut schoot Derry Scherhant de bal op de paal.',
  'Na rust kreeg Oranje in korte tijd meerdere doelpunten tegen.',
  'In de 60e minuut schoot Florian Wirtz de bal binnen: 2-0.',
  'In de 77e minuut tikte Brajan Gruda de vijfde treffer binnen.'
 ].join(' ')};
 const rows=officialRecentFinals(knvb,uefa,[rich],now);
 assert.equal(rows.length,1);
 const {candidate,documents}=rows[0];
 assert.ok(candidate.facts.length>=7,JSON.stringify(candidate.facts));
 assert.ok(candidate.facts.some(f=>/19e minuut/.test(f.text)));
 assert.ok(candidate.facts.some(f=>/gleed uit voordat hij/.test(f.text)));
 assert.ok(candidate.facts.some(f=>/60e minuut/.test(f.text)));
 assert.ok(candidate.facts.some(f=>/77e minuut/.test(f.text)));
 assert.deepEqual(require('../scripts/automatic-publication').validateEvidence(candidate,documents,now),[]);
});

test('98Y: one bounded early retry for current source outage, never lower fact or editorial gates',()=>{
 const {reopenTransientOfficialFinal98Y}=require('../scripts/automatic-publication');
 const now=Date.parse('2026-11-17T23:10:00Z');
 const group=Object.assign([{publishedAt:'2026-11-16T21:30:00Z'}],{officialFinalCandidate:{verifiedOfficialFinal:true}});
 const base={status:'retry',failureStage:'verification',failureCategory:'temporary_source_failure',reason:'external_service_unavailable',updatedAt:now-180000,nextAttemptAt:now+3600000,checkpoint:{draft:'untrusted'}};
 assert.equal(reopenTransientOfficialFinal98Y(base,group,now),true);
 assert.equal(base.status,'pending');assert.equal(base.nextAttemptAt,now);assert.equal(base.checkpoint,undefined);
 assert.equal(reopenTransientOfficialFinal98Y(base,group,now),false);
 assert.equal(reopenTransientOfficialFinal98Y({...base,status:'retry',officialFinalTransientRetry98Y:false,updatedAt:now-30000},group,now),false);
 assert.equal(reopenTransientOfficialFinal98Y({...base,status:'retry',officialFinalTransientRetry98Y:false,updatedAt:now-180000},group,now+72*3600000),false);
 assert.equal(reopenTransientOfficialFinal98Y({...base,status:'review',officialFinalTransientRetry98Y:false},group,now),false);
});

const richFinal={...article,text:[
  'Oranje verloor de uitwedstrijd tegen Duitsland met 5-0.',
  'Nederland eindigde als tweede in groep A2 en bereikte de kwartfinales.',
  'Aan de hoge verwachtingen konden beide ploegen in de eerste helft niet voldoen.',
  'Oranje werd in de tweede helft totaal afgeschminkt en kreeg veel doelpunten tegen.',
  'In de 19e minuut kreeg Crysencio Summerville de bal bij het doel.',
  'Een kansrijke positie, maar de aanvaller gleed weg voordat hij kon schieten.',
  'Een schot van Derry Scherhant kwam in de 32e minuut tegen de paal.',
  'Derry Scherhant schoot kort daarna namens Duitsland raak: 1-0.',
  'In de 60e minuut mikte Florian Wirtz vanaf afstand raak: 2-0.',
  'In de 77e minuut tikte Brajan Gruda de 5-0 binnen.',
  'Vrijdag is de loting voor de kwartfinales van de Nations League.'
 ].join(' ')};
test('98Y: score-opening and quarter-final draw are proven without generic play opinions',()=>{
 const rows=officialRecentFinals(knvb,uefa,[richFinal],now);
 assert.equal(rows.length,1);
 const {candidate,documents}=rows[0];
 assert.ok(candidate.facts.some(f=>/1-0/.test(f.text)),JSON.stringify(candidate.facts));
 assert.ok(candidate.facts.some(f=>/loting/.test(f.text)),JSON.stringify(candidate.facts));
 assert.ok(candidate.facts.length<=10);
 assert.deepEqual(require('../scripts/automatic-publication').validateEvidence(candidate,documents,now),[]);
});


test('a previously skipped official final is due once with freshly checked substantial evidence',()=>{
 const {reopenVerifiedOfficialFinalWriter}=require('../scripts/automatic-publication');
 const {EditorialQueue}=require('../editorial-production45');
 const {createHash}=require('node:crypto');
 const {candidate,documents}=officialRecentFinals(knvb,uefa,[richFinal],now)[0];
 const group=Object.assign(documents,{officialFinalCandidate:candidate});
 const queue=new EditorialQueue();
 const job=queue.enqueue(group,now);
 const skip='Onvoldoende gecontroleerde feiten voor een inhoudelijk concept. Vul zo nodig aanvullende, verschillende feiten aan.';
 Object.assign(job,{status:'review',failureStage:'generation',failureCategory:'journalistic_rejection',
  reason:'insufficient_verified_facts',errorHash:createHash('sha256').update(skip).digest('hex'),
  attempts:1,checkpoint:{draft:'rejected'}});
 assert.equal(queue.due(job,now),false);
 const thin=Object.assign(group.slice(),{officialFinalCandidate:{...candidate,facts:candidate.facts.slice(0,4)}});
 assert.equal(reopenVerifiedOfficialFinalWriter(job,thin,now),false);
 const conflicting=Object.assign([group[0],group[1],{...group[2],text:'Different score'}],{officialFinalCandidate:candidate});
 assert.equal(reopenVerifiedOfficialFinalWriter(job,conflicting,now),false);
 assert.equal(reopenVerifiedOfficialFinalWriter(job,group,now+72*3600000),false);
 assert.equal(reopenVerifiedOfficialFinalWriter({...job,status:'duplicate'},group,now),false);
 assert.equal(reopenVerifiedOfficialFinalWriter({...job,failureStage:'quality'},group,now),false);
 assert.equal(reopenVerifiedOfficialFinalWriter(job,group,now),true);
 assert.equal(queue.due(job,now),true);
 assert.equal(job.checkpoint,undefined);
 job.status='review';
 assert.equal(reopenVerifiedOfficialFinalWriter(job,group,now),false);
});

test('official final writer can use minute-based evidence without inventing a half and retains the skip gate',async()=>{
 const {createEditorialDraft}=require('../editorial-ai');
 const {candidate,documents}=officialRecentFinals(knvb,uefa,[richFinal],now)[0];
 const facts=candidate.facts.map(f=>f.text);
 const requests=[];
 const router={async complete(messages){requests.push(structuredClone(messages));return {skip:true};}};
 const input={topic:candidate.topic,category:candidate.category,articleKind:candidate.kind,
  facts,sourceUrls:documents.map(doc=>doc.url),match:candidate.match,officialFinal:true,automaticPublication:true};
 const skipped=error=>error.status===422;
 await assert.rejects(createEditorialDraft(input,{router}),skipped);
 assert.equal(requests.length,2);
 assert.match(requests[0][0].content,/speelhelft of ruststand als die expliciet/);
 assert.match(requests[1].at(-1).content,/bekende tussenstanden zonder speelhelft/);
 assert.deepEqual(JSON.parse(requests[0][1].content).facts,facts);
 assert.equal(JSON.parse(requests[0][1].content).editorialAssignment,null);
 requests.length=0;
 await assert.rejects(createEditorialDraft({...input,facts:facts.slice(0,4)},{router}),skipped);
 assert.equal(requests.length,1);
});
