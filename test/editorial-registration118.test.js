'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {candidate,matchesRegistration,registrationFixtures,SM}=require('../editorial-match55');
const now=Date.parse('2026-11-25T12:00:00Z');
function fixture(competition='kkd'){
 return {id:'sm-19715859',competition,date:'2026-11-24T19:00:00Z',status:'FT',
 round:'Speelronde 15',home:{name:'Jong Ajax'},away:{name:'Jong AZ'},
 goals:{home:2,away:1},halfTime:{home:1,away:1},
 resultSource:'Sportmonks Football API',resultExpiresAt:now+3600000};
}
function deps(recent){
 return {recent,domestic:async()=>{throw Error('Wrong domestic registry');},
 european:async()=>{throw Error('Wrong European registry');}};
}
test('118 KKD draft and publication verification rechecks exact recent provider facts',async()=>{
 const row=fixture(), payload=candidate(row,now);
 assert.ok(payload);
 const registered=await registrationFixtures(payload,deps(async key=>{
  assert.equal(key,'kkd');return [row];
 }));
 assert.equal(matchesRegistration(payload,registered,now),true);
 for(const altered of [
  {...payload,verifiedFacts:[...payload.verifiedFacts,'Verzonnen feit']},
  {...payload,match:{...payload.match,homeScore:9}},
  {...payload,matchId:'sm-99999'},
  {...payload,category:'Premier League'},
  {...payload,sources:[{url:'https://example.org/'}]}
 ]) assert.equal(matchesRegistration(altered,registered,now),false);
});
test('118 recent provider outages, wrong competition and wrong provenance fail closed',async()=>{
 const payload=candidate(fixture(),now);
 for(const recent of [async()=>{throw Error('unavailable');},async()=>[fixture('premierleague')],
 async()=>[{...fixture(),resultSource:'Other'}],async()=>[]]){
  const rows=await registrationFixtures(payload,deps(recent));
  assert.equal(matchesRegistration(payload,rows,now),false);
 }
 assert.deepEqual(await registrationFixtures({...payload,category:'constructor'},deps(async()=>{throw Error('unexpected');})),[]);
});
test('118 known competition routes and European / legacy registrations remain distinct',async()=>{
 for(const [category,key] of [['Eredivisie','eredivisie'],['Premier League','premierleague'],['KNVB Beker','knvbbeker']]){
  await registrationFixtures({matchId:'sm-1',category,sources:[{url:SM}]},deps(async actual=>{
   assert.equal(actual,key);return [];
  }));
 }
 const calls=[];
 const routes={recent:async()=>{throw Error('unexpected');},domestic:async key=>{calls.push(key);return {fixtures:[]};},
 european:async()=>{calls.push('european');return {fixtures:[]};}};
 await registrationFixtures({matchId:'fd-cl-123'},routes);
 await registrationFixtures({matchId:'of-nl-2026-example'},routes);
 await registrationFixtures({matchId:'sm-1',category:'Eredivisie Play-offs',sources:[{url:SM}]},routes);
 assert.deepEqual(calls,['european','eredivisie','eredivisieplayoffs']);
});
