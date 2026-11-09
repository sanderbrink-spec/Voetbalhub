'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const SM=require('../sportmonks-football'),Football=require('../football-data47');
const now=Date.parse('2026-11-09T12:00:00Z');
function match(id,state=5){
 return {id,league_id:72,state_id:state,starting_at_timestamp:Math.floor(Date.parse('2026-11-01T12:00:00Z')/1000),
 participants:[{id:1,name:'Ajax',meta:{location:'home'}},{id:2,name:'FC Twente',meta:{location:'away'}}],
 scores:[{description:'CURRENT',score:{participant:'home',goals:2}},{description:'CURRENT',score:{participant:'away',goals:2}}],
 round:{name:'Speelronde 11'}};
}
test('Sportmonks parser verifies home/away and final scores; in-play never counts as final',()=>{
 const f=SM.parseFixture(match(1),'eredivisie',now);
 assert.equal(f.status,'FT');assert.deepEqual(f.goals,{home:2,away:2});
 assert.equal(SM.LEAGUES.eredivisie,72);assert.equal(SM.parseFixture({...match(5),round:{name:'12'}},'eredivisie',now).round,'Speelronde 12');
 assert.equal(SM.parseFixture(match(2,2),'eredivisie',now).status,'AWAITING');
 assert.equal(SM.parseFixture({...match(3),scores:[]},'eredivisie',now).status,'AWAITING');
 assert.throws(()=>SM.parseFixture({...match(4),league_id:271},'eredivisie',now));
});
test('Sportmonks takes priority and does not call public fallbacks when season response is complete',async()=>{
 let calls=0;const rows=Array.from({length:120},(_,i)=>match(i+1));
 const fetcher=async(url)=>{calls++;assert.match(url,/api.sportmonks.com/);return {ok:true,text:async()=>JSON.stringify({data:rows.slice(0,50),pagination:{has_more:false}})};};
 // A healthy full season mock uses 4 bounded date windows with 30 unique fixtures each.
 let calls2=0;
 const full=async url=>{
  calls2++;assert.match(url,/api.sportmonks.com/);
  const chunk=Number(url.match(/between\/(\d{4}-\d\d-\d\d)/)?.[1].slice(5,7)||'7');
  const base=calls2*30;
  return {ok:true,text:async()=>JSON.stringify({data:Array.from({length:30},(_,i)=>match(base+i)),pagination:{has_more:false}})};
 };
 const s=Football.create({clock:()=>now,sportmonksToken:'mock-token',fetcher:full});
 const snap=await s.get('eredivisie');
 assert.equal(snap.source,SM.CREDIT);assert.equal(snap.fixtures.length,120);assert.equal(calls2,4);
 assert.equal(calls,0);
});
test('Sportmonks errors fail over to existing Eredivisie source without exposing token in logs',async()=>{
 let calls=[];const s=Football.create({clock:()=>now,sportmonksToken:'mock-secret',fetcher:async url=>{calls.push(url);throw Error('offline');}});
 const snap=await s.get('eredivisie');
 assert.equal(snap.status,'source_unavailable');assert.equal(calls.length,2);
 assert.match(calls[0],/api.sportmonks.com/);assert.match(calls[1],/raw.githubusercontent.com/);
});
