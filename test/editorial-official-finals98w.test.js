'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {KNVB_RESULTS,UEFA_RESULTS,officialRecentFinals}=require('../scripts/editorial-official-finals98w');
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
