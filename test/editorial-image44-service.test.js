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
test('exhausted provider credit opens a shared circuit instead of retrying for every article',async()=>{
 const values=new Map();let calls=0;
 const client={isReady:true,get:async k=>values.get(k)||null,set:async(k,v)=>values.set(k,v),eval:async()=>2};
 const fetcher=async()=>{calls++;return {ok:false,status:429,json:async()=>({error:{code:'credit_balance_exhausted'}})};};
 const first=await S.create(payload,{client,key:'test',fetcher});
 assert.match(first.reason,/credit_balance_exhausted/);
 const second=await S.create({...payload,draft:{...payload.draft,headline:'Ajax ander transfergerucht'}},{client,key:'test',fetcher});
 assert.equal(calls,1);assert.equal(second.attempts,0);assert.equal(second.mode,'neutral-fallback');
});

test('reviewed scarf photo is reused across preview/report text for the same verified fixture without a paid call',async()=>{
 const fixture={id:'licensed-match-1',home:{name:'FC Groningen'},away:{name:'Sparta Rotterdam'},date:'2026-11-06T19:00:00Z'},values=new Map();let generated=0;
 const client={isReady:true,get:async k=>values.get(k)||null,set:async(k,v)=>values.set(k,v)};
 const renderer=async p=>{generated++;const plan=I.classify(p),bytes=Buffer.from('mock image bytes, never published');return {plan,bytes,mode:'ai-photographic',assetSha256:I.sha(bytes),review:{relevant:true,coloursCorrect:true,highQuality:true,noLogos:true,noIdentifiablePeople:true,noMisleadingEvent:true,issues:[],twoScarves:true,namesOnScarves:true,texts:['FC Groningen','Sparta Rotterdam']}};};
 const first=await S.create({fixture,articleKind:'preview',draft:{headline:'Voorbeschouwing Groningen Sparta',body:[]}},{client,key:'',renderer});
 const second=await S.create({fixture,articleKind:'report',draft:{headline:'Nabeschouwing Groningen Sparta',body:[]}},{client,key:'',renderer});
 assert.equal(generated,1);assert.equal(second.reused,true);assert.equal(second.attempts,0);assert.equal(first.assetSha256,second.assetSha256);assert.notEqual(first.plan.identity,second.plan.identity);
});
