'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const sportmonks=require('../sportmonks-football');
const matches=require('../editorial-match55');
const {articleUrl}=require('../scripts/editorial-discovery53');
const {editorialMatchSnapshot,europeanDeskPriority}=require('../scripts/automatic-publication');
const config=require('../automatic-editorial.json');
const now=Date.parse('2026-11-25T16:00:00Z');
const fixture=(competition)=>({competition,id:'sm-42',date:'2026-11-24T20:00:00Z',status:'FT',round:'Speelronde 5',home:{name:'PSV'},away:{name:'Arsenal'},goals:{home:2,away:1},halfTime:{home:1,away:0},resultSource:sportmonks.CREDIT,resultExpiresAt:now+3600000});
test('120H UEFA discovery accepts all three verified competition paths, not other pages',()=>{
 for(const league of ['uefachampionsleague','uefaeuropaleague','uefaconferenceleague']){
  const url='https://www.uefa.com/'+league+'/news/02ab-abc-1000--matchday-five/';
  assert.equal(articleUrl(url+'?tracking=1',config.newsIndexes),url);
  assert.equal(articleUrl('https://www.uefa.com/'+league+'/clubs/',config.newsIndexes),null);
 }
});
test('120H editorial-only subscribed league identifiers do not expand standings integration',()=>{
 assert.deepEqual([sportmonks.EDITORIAL_LEAGUES.championsleague,sportmonks.EDITORIAL_LEAGUES.europaleague,sportmonks.EDITORIAL_LEAGUES.conferenceleague],[2,5,2286]);
 assert.equal(sportmonks.LEAGUES.championsleague,undefined);
});
test('120H European finals retain independent provider, category and score checks',async()=>{
 for(const [competition,category] of [['championsleague','Champions League'],['europaleague','Europa League'],['conferenceleague','Conference League']]){
  const f=fixture(competition),record=matches.candidate(f,now);
  assert.equal(record.category,category);
  const restored=await matches.registrationFixtures(record,{recent:async c=>{assert.equal(c,competition);return [f]},domestic:async()=>{throw Error('wrong route')},european:async()=>{throw Error('wrong route')}});
  assert.equal(matches.matchesRegistration(record,restored,now),true);
  assert.equal(matches.matchesRegistration({...record,match:{...record.match,homeScore:9}},restored,now),false);
 }
});
test('120H verified European recent results accepted; unavailable leagues fail closed',async()=>{
 const f=fixture('europaleague');
 const snapshot=await editorialMatchSnapshot('europaleague',null,async path=>{
  assert.equal(path,'/editorial-sportmonks-recent?competition=europaleague');
  return {status:'available',coverage:'verified_recent_finals_only',fixtures:[f]};
 },now);
 assert.deepEqual(snapshot.fixtures,[f]);
 await assert.rejects(editorialMatchSnapshot('europaleague',null,async()=>({status:'source_unavailable'}),now),/Geen geverifieerde/);
 const fallback=await editorialMatchSnapshot('championsleague','/editorial-champions-league',async path=>path.includes('recent')?{status:'source_unavailable'}:{status:'available',fixtures:[]},now);
 assert.equal(fallback.status,'available');
});
test('120H fresh Dutch European results outrank other European and domestic results; stale results do not',()=>{
 const record=matches.candidate(fixture('championsleague'),now);
 assert.equal(europeanDeskPriority({matchRecord:record},now),2);
 assert.equal(europeanDeskPriority({matchRecord:{...record,match:{homeTeam:'Arsenal',awayTeam:'Inter'}}},now),1);
 assert.equal(europeanDeskPriority({matchRecord:{...record,category:'Premier League'}},now),0);
 assert.equal(europeanDeskPriority({matchRecord:record},now+2*86400000),0);
});
