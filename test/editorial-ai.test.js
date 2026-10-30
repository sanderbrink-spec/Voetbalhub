const test=require('node:test');
const assert=require('node:assert/strict');
const {createEditorialDraft}=require('../editorial-ai');
const good={headline:'FC Groningen bespreekt plannen voor het komende seizoen',standfirst:'De club bespreekt nieuwe plannen met de betrokken medewerkers en neemt de uitkomsten mee in de voorbereiding op het komende seizoen.',body:[
'Op het trainingscomplex werkten spelers in kleine groepen aan verschillende oefeningen onder leiding van de technische staf terwijl de overige medewerkers hun taken voorbereidden.',
'Tijdens een apart overleg spraken vertegenwoordigers van de club met supporters over praktische onderwerpen rond de ontvangst van bezoekers en bereikbaarheid van het stadion.',
'Het bestuur zal de verschillende voorstellen tijdens een volgende vergadering bespreken voordat de verantwoordelijke afdelingen verdere afspraken over uitvoering en planning kunnen maken.'
]};
const input={topic:'Clubplannen',facts:[good.headline,good.standfirst,...good.body],category:'Voetbal',sourceUrls:['https://fcgroningen.nl/nieuws']};
const config={apiKey:'test-secret-not-real',model:'test-model'};
const reply=d=>new Response(JSON.stringify({choices:[{message:{content:JSON.stringify(d)}}]}),{status:200,headers:{'Content-Type':'application/json'}});
test('draft generation sends only supplied facts with timeout signal and returns unpublished draft',async()=>{
 const d=await createEditorialDraft(input,{...config,fetcher:async(url,options)=>{
  assert.equal(url,'https://api.groq.com/openai/v1/chat/completions');assert.ok(options.signal instanceof AbortSignal);
  const body=JSON.parse(options.body);assert.equal(body.model,'test-model');assert.deepEqual(JSON.parse(body.messages[1].content).facts,input.facts);return reply(good);
 }});assert.deepEqual(d.body,good.body);assert.equal(d.headline,good.headline);assert.equal(d.qualityReview.attempts,1);assert.equal(d.qualityReview.autoPublish,false);assert.equal(d.status,undefined);
});
test('rate limit remains 429 with bounded retry guidance and no provider-secret disclosure',async()=>{
 await assert.rejects(createEditorialDraft(input,{...config,fetcher:async()=>new Response('private provider body',{status:429,headers:{'retry-after':'120'}})}),e=>e.status===429&&e.retryAfter===120&&!e.message.includes('private'));
});
test('temporary provider failures use safe errors and never leak API-key-bearing errors',async()=>{
 await assert.rejects(createEditorialDraft(input,{...config,fetcher:async()=>{throw Error(config.apiKey);}}),e=>e.status===502&&!e.message.includes(config.apiKey));
});
test('AI request is aborted when its deadline expires',async()=>{
 const keepAlive=setTimeout(()=>{},1000);
 try{await assert.rejects(createEditorialDraft(input,{...config,timeoutMs:5,fetcher:async(_,options)=>new Promise((resolve,reject)=>{options.signal.addEventListener('abort',()=>reject(options.signal.reason),{once:true});})}),e=>e.status===504);}finally{clearTimeout(keepAlive);}
});
test('insufficient facts response is distinct from outage and malformed output',async()=>{
 await assert.rejects(createEditorialDraft(input,{...config,fetcher:async()=>reply({skip:true,reason:'Weinig informatie'})}),e=>e.status===422);
 await assert.rejects(createEditorialDraft(input,{...config,fetcher:async()=>new Response('not-json',{status:200})}),e=>e.status===502);
});
test('incomplete or contradictory generated copy never passes',async()=>{
 for(const draft of [{...good,body:['te kort']},{...good,headline:'FC Twente wint en speelt gelijk tegen AZ'}]){
  await assert.rejects(createEditorialDraft(input,{...config,fetcher:async()=>reply(draft)}),e=>e.status===502);
 }
});
test('a rejected first draft gets one targeted repair using exactly the same fact packet',async()=>{
 let calls=0;
 const result=await createEditorialDraft(input,{...config,fetcher:async(_,options)=>{
  calls++;const payload=JSON.parse(options.body);
  assert.deepEqual(JSON.parse(payload.messages[1].content).facts,input.facts);
  if(calls===1)return reply({...good,body:['Te kort.']});
  assert.match(payload.messages.at(-1).content,/Herstel uitsluitend/);
  assert.match(payload.messages.at(-1).content,/18 tot 120 woorden/);
  return reply(good);
 }});
 assert.equal(calls,2);assert.equal(result.qualityReview.revisionApplied,true);assert.equal(result.qualityReview.autoPublish,false);
});
test('repetition is detected before generation succeeds and repaired before final review',async()=>{
 let calls=0;
 const result=await createEditorialDraft(input,{...config,fetcher:async()=>++calls===1?reply({...good,body:[good.body[0],good.body[0],good.body[2]]}):reply(good)});
 assert.equal(calls,2);assert.equal(result.qualityReview.automatedTextChecksPassed,true);
 assert.deepEqual(require('../editorial-desk-model').draftIssues(result),[]);
});
test('new numbers cause a targeted repair instead of being accepted as supplied facts',async()=>{
 let calls=0;
 await createEditorialDraft(input,{...config,fetcher:async(_,options)=>{
  if(++calls===1)return reply({...good,headline:'FC Groningen bespreekt 27 plannen voor het nieuwe seizoen'});
  assert.match(JSON.parse(options.body).messages.at(-1).content,/Cijfers ontbreken in de gecontroleerde feiten: 27/);
  return reply(good);
 }});assert.equal(calls,2);
});
test('valid fenced JSON and paragraph strings are normalized without unnecessary regeneration',async()=>{
 let calls=0;
 const value={...good,body:good.body.join('\n\n')};
 const result=await createEditorialDraft(input,{...config,fetcher:async()=>{
  calls++;return new Response(JSON.stringify({choices:[{message:{content:'```json\n'+JSON.stringify(value)+'\n```'}}]}),{status:200});
 }});assert.equal(calls,1);assert.deepEqual(result.body,good.body);
});
test('persistent failures stop after exactly one repair with actionable quality feedback',async()=>{
 let calls=0;
 await assert.rejects(createEditorialDraft(input,{...config,fetcher:async()=>{calls++;return reply({...good,body:['Nog te kort.']});}}),e=>e.status===502&&e.issues.some(x=>x.includes('3 tot 5')));
 assert.equal(calls,2);
});
test('provider limits and insufficient facts do not trigger a repair or extra AI call',async()=>{
 for(const response of [()=>new Response('',{status:429}),()=>reply({skip:true})]){
  let calls=0;
  await assert.rejects(createEditorialDraft(input,{...config,fetcher:async()=>{calls++;return response();}}));assert.equal(calls,1);
 }
});
