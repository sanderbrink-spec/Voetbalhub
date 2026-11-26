'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {verifiedResult}=require('../scripts/editorial-international-results98w');
const now=Date.parse('2026-11-17T18:00:00Z');
const snippets=[
 'De bondscoach lichtte na afloop zijn keuzes voor het middenveld toe.',
 'De aanvoerder sprak na de wedstrijd over het verloop van de tweede helft.',
 'De trainer bevestigde dat de ploeg de volgende wedstrijd anders zal voorbereiden.',
 'De doelman verklaarde na afloop dat de ploeg als geheel beter moet verdedigen.'
];
function records(){
 const base={gender:'men',ageGroup:'senior',competition:'UEFA Nations League',status:'FT',
 homeTeam:'Nederland',awayTeam:'Duitsland',score:'1-2',kickoff:'2026-11-16T19:45:00Z',uefaMatchId:'2047909'};
 return [{...base,authority:'knvb',url:'https://www.onsoranje.nl/teams/185184/programma/wedstrijd/123',
  sourceText:snippets.join(' '),facts:snippets.map(text=>({text,quote:text}))},
 {...base,authority:'uefa',url:'https://www.uefa.com/uefanationsleague/match/2047909--netherlands-vs-germany/',
  sourceText:'UEFA match report',facts:[]}];
}
test('accepts only independently matching official senior men results with four distinct literal facts',()=>{
 const [a,b]=records(),result=verifiedResult(a,b,{now});
 assert.equal(result.status,'verified');assert.equal(result.matchId,'uefa-2047909');
 assert.equal(result.facts.length,4);assert.equal(result.sources.length,2);
});
test('conflicting result or date cannot become an article',()=>{
 const [a,b]=records();
 assert.equal(verifiedResult(a,{...b,score:'2-1'},{now}).status,'conflicting_official_result');
 assert.equal(verifiedResult(a,{...b,kickoff:'2026-11-15T19:45:00Z'},{now}).status,'conflicting_official_result');
});
test('missing ID, missing date, stale event, women or youth are blocked',()=>{
 const [a,b]=records();
 assert.equal(verifiedResult(a,{...b,uefaMatchId:null},{now}).status,'missing_stable_uefa_match_id');
 assert.equal(verifiedResult({...a,kickoff:null},b,{now}).status,'unverified_official_result');
 assert.equal(verifiedResult({...a,gender:'women'},b,{now}).status,'unverified_official_result');
 assert.equal(verifiedResult({...a,ageGroup:'under21'},b,{now}).status,'unverified_official_result');
 assert.equal(verifiedResult(a,b,{now:now+100*3600000}).status,'unverified_official_result');
});
test('repeated or nonliteral source facts do not meet the editorial evidence threshold',()=>{
 const [a,b]=records();
 a.facts=[a.facts[0],a.facts[0],{text:'Deze wedstrijd leverde zeker een historische zege op.',quote:snippets[1]}];
 assert.equal(verifiedResult(a,b,{now}).status,'insufficient_distinct_verified_match_facts');
});
test('nonofficial source and unrelated competition are never authoritative',()=>{
 const [a,b]=records();
 assert.equal(verifiedResult({...a,url:'https://example.org/match'},b,{now}).status,'unverified_official_result');
 assert.equal(verifiedResult(a,{...b,competition:'Friendly'},{now}).status,'unverified_official_result');
});
