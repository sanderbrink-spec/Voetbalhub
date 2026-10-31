'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),http=require('node:http');
const {validate,createContactHandler}=require('../contact-mail');
const env={RESEND_API_KEY:'test-only-key',CONTACT_FROM:'Veldio <contact@example.com>',CONTACT_PUBLIC_ORIGIN:'https://veldio.example'};
const valid=()=>({name:'Sander & Co',email:'test@example.com',subject:'Vraag é & <test>',topic:'Vraag over de app',message:'Dit is een geldig bericht.\nTweede regel met é & < >.',website:'',requestId:require('node:crypto').randomUUID()});
async function withServer(handler,run){const server=http.createServer(handler);await new Promise(r=>server.listen(0,'127.0.0.1',r));try{await run((body,headers={})=>fetch('http://127.0.0.1:'+server.address().port,{method:'POST',headers:{'Content-Type':'application/json',...headers},body:JSON.stringify(body)}));}finally{await new Promise(r=>server.close(r));}}
test('contact rejects missing fields, injection, honeypot, invalid email, lengths and unknown categories',()=>{
 assert.equal(validate(valid()).name,'Sander & Co');
 for(const [key,value] of Object.entries({email:'bad',name:'X\r\nBcc:x@y.nl',subject:'a'.repeat(141),message:'short',topic:'other',website:'bot',requestId:'bad'}))assert.throws(()=>validate({...valid(),[key]:value}));
 for(const key of ['name','email','subject','message','topic','website','requestId']){const data=valid();delete data[key];assert.throws(()=>validate(data));}
});
test('provider acceptance, reply-to, fixed recipient, preserved Unicode/newlines and simultaneous idempotency',async()=>{
 let calls=0,request;const handler=createContactHandler({env,fetchImpl:async(url,options)=>{calls++;request={url,...options};await new Promise(r=>setTimeout(r,30));return {ok:true,json:async()=>({id:'provider-confirmed'})};}});
 await withServer(handler,async post=>{const data=valid(),responses=await Promise.all([post(data),post(data),post(data)]);for(const r of responses){assert.equal(r.status,200);assert.equal((await r.json()).accepted,true);}assert.equal(calls,1);const payload=JSON.parse(request.body);assert.deepEqual(payload.to,['redactie.veldio@gmail.com']);assert.equal(payload.reply_to,data.email);assert.ok(payload.text.endsWith(data.message));assert.equal(request.headers['Idempotency-Key'],'veldio-contact-'+data.requestId);assert.equal((await post({...data,message:data.message+' extra'})).status,409);});
});
test('no false success when unconfigured, provider rejects, malformed acknowledgement or network fails',async()=>{
 for(const config of [{env:{}},{env,fetchImpl:async()=>({ok:false,json:async()=>({message:'secret error'})})},{env,fetchImpl:async()=>({ok:true,json:async()=>({})})},{env,fetchImpl:async()=>{throw Error('offline');}}])await withServer(createContactHandler(config),async post=>{const r=await post(valid()),body=await r.json();assert.ok(r.status>=500);assert.equal(body.accepted,undefined);assert.equal(body.message,'Verzenden is niet gelukt. Probeer het opnieuw.');});
});
test('rate limit and explicit origin rejection block abuse without trusting forged forwarding headers',async()=>{
 let count=0;const handler=createContactHandler({env,fetchImpl:async()=>{count++;return {ok:true,json:async()=>({id:'ok'})};}});
 await withServer(handler,async post=>{assert.equal((await post(valid(),{Origin:'https://evil.example'})).status,403);assert.equal((await post(valid(),{'Content-Type':'text/plain'})).status,415);for(let i=0;i<5;i++)assert.equal((await post(valid(),{Origin:env.CONTACT_PUBLIC_ORIGIN,'X-Forwarded-For':'1.1.1.'+i})).status,200);assert.equal((await post(valid())).status,429);assert.equal(count,5);});
});
test('failed request can retry with the same provider idempotency key',async()=>{
 const keys=[];const handler=createContactHandler({env,fetchImpl:async(u,o)=>{keys.push(o.headers['Idempotency-Key']);if(keys.length===1)throw Error('timeout');return {ok:true,json:async()=>({id:'ok'})};}});
 await withServer(handler,async post=>{const data=valid();assert.equal((await post(data)).status,502);assert.equal((await post(data)).status,200);assert.equal(keys[0],keys[1]);});
});
test('request body is byte limited',async()=>{await withServer(createContactHandler({env}),async post=>assert.equal((await post({...valid(),message:'é'.repeat(13000)})).status,413));});
test('Redis failure fails closed instead of bypassing rate limiting',async()=>{await withServer(createContactHandler({env,redis:{isReady:false}}),async post=>assert.equal((await post(valid())).status,503));});
test('Redis-backed retries retain provider key and accepted state',async t=>{
 if(!process.env.REDIS_TEST_URL)return t.skip('REDIS_TEST_URL required');
 const redis=require('redis').createClient({url:process.env.REDIS_TEST_URL});await redis.connect();let count=0;
 try{const prefix='test-contact:'+require('node:crypto').randomUUID()+':';const store={isReady:true,get:k=>redis.get(prefix+k),set:(k,v,o)=>redis.set(prefix+k,v,o),eval:(lua,o)=>redis.eval(lua,{...o,keys:o.keys.map(k=>prefix+k)})};const handler=createContactHandler({env,redis:store,fetchImpl:async()=>{count++;return {ok:true,json:async()=>({id:'accepted'})};}});await withServer(handler,async post=>{const d=valid();assert.equal((await post(d)).status,200);assert.equal((await post(d)).status,200);assert.equal(count,1);assert.equal((await post({...d,subject:'Different'})).status,409);});}finally{await redis.quit();}
});
test('UTF-8 characters split over incoming chunks remain intact',async()=>{
 let text='';const server=http.createServer(createContactHandler({env,fetchImpl:async(u,o)=>{text=JSON.parse(o.body).text;return {ok:true,json:async()=>({id:'ok'})};}}));await new Promise(r=>server.listen(0,'127.0.0.1',r));
 try{const data=valid();data.message='Een bericht met é en emoji ⚽ in meerdere regels.\nBedankt.';const bytes=Buffer.from(JSON.stringify(data));const status=await new Promise((resolve,reject)=>{const req=http.request({host:'127.0.0.1',port:server.address().port,method:'POST',headers:{'Content-Type':'application/json'}},r=>{r.resume();r.on('end',()=>resolve(r.statusCode));});req.on('error',reject);(async()=>{for(let i=0;i<bytes.length;i++){req.write(bytes.subarray(i,i+1));await new Promise(r=>setImmediate(r));}req.end();})();});assert.equal(status,200);assert.ok(text.endsWith(data.message));}finally{await new Promise(r=>server.close(r));}
});


test('configuration diagnostics expose missing keys without exposing credentials',()=>{
 const {contactConfiguration}=require('../contact-mail');
 assert.deepEqual(contactConfiguration({}).missing,['RESEND_API_KEY','CONTACT_FROM','CONTACT_PUBLIC_ORIGIN']);
 assert.equal(contactConfiguration(env).configured,true);
 assert.equal(JSON.stringify(contactConfiguration(env)).includes('test-only-key'),false);
 assert.equal(contactConfiguration({...env,CONTACT_FROM:'bad\r\nvalue'}).configured,false);
});
