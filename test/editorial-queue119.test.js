'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {openQueue}=require('../editorial-production45');
const initial=Buffer.from(JSON.stringify({version:45,records:[],capacity:{}})).toString('base64');
const response=(status,body)=>({status,ok:status>=200&&status<300,json:async()=>body});
function mock(mode){
 let remote={sha:'old',content:initial},writes=0,reads=0;
 const fetcher=async(url,opts)=>{
  if(opts.method!=='PUT'){reads++;return response(200,remote);}
  writes++;
  const body=JSON.parse(opts.body);
  assert.equal(body.sha,remote.sha);
  if(writes===1){
   if(mode==='committed')remote={sha:'new',content:body.content};
   if(mode==='conflict')remote={sha:'other',content:Buffer.from('different').toString('base64')};
   if(mode==='timeout')throw Error('network');
   if(mode==='forbidden')return response(403,{});
   if(['committed','conflict','transient'].includes(mode))return response(500,{});
  }
  if(mode==='persistent')return response(503,{});
  remote={sha:'new'+writes,content:body.content};
  return response(200,{content:{sha:remote.sha}});
 };
 return {fetcher,get writes(){return writes},get reads(){return reads},get remote(){return remote}};
}
async function setup(mode){
 const api=mock(mode);
 const q=await openQueue({token:'test',branch:'editorial-media',fetcher:api.fetcher,delay:async()=>{}});
 q.queue.enqueue([{url:'https://example.org/test',text:'test'}]);
 return {api,q};
}
test('119 transient 500 retries unchanged lease and preserves jobs',async()=>{
 const {api,q}=await setup('transient');await q.save();
 assert.equal(api.writes,2);assert.equal(api.reads,2);
 assert.equal(JSON.parse(Buffer.from(api.remote.content,'base64')).records.length,1);
 await q.save();assert.equal(api.writes,3);
});
test('119 committed 500 reconciles without duplicate write',async()=>{
 const {api,q}=await setup('committed');await q.save();
 assert.equal(api.writes,1);assert.equal(api.reads,2);
 await q.save();assert.equal(api.writes,2);
});
test('119 concurrent checkpoint is never overwritten',async()=>{
 const {api,q}=await setup('conflict');
 await assert.rejects(q.save(),/gelijktijdig gewijzigd/);assert.equal(api.writes,1);
 assert.equal(api.remote.sha,'other');
});
test('119 transport recovery and permanent authorization rejection',async()=>{
 const a=await setup('timeout');await a.q.save();assert.equal(a.api.writes,2);
 const b=await setup('forbidden');await assert.rejects(b.q.save(),/HTTP 403/);
 assert.equal(b.api.writes,1);assert.equal(b.api.reads,1);
});
test('119 persistent failure bounded to three attempts',async()=>{
 const {api,q}=await setup('persistent');
 await assert.rejects(q.save(),/drie gecontroleerde pogingen/);
 assert.equal(api.writes,3);assert.equal(q.queue.records.length,1);
});
