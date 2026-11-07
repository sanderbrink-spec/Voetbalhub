'use strict';
// Controlled technical proof only: fictional fixture data, isolated Redis DB, no production writes or AI calls.
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {spawn}=require('node:child_process');
const http=require('node:http');
const path=require('node:path');
const {setTimeout:pause}=require('node:timers/promises');
test('controlled HTTP-to-Redis publication survives server restart and duplicate retry',{skip:!process.env.REDIS_TEST_URL,timeout:30000},async()=>{
 const redisUrl=new URL(process.env.REDIS_TEST_URL);redisUrl.pathname='/15';
 const client=require('redis').createClient({url:redisUrl.href});await client.connect();
 const probe=http.createServer();await new Promise(resolve=>probe.listen(0,'127.0.0.1',resolve));
 const port=probe.address().port;await new Promise(resolve=>probe.close(resolve));
 const base='http://127.0.0.1:'+port,secret='isolated-technical-editorial-chain-secret';
 let child,record,id;
 async function start(){
  child=spawn(process.execPath,[path.resolve('server.js')],{env:{...process.env,PORT:String(port),REDIS_URL:redisUrl.href,HUB_API_SECRET:secret,GROQ_API_KEY:'',OPENAI_API_KEY:'',FOOTBALL_DATA_API_KEY:'',FOOTBALL_DATA_TOKEN:''},stdio:'ignore'});
  for(let i=0;i<100;i++){
   if(child.exitCode!==null)throw Error('Isolated backend stopped during startup');
   try{const r=await fetch(base+'/ready');if(r.ok&&(await r.json()).ready)return;}catch{}
   await pause(50);
  }
  throw Error('Isolated backend did not become ready');
 }
 async function stop(){if(child&&child.exitCode===null){const stopped=new Promise(resolve=>child.once('exit',resolve));child.kill('SIGTERM');await stopped;}}
 async function request(endpoint,body){
  const response=await fetch(base+endpoint,{headers:{Authorization:'Bearer '+secret,'Content-Type':'application/json'},...(body?{method:'POST',body:JSON.stringify(body)}:{})});
  const result=await response.json();assert.equal(response.status,200,JSON.stringify(result));return result;
 }
 try{
  await start();
  const payload=structuredClone(require('./fixtures/editorial-chain.json'));payload.category='Technische test';
  record=(await request('/editorial-drafts',{payload,approve:true})).record;
  assert.equal(record.status,'approved');
  const submission={...payload,approved:true,editorialDraftId:record.id,expectedRevision:record.revision};
  const publication=await request('/publish',submission);assert.equal(publication.status,'published');id=publication.article.id;
  const duplicate=await request('/publish',submission);assert.equal(duplicate.article.id,id);
  const before=(await request('/articles')).articles.filter(article=>article.id===id);assert.equal(before.length,1);
  assert.deepEqual(before[0].body,payload.draft.body);
  assert.ok(await client.get('article:'+id));
  await stop();await start();
  const after=(await request('/articles')).articles.filter(article=>article.id===id);assert.equal(after.length,1);
  assert.deepEqual(after,before);
  const retried=await request('/publish',submission);assert.equal(retried.article.id,id);
  assert.equal((await request('/articles')).articles.filter(article=>article.id===id).length,1);
 }finally{
  await stop();
  if(id)await client.del('article:'+id);
  if(record)await client.del('editorial-draft:'+record.id);
  await client.quit();
 }
});
