'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const LaLiga=require('../football-laliga108');
const Football=require('../football-data47');
const now=Date.parse('2026-11-22T19:00:00Z');
function dataset(){
 const matches=[];let id=1000;
 for(let home=1;home<=20;home++)for(let away=1;away<=20;away++){
  if(home===away)continue;
  matches.push({id:id++,competition:{code:'PD'},matchday:1+Math.floor(matches.length/10)%38,
   utcDate:'2026-12-01T12:00:00Z',status:'TIMED',
   homeTeam:{id:home,name:'Team '+home},awayTeam:{id:away,name:'Team '+away},
   score:{duration:'REGULAR',fullTime:{home:null,away:null}}});
 }
 return {competition:{code:'PD'},season:{startDate:'2026-08-01'},matches};
}
test('108A exact 380 La Liga matches with 20 clubs; only confirmed finals become facts',()=>{
 const data=dataset();
 data.matches[0]={...data.matches[0],status:'FINISHED',
  utcDate:'2026-11-20T18:00:00Z',score:{duration:'REGULAR',
   fullTime:{home:2,away:1},halfTime:{home:1,away:0}}};
 const fixtures=LaLiga.parseSeason(data,2026,now);
 assert.equal(fixtures.length,380);
 assert.equal(fixtures[0].resultSource,'Football-Data.org');
 assert.deepEqual(fixtures[0].goals,{home:2,away:1});
 assert.deepEqual(fixtures[0].halfTime,{home:1,away:0});
 const future=fixtures.find(x=>x.id==='fd-pd-1002');
 assert.equal(future.status,'NS');
 assert.deepEqual(future.goals,{home:null,away:null});
});
test('108A incomplete, wrong league, duplicate and foreign teams are rejected',()=>{
 const wrong=dataset();wrong.matches.pop();
 assert.throws(()=>LaLiga.parseSeason(wrong,2026,now),/onvolledige/);
 const other=dataset();other.competition.code='PL';
 assert.throws(()=>LaLiga.parseSeason(other,2026,now),/verkeerde/);
 const dup=dataset();dup.matches[1].id=dup.matches[0].id;
 assert.throws(()=>LaLiga.parseSeason(dup,2026,now),/wedstrijdregistratie/);
 const bad=dataset();bad.matches[0].homeTeam.name='Onjuiste identiteit';
 assert.throws(()=>LaLiga.parseSeason(bad,2026,now),/teamidentiteit/);
 const score=dataset();score.matches[0].status='FINISHED';score.matches[0].utcDate='2026-11-20T18:00:00Z';
 assert.throws(()=>LaLiga.parseSeason(score,2026,now),/eindstand/);
});
test('108A only La Liga uses verified free API backup on OpenLigaDB failure',async()=>{
 let calls=[],payload=dataset();
 let s=Football.create({clock:()=>now,resultsToken:'private-fd-token',
  fetcher:async(url,options)=>{
   calls.push(String(url));
   if(String(url).includes('openligadb.de'))return Response.json([]);
   if(String(url).includes('football-data.org')){
    assert.equal(options.headers['X-Auth-Token'],'private-fd-token');
    return Response.json(payload);
   }
   throw Error('Unexpected URL');
  }});
 const result=await s.get('laliga');
 assert.equal(result.status,'available');
 assert.equal(result.fixtures.length,380);
 assert.equal(result.source,'Football-Data.org');
 assert.ok(result.sourceDetails.credit.includes('football-data.org'));
 assert.equal(calls.length,2);
 assert.equal((await s.get('laliga')).fixtures.length,380);
 assert.equal(calls.length,2);
});
test('108A never silently falls back with partial or unauthorized source',async()=>{
 let calls=0;const s=Football.create({clock:()=>now,resultsToken:'private',
  fetcher:async(url)=>{
   calls++;
   return String(url).includes('openligadb.de')?Response.json([]):Response.json({competition:{code:'PD'},season:{startDate:'2026-08-01'},matches:[]});
  }});
 const result=await s.get('laliga');
 assert.equal(result.status,'source_unavailable');
 assert.equal(result.fixtures.length,0);
 assert.equal(calls,2);
});
