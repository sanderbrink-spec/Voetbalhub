'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {EditorialProviderRouter,createRouter,MODELS,retryDelay,sealCheckpoint,openCheckpoint}=require('../editorial-provider-router');
const {EditorialQueue,assess}=require('../editorial-production45');
const {generationIssues,createEditorialDraft}=require('../editorial-ai');
const {complete,duplicate}=require('../scripts/automatic-publication');
const messages=[{role:'system',content:'Geef uitsluitend gecontroleerde JSON.'},{role:'user',content:JSON.stringify({verifiedFacts:['Ajax bevestigt het besluit.'],sources:['https://ajax.nl/artikelen/test']})}];
const draft={headline:'Ajax bevestigt nieuwe afspraken voor de komende wedstrijd',standfirst:'Volgens Ajax gelden nieuwe afspraken voor bezoekers bij de komende wedstrijd.',body:['De club heeft de afspraken voor bezoekers bekendgemaakt via de eigen officiële website.']};
const scores={actuality:95,reliability:95,nationalValue:90,originality:90,journalism:90,diversity:90};
const review={approved:true,issues:[],scores};
const json=x=>new Response(JSON.stringify(x),{status:200});
const response=x=>json({choices:[{message:{content:JSON.stringify(x)}}],usage:{total_tokens:100}});
const quota=(message='tokens per day (TPD) exhausted',delay='120')=>new Response(JSON.stringify({error:{message}}),{status:429,headers:{'retry-after':delay}});
const catalog=(pricing={prompt:'0',completion:'0'})=>json({data:[{id:MODELS.openrouter,pricing}]});
const options={groqKey:'private-groq',openrouterKey:'private-openrouter',intervalMs:0};
function mock(callback){return async(url,opts)=>url.endsWith('/models')?catalog():callback(url,opts);}
test('primary writer uses GPT-OSS 120B and preserves exact verified facts',async()=>{
 let calls=0;const router=new EditorialProviderRouter({...options,fetcher:mock(async(url,opt)=>{calls++;assert.match(url,/groq/);assert.deepEqual(JSON.parse(opt.body).messages,messages);return response(draft);})});
 assert.deepEqual(await router.complete(messages,{task:'writing'}),draft);assert.equal(calls,1);assert.equal(router.lastWriter.model,MODELS.groq);
});
test('daily Groq quota switches only this task to verified zero-price OpenRouter with identical evidence',async()=>{
 let groq=0,backup=0;const router=new EditorialProviderRouter({...options,fetcher:mock(async(url,opt)=>{const body=JSON.parse(opt.body);assert.deepEqual(body.messages,messages);if(url.includes('groq')){groq++;return quota();}backup++;assert.equal(body.model,MODELS.openrouter);assert.deepEqual(body.provider.max_price,{prompt:0,completion:0});assert.equal(body.provider.allow_fallbacks,false);return response(draft);})});
 assert.deepEqual(await complete(messages,{router},'writing'),draft);await router.complete(messages,{task:'revision'});assert.equal(groq,1);assert.equal(backup,2);assert.equal(router.trace[0].outcome,'daily_quota');
});
test('no backup keeps the job retryable without consuming editorial attempts or recalling blocked Groq',async()=>{
 let calls=0;const router=new EditorialProviderRouter({groqKey:'private',intervalMs:0,fetcher:async()=>{calls++;return quota();}});
 const queue=new EditorialQueue(),job=queue.enqueue([{url:'https://ajax.nl/a',text:'Verified source'}],0);
 for(let i=0;i<2;i++)try{await router.complete(messages);}catch(error){assert.equal(error.code,'EDITORIAL_AI_UNAVAILABLE');assert.ok(!JSON.stringify(error).includes('private'));queue.fail(job,error,0,{stage:'generation'});}
 assert.equal(calls,1);assert.equal(job.status,'retry');assert.equal(job.attempts,0);assert.equal(job.nextAttemptAt,120000);
});
test('both providers limited persist independent cooldowns and avoid repeated network requests',async()=>{
 let calls=0;const state={};const router=new EditorialProviderRouter({...options,state,fetcher:mock(async()=>{calls++;return quota();})});
 await assert.rejects(router.complete(messages),{code:'EDITORIAL_AI_UNAVAILABLE'});await assert.rejects(router.complete(messages),{code:'EDITORIAL_AI_UNAVAILABLE'});assert.equal(calls,2);assert.ok(state.groq.blockedUntil>0&&state.openrouter.blockedUntil>0);
});
test('invalid fallback JSON never becomes an approved result',async()=>{
 const router=new EditorialProviderRouter({...options,fetcher:mock(async url=>url.includes('groq')?quota():json({choices:[{message:{content:'not json'}}]}))});
 await assert.rejects(router.complete(messages,{task:'writing'}),{code:'EDITORIAL_AI_UNAVAILABLE'});assert.equal(router.trace[1].outcome,'invalid_json');
});
test('English fallback copy is rejected by unchanged Dutch language gate',async()=>{
 const english={headline:'The club will announce the new plans for the season',standfirst:'The club has confirmed that the plans will be discussed with the staff and the players.',body:['The club and the staff will discuss the plans for the season with their players and their supporters.']};
 const router=new EditorialProviderRouter({...options,fetcher:mock(async url=>url.includes('groq')?quota():response(english))});
 const value=await router.complete(messages,{task:'writing'});assert.ok(generationIssues(value,[],null,true).some(x=>/Nederland/i.test(x)));
});
test('independent reviewer prefers a different provider and family, with original source evidence',async()=>{
 const calls=[];const router=new EditorialProviderRouter({...options,geminiKey:'gemini-private',geminiFreeTierConfirmed:true,fetcher:mock(async(url,opt)=>{calls.push(url);if(url.includes('googleapis')){const b=JSON.parse(opt.body);assert.equal(b.generationConfig.responseMimeType,'application/json');assert.equal(b.contents[0].parts[0].text,messages[1].content);return json({candidates:[{content:{parts:[{text:JSON.stringify(review)}]}}]});}return response(draft);})});
 await router.complete(messages,{task:'writing'});assert.deepEqual(await router.complete(messages,{task:'review'}),review);assert.match(calls[0],/groq/);assert.match(calls[1],/googleapis/);assert.equal(router.trace[1].family,'gemini');
});
test('an independent factual rejection stays rejected and thresholds remain unchanged',async()=>{
 const router=new EditorialProviderRouter({...options,fetcher:mock(async()=>response({...review,approved:false,issues:['Verzonnen doelpuntenmaker.'],scores:{...scores,reliability:30}}))});
 const value=await router.complete(messages,{task:'review'});assert.equal(value.approved,false);
 const verdict=assess({review:value,docs:[{publishedAt:new Date().toISOString()}]});assert.equal(verdict.approved,false);
 for(const [field,score] of [['journalism',84],['reliability',89]])assert.equal(assess({review:{...review,scores:{...scores,[field]:score}},docs:[{publishedAt:new Date().toISOString()}]}).approved,false);
});
test('revision retains exact evidence and successful revision provenance',async()=>{
 const router=new EditorialProviderRouter({...options,fetcher:mock(async(_,opt)=>{assert.deepEqual(JSON.parse(opt.body).messages,messages);return response(draft);})});
 assert.deepEqual(await router.complete(messages,{task:'revision'}),draft);assert.equal(router.lastWriter.provider,'groq');
});
test('persisted quota state resumes only after Retry-After and the queue becomes due',async()=>{
 let now=0,calls=0;const state={},fetcher=async()=>++calls===1?quota():response({facts:[]});
 let router=new EditorialProviderRouter({groqKey:'x',state,fetcher,now:()=>now,intervalMs:0});
 const queue=new EditorialQueue(),job=queue.enqueue([{url:'https://ajax.nl/a',text:'Verified source'}],now);
 try{await router.complete(messages);}catch(error){queue.fail(job,error,now);}
 now=119999;router=new EditorialProviderRouter({groqKey:'x',state,fetcher,now:()=>now,intervalMs:0});await assert.rejects(router.complete(messages));assert.equal(queue.due(job,now),false);assert.equal(calls,1);
 now=120001;assert.equal(queue.due(job,now),true);assert.deepEqual(await router.complete(messages),{facts:[]});assert.equal(calls,2);
});
test('duplicate prevention is unchanged before publication',()=>{
 assert.equal(duplicate({draft,sources:[{url:'https://ajax.nl/artikelen/test'}]},[{...draft,sources:[{url:'https://ajax.nl/artikelen/test'}]}]),true);
});
test('paid, unknown-price, removed or automatic OpenRouter models never receive generation',async()=>{
 for(const pricing of [{prompt:'0.01',completion:'0'},{prompt:'0'},null,{prompt:'0',completion:'0',request:'1'},{prompt:null,completion:null},{prompt:'',completion:''}]){
  let calls=0;const router=new EditorialProviderRouter({openrouterKey:'private',intervalMs:0,fetcher:async url=>{if(url.endsWith('/models'))return catalog(pricing);calls++;return response(draft);}});
  await assert.rejects(router.complete(messages));assert.equal(calls,0);
 }
});
test('Gemini requires confirmed free-tier project even when OpenAI is independently supported',async()=>{
 const router=createRouter({env:{GEMINI_API_KEY:'private'},fetcher:()=>{throw Error('unexpected network');}});
 assert.equal(router.configured().some(p=>p.enabled),false);await assert.rejects(router.complete(messages));
});
test('capacity reserves requests and tokens for review without weakening quality',async()=>{
 const router=new EditorialProviderRouter({groqKey:'x',intervalMs:0,limits:{groq:{requests:3,tokens:40000}},fetcher:async()=>response(review)});
 await router.complete(messages);await assert.rejects(router.complete(messages));assert.deepEqual(await router.complete(messages,{task:'review'}),review);assert.equal(router.state.groq.requests,2);
});
test('timeouts, authentication and minute quotas fail over once without secret disclosure',async()=>{
 for(const mode of ['timeout','authentication','minute']){
  const router=new EditorialProviderRouter({...options,fetcher:mock(async url=>{if(!url.includes('groq'))return response(draft);if(mode==='timeout')throw new DOMException('private-key','TimeoutError');if(mode==='authentication')return new Response('private-key',{status:401});return quota('tokens per minute','30');})});
  assert.deepEqual(await router.complete(messages,{task:'writing'}),draft);assert.ok(!JSON.stringify(router.trace).includes('private-key'));assert.equal(router.trace.length,2);
 }
});
test('Retry-After dates are respected and cannot be shortened to a fixed ceiling',()=>{
 assert.equal(retryDelay('120',0),120000);assert.equal(retryDelay('Thu, 01 Jan 1970 00:02:00 GMT',0),120000);assert.equal(retryDelay(null,0),0);assert.equal(retryDelay('172800',0),172800000);
});
test('encrypted checkpoints retain facts and revision budget, reject tampering and wrong job or secret',()=>{
 const value={facts:['Verified secret source extract'],draft,revisions:2},secret='test-checkpoint-secret';const encrypted=sealCheckpoint(value,secret,'job1');
 assert.deepEqual(openCheckpoint(encrypted,secret,'job1'),value);assert.ok(!JSON.stringify(encrypted).includes(value.facts[0]));assert.equal(openCheckpoint(encrypted,secret,'job2'),null);assert.equal(openCheckpoint(encrypted,'wrong','job1'),null);assert.equal(openCheckpoint({...encrypted,data:'invalid'},secret,'job1'),null);
});
test('malformed reviewer scores cannot become approval and source metadata never enters logs',async()=>{
 const router=new EditorialProviderRouter({...options,fetcher:mock(async()=>response({approved:true,scores:{reliability:100}}))});await assert.rejects(router.complete(messages,{task:'review'}));assert.ok(router.trace.every(t=>t.outcome==='invalid_json'));assert.ok(!JSON.stringify(router.trace).includes('verifiedFacts'));
});
test('draft generation through the router preserves all existing preflight rejections',async()=>{
 const router=new EditorialProviderRouter({...options,fetcher:mock(async()=>response({...draft,body:['te kort']}))});
 await assert.rejects(createEditorialDraft({topic:'Ajax clubbesluit',category:'Voetbal',facts:['Ajax bevestigt het besluit.','De club meldde dit zondag.'],sourceUrls:['https://ajax.nl/artikelen/test'],compact:true,automaticPublication:true},{apiKey:'x',model:MODELS.groq,router,timeoutMs:1000}),e=>e.status===502);assert.equal(router.trace.length,2);
});
test('invalid JSON remains a bounded response failure, never a day-quota classification',async()=>{
 const router=new EditorialProviderRouter({groqKey:'x',intervalMs:0,fetcher:async()=>json({choices:[{message:{content:'not-json'}}]})});
 const queue=new EditorialQueue(),job=queue.enqueue([{url:'https://ajax.nl/a',text:'Evidence'}],0);
 for(let i=0;i<4;i++)try{await router.complete(messages);}catch(error){assert.equal(error.availabilityCategory,'invalid_response');queue.fail(job,error,0);}
 assert.equal(job.failureCategory,'provider_invalid_response');assert.equal(job.reason,'invalid_provider_json');assert.equal(job.attempts,4);assert.equal(job.status,'review');
 assert.deepEqual(router.trace[0].outputShape,{parseableObject:false});
});
test('terminal and expired queue entries discard encrypted working copies',()=>{
 const queue=new EditorialQueue(),job=queue.enqueue([{url:'https://ajax.nl/a',text:'Evidence'}],0);job.checkpoint={data:'opaque'};queue.finish(job,'published',1);assert.equal(job.checkpoint,undefined);
 job.status='retry';job.checkpoint={data:'opaque'};queue.prune(86400002);assert.equal(job.checkpoint,undefined);
});
test('a quota during internal draft repair resumes that repair without a new first-writer call',async()=>{
 const input={topic:'Ajax clubbesluit',category:'Voetbal',facts:[draft.headline,draft.standfirst,...draft.body],sourceUrls:['https://ajax.nl/artikelen/test'],compact:true,automaticPublication:true};
 let calls=0,saved;
 const router=new EditorialProviderRouter({groqKey:'x',intervalMs:0,fetcher:async()=>++calls===1?response({...draft,body:['te kort']}):quota()});
 await assert.rejects(createEditorialDraft(input,{apiKey:'x',model:MODELS.groq,router,onProgress:value=>{saved=structuredClone(value);}}),{code:'EDITORIAL_AI_UNAVAILABLE'});
 assert.equal(calls,2);assert.equal(saved.attempt,1);assert.equal(saved.messages[2].role,'assistant');assert.ok(saved.messages[2].content.includes('te kort'));
 let resumedCalls=0;const restored=new EditorialProviderRouter({groqKey:'x',intervalMs:0,fetcher:async(_,opt)=>{resumedCalls++;assert.deepEqual(JSON.parse(opt.body).messages,saved.messages);return response(draft);}});
 const result=await createEditorialDraft(input,{apiKey:'x',model:MODELS.groq,router:restored,resume:saved});
 assert.equal(resumedCalls,1);assert.equal(restored.trace[0].task,'revision');assert.deepEqual(result.body,draft.body);assert.equal(result.qualityReview.attempts,2);assert.equal(result.qualityReview.autoPublish,false);
});


test('OpenAI and Groq writer require a typed paragraph array in strict JSON schema',async()=>{
 const calls=[];
 const router=new EditorialProviderRouter({openaiKey:'test-openai',groqKey:'test-groq',intervalMs:0,fetcher:async(url,opt)=>{
  const req=JSON.parse(opt.body);calls.push({url,format:req.response_format});
  return response({...draft,skip:false});
 }});
 const result=await router.complete(messages,{task:'writing'});
 assert.deepEqual(result,{...draft,skip:false});
 assert.equal(calls.length,1);
 assert.match(calls[0].url,/openai.com/);
 const format=calls[0].format;
 assert.equal(format.type,'json_schema');
 assert.equal(format.json_schema.strict,true);
 assert.equal(format.json_schema.schema.properties.body.type,'array');
 assert.deepEqual(format.json_schema.schema.required,['skip','headline','standfirst','body']);
 const fallback=new EditorialProviderRouter({groqKey:'test-groq',intervalMs:0,fetcher:async(_,opt)=>{
  const schema=JSON.parse(opt.body).response_format;
  assert.equal(schema.type,'json_schema');
  assert.equal(schema.json_schema.schema.properties.body.type,'array');
  return response({...draft,skip:false});
 }});
 assert.equal((await fallback.complete(messages,{task:'writing'})).body.length,1);
});
test('typed schema never converts invalid body strings into approved articles',async()=>{
 const router=new EditorialProviderRouter({openaiKey:'test-openai',groqKey:'test-groq',intervalMs:0,fetcher:async()=>response({...draft,body:'One paragraph is not an array',skip:false})});
 await assert.rejects(router.complete(messages,{task:'writing'}),{code:'EDITORIAL_AI_UNAVAILABLE'});
 assert.deepEqual(router.trace.map(t=>t.outcome),['invalid_json','invalid_json']);
});


test('revision API enforces the same strict paragraph array as writing on OpenAI and Groq',async()=>{
 for(const env of [{openaiKey:'secret-openai'},{groqKey:'secret-groq'}]){
  const router=new EditorialProviderRouter({...env,intervalMs:0,fetcher:async(url,opt)=>{
   const body=JSON.parse(opt.body);
   assert.equal(body.response_format.type,'json_schema');
   assert.equal(body.response_format.json_schema.strict,true);
   assert.equal(body.response_format.json_schema.schema.properties.body.type,'array');
   return response({...draft,skip:false});
  }});
  assert.equal((await router.complete(messages,{task:'revision'})).body.length,1);
 }
});
test('revisions still reject malformed body strings and never auto-approve copy',async()=>{
 const router=new EditorialProviderRouter({openaiKey:'x',groqKey:'x',intervalMs:0,fetcher:async()=>response({...draft,body:'invalid'} )});
 await assert.rejects(router.complete(messages,{task:'revision'}),{code:'EDITORIAL_AI_UNAVAILABLE'});
 assert.deepEqual(router.trace.map(t=>t.outcome),['invalid_json','invalid_json']);
});
