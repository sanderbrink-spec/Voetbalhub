'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {pacedGroq}=require('../scripts/automatic-publication');
const {dailyQuota}=require('../groq-quota');
const endpoint='https://api.groq.com/openai/v1/chat/completions';
const limited=message=>new Response(JSON.stringify({error:{message}}),{status:429,headers:{'retry-after':'0'}});
test('daily quota preserves only a bounded retry-after delay',async()=>{
 const fetcher=pacedGroq(async()=>new Response(JSON.stringify({error:{message:'tokens per day exhausted private detail'}}),{status:429,headers:{'retry-after':'7200'}}),0);
 await assert.rejects(fetcher(endpoint,{}),error=>error.code==='GROQ_DAILY_QUOTA'&&error.retryAfterSeconds===7200&&!error.message.includes('private'));
});

test('daily provider exhaustion stops further model calls without blocking other services or exposing provider details',async()=>{
 for(const message of ['Rate limit reached on tokens per day (TPD). gsk_private-test','Rate limit reached on requests per day (RPD).','Daily token quota exhausted']){
  let modelCalls=0,otherCalls=0;
  const fetcher=pacedGroq(async url=>{if(url===endpoint){modelCalls++;return limited(message);}otherCalls++;return new Response('{}');},0);
  for(let n=0;n<3;n++)await assert.rejects(fetcher(endpoint,{}),e=>e.code==='GROQ_DAILY_QUOTA'&&!e.message.includes('gsk_'));
  assert.equal(modelCalls,1);assert.equal((await fetcher('https://example.com/snapshot',{})).status,200);assert.equal(otherCalls,1);
 }
});
test('minute limits still retry, malformed error bodies stay generic, and a new run may try again',async()=>{
 let calls=0;const fetcher=pacedGroq(async()=>++calls===1?limited('Tokens per minute exceeded'):new Response('{}'),0);
 assert.equal((await fetcher(endpoint,{})).status,200);assert.equal(calls,2);
 const response=limited('daily quota exhausted');assert.equal(await dailyQuota(response),true);assert.ok((await response.json()).error);
 assert.equal(await dailyQuota(new Response('invalid',{status:429})),false);
 assert.equal((await pacedGroq(async()=>new Response('{}'),0)(endpoint,{})).status,200);
});
test('an aborted provider request never starts a network call',async()=>{
 let calls=0;const fetcher=pacedGroq(async()=>{calls++;return new Response('{}');},0);
 await assert.rejects(fetcher(endpoint,{signal:AbortSignal.abort()}),e=>e.name==='AbortError');assert.equal(calls,0);
});
test('draft generation preserves the quota stop signal for the publication report',async()=>{
 const {createEditorialDraft}=require('../editorial-ai');
 const fetcher=pacedGroq(async()=>limited('tokens per day (TPD) exhausted'),0);
 await assert.rejects(createEditorialDraft({topic:'Gecontroleerde clubplannen',category:'Voetbal',facts:['De club bespreekt nieuwe plannen.','De bijeenkomst vond maandag plaats.'],sourceUrls:['https://fcgroningen.nl/nieuws']},{apiKey:'test-only',model:'test-only',fetcher}),e=>e.code==='GROQ_DAILY_QUOTA');
});
