'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {createRouter}=require('./editorial-provider-router');

const draft={headline:'Controleerbaar nieuws',standfirst:'Een gecontroleerde intro',body:['Een zelfstandige eerste alinea over het officiële bericht.','Een zelfstandige tweede alinea met vastgestelde feiten.','Een zelfstandige derde alinea over de gevolgen.']};
const fakeResponse={ok:true,status:200,headers:{get:()=>null},json:async()=>({choices:[{message:{content:JSON.stringify(draft)},finish_reason:'stop'}],usage:{total_tokens:100}})};

test('OpenAI is disabled without a secret and never makes a paid call',async()=>{
 let called=false;
 const router=createRouter({env:{GROQ_API_KEY:'groq-test'},fetcher:async()=>{called=true;return fakeResponse},intervalMs:0});
 const settings=router.configured();
 assert.equal(settings.find(p=>p.provider==='openai').enabled,false);
 assert.equal(settings.find(p=>p.provider==='groq').enabled,true);
 const result=await router.complete([{role:'user',content:'Write a draft'}],{task:'writing'});
 assert.equal(result.headline,draft.headline);
 assert.equal(called,true);
 assert.equal(router.trace[0].provider,'groq');
});

test('OpenAI key selects direct API, with strict JSON schema and bounded output',async()=>{
 const requests=[];
 const router=createRouter({env:{OPENAI_API_KEY:'secret-test'},fetcher:async(url,options)=>{requests.push({url,options});return fakeResponse},intervalMs:0});
 const result=await router.complete([{role:'user',content:'Write a draft'}],{task:'writing'});
 assert.equal(result.headline,draft.headline);
 assert.equal(requests.length,1);
 assert.equal(requests[0].url,'https://api.openai.com/v1/chat/completions');
 assert.equal(requests[0].options.headers.Authorization,'Bearer secret-test');
 const payload=JSON.parse(requests[0].options.body);
 assert.equal(payload.model,'gpt-4.1-mini');
 assert.equal(payload.response_format.type,'json_schema');
 assert.equal(payload.response_format.json_schema.schema.properties.body.type,'array');
 assert.ok(payload.max_completion_tokens<=3600);
 assert.ok(!('provider' in payload));
});

test('preferred Groq writer failure falls back to existing OpenAI without dropping task',async()=>{
 const calls=[];
 const router=createRouter({env:{OPENAI_API_KEY:'secret-test',GROQ_API_KEY:'groq-test'},fetcher:async(url)=>{calls.push(url);return calls.length===1?{ok:false,status:429,headers:{get:()=>null},json:async()=>({error:{message:'quota exceeded per day'}})}:fakeResponse;},intervalMs:0});
 const result=await router.complete([{role:'user',content:'Write a draft'}],{task:'writing'});
 assert.equal(result.headline,draft.headline);
 assert.equal(calls.length,2);
 assert.equal(router.trace[0].provider,'groq');
 assert.equal(router.trace[0].outcome,'daily_quota');
 assert.equal(router.trace[1].provider,'openai');
});
