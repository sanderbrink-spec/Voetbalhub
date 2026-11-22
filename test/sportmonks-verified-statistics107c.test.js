'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const SM=require('../sportmonks-football');
const Match=require('../editorial-match55');
const now=Date.parse('2026-11-22T18:00:00Z');
function fixture(){
 return {
  id:98765,league_id:72,state_id:5,
  starting_at_timestamp:Math.floor(Date.parse('2026-11-21T19:00:00Z')/1000),
  participants:[{id:1,name:'Ajax',meta:{location:'home'}},{id:2,name:'FC Groningen',meta:{location:'away'}}],
  scores:[
   {description:'CURRENT',score:{participant:'home',goals:2}},
   {description:'CURRENT',score:{participant:'away',goals:2}},
   {description:'1ST_HALF',score:{participant:'home',goals:1}},
   {description:'1ST_HALF',score:{participant:'away',goals:1}}
  ],
  round:{name:'Speelronde 13'},
  statistics:[
   {fixture_id:98765,participant_id:1,type_id:42,data:{value:12}},
   {fixture_id:98765,participant_id:2,type_id:42,data:{value:10}},
   {fixture_id:98765,participant_id:1,type_id:86,data:{value:5}},
   {fixture_id:98765,participant_id:2,type_id:86,data:{value:4}},
   {fixture_id:98765,participant_id:1,type_id:34,data:{value:6}},
   {fixture_id:98765,participant_id:2,type_id:34,data:{value:3}},
   {fixture_id:98765,participant_id:1,type_id:45,data:{value:'55'}},
   {fixture_id:98765,participant_id:2,type_id:45,data:{value:'45'}}
  ]
 };
}
test('107C: provider-bound completed match adds four independent team-stat claims',()=>{
 const f=SM.parseFixture(fixture(),'eredivisie',now);
 assert.deepEqual(f.verifiedStats,{
  corners:{home:6,away:3},shots:{home:12,away:10},
  possession:{home:55,away:45},shotsOnTarget:{home:5,away:4}
 });
 const c=Match.candidate(f,now);
 assert.ok(c);
 assert.ok(c.verifiedFacts.some(x=>x.includes('Ajax 12')&&x.includes('FC Groningen 10')&&x.includes('schoten')));
 assert.ok(c.verifiedFacts.some(x=>x.includes('Ajax 5')&&x.includes('FC Groningen 4')&&x.includes('schoten op doel')));
 assert.ok(c.verifiedFacts.some(x=>x.includes('55%')&&x.includes('45%')&&x.includes('balbezit')));
 assert.ok(c.verifiedFacts.some(x=>x.includes('Ajax 6')&&x.includes('FC Groningen 3')&&x.includes('hoekschoppen')));
});
test('107C: impossible or mixed statistics never become publishable facts',()=>{
 const a=fixture();
 a.statistics=a.statistics.filter(x=>x.type_id!==45);
 a.statistics.push(
  {fixture_id:98765,participant_id:1,type_id:45,data:{value:75}},
  {fixture_id:98765,participant_id:2,type_id:45,data:{value:45}},
  {fixture_id:98765,participant_id:1,type_id:86,data:{value:999}},
  {fixture_id:98765,participant_id:2,type_id:86,data:{value:20}}
 );
 const stats=SM.parseFixture(a,'eredivisie',now).verifiedStats;
 assert.equal(stats?.possession,undefined);
 assert.equal(stats?.shotsOnTarget,undefined);
 assert.ok(stats?.shots);
 const b=fixture();
 b.statistics.push({fixture_id:98765,participant_id:1,type_id:34,data:{value:7}});
 assert.equal(SM.parseFixture(b,'eredivisie',now).verifiedStats.corners,undefined);
 const c=fixture();
 c.statistics=c.statistics.map(x=>({...x,fixture_id:999}));
 assert.equal(SM.parseFixture(c,'eredivisie',now).verifiedStats,undefined);
 const notFinal=SM.parseFixture({...fixture(),state_id:2},'eredivisie',now);
 assert.equal(notFinal.verifiedStats,undefined);
});
test('107C: rich stats use the same bounded recent-fixture API request',async()=>{
 let calls=0;
 const result=await SM.loadRecent({
  competition:'eredivisie',token:'fake-secret',now,
  sourceBody:async response=>JSON.stringify(response.data),
  fetcher:async url=>{
   calls++;
   assert.match(url,/api\\.sportmonks\\.com/);
   const includes=new URL(url).searchParams.get('include').split(';');
   assert.ok(includes.includes('statistics'));
   assert.ok(includes.includes('events'));
   return {ok:true,data:{data:[fixture()],pagination:{has_more:false}}};
  }
 });
 assert.equal(calls,1);
 assert.equal(result.length,1);
 assert.equal(result[0].verifiedStats.shots.home,12);
});
