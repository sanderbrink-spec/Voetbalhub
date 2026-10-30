const test=require('node:test');
const assert=require('node:assert/strict');
const {createEditorialDraft}=require('../editorial-ai');
const good={headline:'FC Groningen bespreekt plannen voor het komende seizoen',standfirst:'De club bespreekt nieuwe plannen met de betrokken medewerkers en neemt de uitkomsten mee in de voorbereiding op het komende seizoen.',body:[
'Op het trainingscomplex werkten spelers in kleine groepen aan verschillende oefeningen onder leiding van de technische staf terwijl de overige medewerkers hun taken voorbereidden.',
'Tijdens een apart overleg spraken vertegenwoordigers van de club met supporters over praktische onderwerpen rond de ontvangst van bezoekers en bereikbaarheid van het stadion.',
'Het bestuur zal de verschillende voorstellen tijdens een volgende vergadering bespreken voordat de verantwoordelijke afdelingen verdere afspraken over uitvoering en planning kunnen maken.'
]};
const input={topic:'Clubplannen',facts:['Feit een','Feit twee'],category:'Voetbal',sourceUrls:['https://fcgroningen.nl/nieuws']};
const config={apiKey:'test-secret-not-real',model:'test-model'};
const reply=d=>new Response(JSON.stringify({choices:[{message:{content:JSON.stringify(d)}}]}),{status:200,headers:{'Content-Type':'application/json'}});
test('draft generation sends only supplied facts with timeout signal and returns unpublished draft',async()=>{
 const d=await createEditorialDraft(input,{...config,fetcher:async(url,options)=>{
  assert.equal(url,'https://api.groq.com/openai/v1/chat/completions');assert.ok(options.signal instanceof AbortSignal);
  const body=JSON.parse(options.body);assert.equal(body.model,'test-model');assert.deepEqual(JSON.parse(body.messages[1].content).facts,input.facts);return reply(good);
 }});assert.deepEqual(d,good);assert.equal(d.status,undefined);
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
