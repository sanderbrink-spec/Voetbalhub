'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {inspect}=require('../sportmonks-entitlements126b');
const response=(data,extra={})=>new Response(JSON.stringify({data,...extra}));
test('detects features, endpoints, usage and live sample coverage without returning provider data',async()=>{
 const result=await inspect({token:'secret',fetcher:async(raw,opts)=>{
  const u=new URL(raw);assert.equal(u.hostname,'api.sportmonks.com');assert.equal(u.searchParams.has('api_token'),false); assert.equal(opts.headers.Authorization,'secret');
  if(u.pathname.endsWith('/my/enrichments'))return response([{name:'Access transfers'}]);
  if(u.pathname.endsWith('/my/resources'))return response([{description:'Latest Transfers'}]);
  if(u.pathname.endsWith('/my/usage'))return response([{entity:'fixture',count:3,remaining_requests:99}]);
  if(u.pathname.endsWith('/football/livescores'))return response([]);
  if(u.pathname.endsWith('/football/transfers/latest'))return response([{id:9,private:'secret'}]);
  return new Response('',{status:403});
 }});
 assert.equal(result.inventoryComplete,true);
 assert.equal(result.capabilities.transfers.status,'available');assert.equal(result.capabilities.transfers.listed,true);
 assert.equal(result.capabilities.liveScores.status,'empty');assert.equal(result.capabilities.players.status,'access_denied');
 assert.equal(result.usage[0].remaining,99);assert.ok(!JSON.stringify(result).includes('secret'));
});
test('429 stops every subsequent request and does not assert complete inventory',async()=>{
 let calls=0;const result=await inspect({token:'x',fetcher:async()=>{calls++;return new Response('',{status:429});}});
 assert.equal(calls,1);assert.equal(result.status,'partial');assert.equal(result.capabilities.transfers.status,'not_tested');
});
test('quota reserve stops additional calls',async()=>{
 let calls=0;const result=await inspect({token:'x',fetcher:async()=>{calls++;return response([{name:'Access transfers'}],{rate_limit:{requested_entity:'Resource',remaining:20}});}});
 assert.equal(calls,1);assert.equal(result.stop,'quota_reserve');
});
