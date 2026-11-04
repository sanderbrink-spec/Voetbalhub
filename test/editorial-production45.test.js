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
