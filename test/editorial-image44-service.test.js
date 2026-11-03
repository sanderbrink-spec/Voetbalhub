'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const S=require('../editorial-image44-service'),I=require('../editorial-image44');
const payload={draft:{headline:'Ajax transfergerucht',standfirst:'Onbevestigd nieuws.',body:[]},topicTeams:['Ajax']};
test('Render provider without a key returns a transparent neutral fallback, with zero paid attempts',async()=>{
 const r=await S.create(payload,{key:'',fetcher:()=>{throw Error('Unexpected network');}});
 assert.equal(r.mode,'neutral-fallback');assert.equal(r.attempts,0);assert.equal(I.sha(Buffer.from(r.base64,'base64')),r.assetSha256);
});
test('Render reserves a shared Amsterdam daily budget atomically and never spends without storage',async()=>{
 await assert.rejects(S.create(payload,{key:'test'}),/Beeldopslag/);
 let reservations=0;
 const client={isReady:true,get:async()=>null,eval:async(script,options)=>{reservations++;assert.match(script,/n\+a>20/);assert.deepEqual(options.keys,['editorial-image44-budget:2026-11-04']);return 0;}};
 const r=await S.create(payload,{key:'test',client,now:Date.parse('2026-11-03T23:30:00Z'),fetcher:()=>{throw Error('Daily limit exceeded');}});
 assert.equal(reservations,1);assert.equal(r.mode,'neutral-fallback');assert.equal(r.attempts,0);
});
test('remote image validation rejects altered bytes and mismatched article identities',async()=>{
 const r=await S.create(payload,{key:''});
 const accepted=await S.remote(payload,{secret:'test',fetcher:async()=>({ok:true,json:async()=>r})});assert.equal(accepted.assetSha256,r.assetSha256);
 for(const patch of [{base64:Buffer.from('altered').toString('base64')},{plan:{identity:'other-article'}}])await assert.rejects(S.remote(payload,{secret:'test',fetcher:async()=>({ok:true,json:async()=>({...r,...patch})})}),/beeld|Beeld/);
});
