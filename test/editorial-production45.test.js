'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {assess,priority,EditorialQueue,openQueue,WEIGHTS}=require('../editorial-production45');
const now=Date.parse('2026-11-04T12:00:00Z');
const docs=[{url:'https://ajax.nl/a',title:'Ajax bevestigt transfer',text:'Officiële bevestiging',publishedAt:'2026-11-04T10:00:00Z'}];
const review={approved:true,issues:[],scores:Object.fromEntries(Object.keys(WEIGHTS).map(k=>[k,95]))};
test('balanced editorial assessment passes only with evidence, current dates and a complete second review',()=>{
 assert.equal(assess({review,docs,now}).approved,true);
 for(const change of [{evidenceIssues:['Ontbrekend bronbewijs']},{duplicate:true},{copied:true},{docs:[{...docs[0],publishedAt:''}]},{review:{...review,scores:{...review.scores,reliability:89}}},{review:{...review,scores:{...review.scores,originality:101}}},{review:{...review,approved:false}},{review:{...review,issues:undefined}},{review:{...review,scores:{...review.scores,journalism:60}}}]){
  assert.equal(assess({review,docs,now,...change}).approved,false,JSON.stringify(change));
 }
});
test('future publication dates and weak nationally relevant reporting cannot pass through a high average',()=>{
 assert.equal(assess({review,now,docs:[{...docs[0],publishedAt:'2026-11-05T12:00:00Z'}]}).approved,false);
 assert.equal(assess({review:{...review,scores:{...review.scores,nationalValue:65}},now,docs}).approved,false);
 assert.equal(assess({review:{...review,scores:Object.fromEntries(Object.keys(WEIGHTS).map(k=>[k,k==='reliability'?90:80]))},now,docs}).approved,false);
});
test('big three take precedence, Groningen joins Twente and AZ, routine KKD coverage is excluded',()=>{
 assert.ok(priority({title:'PSV bevestigt transfer'})>priority({title:'FC Groningen bevestigt transfer'}));
 assert.equal(priority({title:'FC Groningen bevestigt transfer'}),priority({title:'FC Twente bevestigt transfer'}));
 assert.equal(priority({title:'AZ bevestigt transfer'}),4);
 assert.equal(priority({title:'KKD wedstrijdprogramma'}),0);
 assert.equal(priority({title:'KKD club verliest licentie'}),1);
});
test('queue survives serialization and retries an outage with exponential delays before requesting review',()=>{
 let queue=new EditorialQueue(),job=queue.enqueue(docs,now);
 assert.equal(queue.enqueue(docs,now),job);
 queue.fail(job,Error('Bron HTTP 503'),now);
 assert.equal(queue.due(job,now),false);
 queue=new EditorialQueue(JSON.parse(JSON.stringify(queue.records)));job=queue.records[0];
 assert.equal(queue.due(job,now+3600000),true);
 queue.fail(job,Error('fetch failed'),now+3600000);
 assert.equal(job.nextAttemptAt,now+3*3600000);
 queue.fail(job,Error('HTTP 429'),now+3*3600000);
 queue.fail(job,Error('HTTP 503'),now+7*3600000);
 assert.equal(job.status,'review');assert.equal(queue.due(job,now+86400000),false);
 assert.ok(!JSON.stringify(job).includes(docs[0].text));
 const updated=queue.enqueue([{...docs[0],text:'Nieuwe broninformatie'}],now);
 assert.notEqual(updated.id,job.id);
});
test('editorial failures never retry as outages; completed work is not rescheduled',()=>{
 const q=new EditorialQueue(),job=q.enqueue(docs,now);
 q.fail(job,Error('Verzonnen citaat'),now);assert.equal(job.status,'review');
 q.finish(job,'published',now);assert.equal(q.due(job,now+86400000),false);
 q.prune(now+8*86400000);assert.equal(q.records.length,0);
});
test('persistent queue refuses unreadable state and rejected checkpoints',async()=>{
 await assert.rejects(openQueue({token:'test',branch:'editorial-media',fetcher:async()=>new Response('',{status:503})}),/niet beschikbaar/);
 const durable=await openQueue({token:'test',branch:'editorial-media',fetcher:async(url,o)=>new Response('',{status:o.method==='PUT'?409:404})});
 durable.queue.enqueue(docs,now);
 await assert.rejects(durable.save(),/niet opgeslagen/);
});
test('persistent queue uses a SHA lease and updates it after every checkpoint',async()=>{
 const writes=[];let n=0;
 const durable=await openQueue({token:'test',branch:'editorial-media',fetcher:async(url,o)=>{
  if(o.method!=='PUT')return Response.json({sha:'old',content:Buffer.from(JSON.stringify({records:[]})).toString('base64')});
  writes.push(JSON.parse(o.body));return Response.json({content:{sha:'new'+(++n)}});
 }});
 durable.queue.enqueue(docs,now);await durable.save();await durable.save();
 assert.equal(writes[0].sha,'old');assert.equal(writes[1].sha,'new1');
 assert.equal(writes[0].branch,'editorial-media');
});

test('an undated official fixture calendar can support a verified upcoming preview',()=>{
 const calendar=[{...docs[0],publishedAt:''}];
 assert.equal(assess({review,docs:calendar,now,eventDate:'2026-11-08'}).approved,true);
 assert.equal(assess({review,docs:calendar,now,eventDate:'2026-11-03'}).approved,false);
 assert.equal(assess({review,docs:calendar,now,eventDate:'2026-11-15'}).approved,false);
});


test('a configured threshold below 85 never lowers the quality floor',()=>{
 const low={...review,scores:Object.fromEntries(Object.keys(WEIGHTS).map(k=>[k,k==='reliability'?90:80]))};
 const result=assess({review:low,docs,now,threshold:1});
 assert.equal(result.threshold,85);assert.equal(result.approved,false);
});
test('queue distinguishes software, storage, publication and journalistic failures without leaking raw errors',()=>{
 for(const [stage,error,category] of [
  ['quality',new TypeError('secret source text'),'quality_control_failure'],
  ['generation',new SyntaxError('invalid JSON'),'generator_failure'],
  ['storage',Error('write rejected'),'storage_failure'],
  ['publication',Error('version missing'),'publication_failure'],
  ['quality',Error('Unverified claim'),'journalistic_rejection']
 ]){
  const q=new EditorialQueue(),job=q.enqueue(docs,now);q.fail(job,error,now,{stage});
  const restored=new EditorialQueue(JSON.parse(JSON.stringify(q.records))).records[0];
  assert.equal(restored.failureCategory,category);assert.equal(restored.failureStage,stage);
  assert.match(restored.errorHash,/^[a-f0-9]{64}$/);assert.ok(!JSON.stringify(restored).includes(error.message));
  assert.equal(q.due(job,now+86400000),false);
 }
});

test('quoted temporary source wording in quality rejection is not a transport outage',()=>{
 const q=new EditorialQueue(),job=q.enqueue([{url:'https://peczwolle.nl/nieuws/aanstelling',text:'officieel'}],now);
 q.fail(job,new Error('Kwaliteitscontrole na 2 herschrijvingen: Woordelijke bronoverlap: assistenten die tijdelijk de leiding hadden.'),now,{stage:'quality'});
 assert.equal(job.status,'review');
 assert.equal(job.failureStage,'quality');
 assert.equal(job.failureCategory,'journalistic_rejection');
 assert.equal(job.reason,'editorial_review_required');
 const actualProvider=q.enqueue([{url:'https://ajax.nl/artikelen/ander',text:'officieel'}],now);
 q.fail(actualProvider,new Error('Redactionele AI tijdelijk niet beschikbaar: HTTP 429'),now,{stage:'quality'});
 assert.equal(actualProvider.status,'retry');
 assert.equal(actualProvider.failureCategory,'temporary_source_failure');
});

test('V98 provider HTTP 400 is a permanent request failure even when legacy wording says temporarily unavailable',()=>{
 const {EditorialQueue}=require('../editorial-production45');
 const now=Date.parse('2026-11-08T12:00:00Z'),queue=new EditorialQueue();
 const job=queue.enqueue([{url:'https://peczwolle.nl/nieuws/verified-appointment',text:'Verified official facts'}],now);
 const err=new Error('Redactionele AI tijdelijk niet beschikbaar: HTTP 400');err.code='GROQ_BAD_REQUEST';
 queue.fail(job,err,now,{stage:'quality'});
 assert.equal(job.status,'review');
 assert.equal(job.failureCategory,'journalistic_rejection');
 assert.equal(job.reason,'editorial_review_required');
});
