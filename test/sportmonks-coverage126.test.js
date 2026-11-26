'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {audit}=require('../sportmonks-coverage126');
const now=Date.parse('2026-11-26T08:00:00Z');
const response=(data,extra={})=>new Response(JSON.stringify({data,...extra}));
test('enumerates subscribed leagues, including previously unused leagues, and checks data presence',async()=>{
 const calls=[];
 const result=await audit({token:'test-secret',now,fetcher:async raw=>{
  const url=new URL(raw);calls.push(url.pathname);
  assert.equal(url.hostname,'api.sportmonks.com');
  if(url.pathname.endsWith('/my/leagues'))return response([{id:72,name:'Eredivisie',sport_id:1},{id:999,name:'Other competition',sport_id:1}]);
  assert.equal(url.searchParams.get('filters'),'fixtureLeagues:72,999');
  assert.match(url.searchParams.get('include'),/lineups/);
  return response([{id:12,league_id:72,state_id:5,statistics:[{}],events:[{}]},{id:13,league_id:999,state_id:1,lineups:[]}],{pagination:{has_more:false}});
 }});
 assert.equal(result.status,'complete');assert.equal(result.subscribed,2);assert.equal(result.configured,1);
 assert.equal(result.fixtures,2);assert.equal(result.leagues[0].coverage.statistics,1);assert.equal(result.leagues[1].windowComplete,true);
 assert.equal(calls.length,2);assert.ok(!JSON.stringify(result).includes('test-secret'));
});
test('halts on 429 without treating an unqueried competition as empty',async()=>{
 let count=0;
 const result=await audit({token:'x',now,fetcher:async()=>++count===1?response([{id:72,name:'Eredivisie'}]):new Response('',{status:429})});
 assert.equal(result.status,'partial');assert.equal(result.stop,'http_429');assert.equal(result.leagues[0].windowComplete,false);
});
test('rejects wrong league and does not count foreign fixture',async()=>{
 let count=0;
 const result=await audit({token:'x',now,fetcher:async()=>++count===1?response([{id:72,name:'Eredivisie'}]):response([{id:12,league_id:999}],{pagination:{has_more:false}})});
 assert.equal(result.status,'partial');assert.equal(result.fixtures,0);assert.equal(result.errors[0].reason,'invalid_fixture_page');
});
test('honors remaining quota and stops before another request',async()=>{
 let count=0;
 const result=await audit({token:'x',now,fetcher:async()=>{count++;return response([{id:72,name:'Eredivisie'}],{rate_limit:{requested_entity:'leagues',remaining:20}});}});
 assert.equal(count,1);assert.equal(result.stop,'quota_reserve');
});

test('126C all five paid competitions are configured, including an empty play-offs window',async()=>{
 const ids=[8,72,74,78,1353];
 let calls=0;
 const result=await audit({token:'x',now,fetcher:async raw=>{
  calls++;
  const u=new URL(raw);
  if(u.pathname.endsWith('/my/leagues'))return response(ids.map(id=>({id,name:'League '+id,sport_id:1})));
  assert.equal(u.searchParams.get('filters'),'fixtureLeagues:'+ids.join(','));
  return response([],{pagination:{has_more:false}});
 }});
 assert.equal(result.status,'complete');
 assert.equal(result.subscribed,5);assert.equal(result.configured,5);
 assert.ok(result.leagues.every(l=>l.configured&&l.windowComplete&&l.fixtures===0));
 assert.equal(calls,2);
});
