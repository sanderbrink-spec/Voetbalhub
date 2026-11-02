'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os'),crypto=require('node:crypto');
const A=require('../autonomous-editor'),M=require('../editorial-methods'),R=require('../content-rights'),Q=require('../editorial-quality-model');
const p=()=>structuredClone(require('./fixtures/editorial-chain.json'));
function method(){return {id:'own-announcements',model:'test-model',allowedCategories:['Eredivisie'],permissions:Object.fromEntries(['fetch','store-evidence','ai-input','publish-derived','commercial','own-artwork'].map(k=>[k,true])),feeds:[{url:'https://facts-a.example/feed.json',ownerGroup:'independent-a',evidenceRef:'private:fictional-a'},{url:'https://facts-b.example/feed.json',ownerGroup:'independent-b',evidenceRef:'private:fictional-b'}]};}
function review(){return {approved:true,issues:[],scores:Object.fromEntries(Q.DIMENSIONS.map(k=>[k,9])),coverage:Array.from({length:5},()=>['f0','f1','f2','f3'])};}
function feeds(now){const fixture=p(),data={schemaVersion:1,events:[{eventId:'independent-event-1',kind:'announcement',title:fixture.draft.headline,category:'Eredivisie',publishedAt:new Date(now-60000).toISOString(),facts:fixture.verifiedFacts.map((text,i)=>({id:'f'+i,text}))}]};return [{data,sha256:'a'.repeat(64)},{data:structuredClone(data),sha256:'b'.repeat(64)}];}
async function using(run){const redis=require('redis').createClient({url:process.env.REDIS_TEST_URL});await redis.connect();const prefix='phase27:'+crypto.randomUUID()+':',client={isReady:true,get:k=>redis.get(prefix+k),set:(k,v,o)=>redis.set(prefix+k,v,o),del:k=>redis.del(prefix+k),keys:async k=>(await redis.keys(prefix+k)).map(k=>k.slice(prefix.length)),eval:(s,o)=>redis.eval(s,{...o,keys:o.keys.map(k=>prefix+k)})};const dir=fs.mkdtempSync(path.join(os.tmpdir(),'method-proof-')),file=path.join(dir,'rights.json'),now=Date.now(),m=method();const approval={scope:'production-method',contentHash:R.digest(M.descriptor(m)),status:'approved',evidenceRef:'private:fictional-test-only',basis:'Fictieve onafhankelijke testfeeds',reviewer:'Test fixture',reviewedAt:new Date(now-1000).toISOString(),validUntil:new Date(now+3600000).toISOString()};fs.writeFileSync(file,JSON.stringify({version:1,approvals:[approval]}));const rights=R.createRights({file,log:()=>{}}),secret='test-only-receipt-secret-'.repeat(3);let calls=0;
 const fetcher=async url=>{calls++;assert.ok(m.feeds.some(f=>f.url===url));return Response.json(feeds(now)[url===m.feeds[0].url?0:1].data);};
 const options={client,methods:[m],methodId:m.id,rights,secret,groqKey:'test-only',now,fetcher,generate:async()=>p().draft,review:async()=>review()};
 try{await run({client,options,m,rights,file,approval,now,secret,calls:()=>calls});}finally{const keys=await redis.keys(prefix+'*');if(keys.length)await redis.del(keys);await redis.quit();fs.rmSync(dir,{recursive:true,force:true});}}
test('quality score cannot replace hard evidence and coverage; below threshold or missing dimension blocks',()=>{
 const params={paragraphs:3,factIds:['f0','f1','f2','f3']};assert.equal(Q.assess(review(),params).approved,true);assert.equal(Q.assess(review(),{...params,hardIssues:['Rechten ontbreken.']}).approved,false);
 for(const changed of [{...review(),scores:{...review().scores,accuracy:7}},{...review(),coverage:[]},{...review(),approved:false},{...review(),scores:{}}])assert.equal(Q.assess(changed,params).approved,false);
});
test('facts require two independent licensed owners, current agreement and corroboration per fact',()=>{
 const now=Date.now(),m=method();assert.deepEqual(M.issues(m),[]);m.feeds[1].ownerGroup=m.feeds[0].ownerGroup;assert.ok(M.issues(m).length);
 const docs=feeds(now),candidate=A.selectEvents(docs,method(),now);assert.equal(candidate.length,1);
 docs[1].data.events[0].facts[0].text='Een andere niet overeenstemmende feitelijke tekst';assert.equal(A.selectEvents(docs,method(),now).length,0);
 docs[1]=feeds(now)[1];docs[1].data.events[0].publishedAt=new Date(now-2*86400000).toISOString();assert.equal(A.selectEvents(docs,method(),now).length,0);
});
test('no approved method means no source, model, rendering or storage action',async()=>{
 let touched=0;const result=await A.run({methodId:method().id,methods:[method()],rights:{decision:()=>({allowed:false})},fetcher:()=>{touched++;},client:{isReady:true,set(){touched++;}}});assert.equal(result.status,'blocked');assert.equal(touched,0);
});
test('autonomous real Redis chain: licensed fixture feeds, original text, real renderer, signed receipt, atomic publication, no duplicate generation and revocation',{skip:!process.env.REDIS_TEST_URL},()=>using(async({options,client,m,rights,file,approval,secret,now})=>{
 let generated=0;const settings={...options,generate:async()=>{generated++;return p().draft;}};const report=await A.run(settings);assert.equal(report.published.length,1,JSON.stringify(report));const article=JSON.parse(await client.get('article:'+report.published[0].id));assert.ok(await A.visible(client,article,{secret,methods:[m],rights,now}));assert.equal(article.autoPublish,true);assert.match(article.aiDisclosure,/AI/);
 const bytes=Buffer.from(await client.get('editorial:media:'+article.productionReceipt.mediaSha256),'base64');assert.equal(bytes.subarray(8,12).toString(),'WEBP');assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'),article.productionReceipt.mediaSha256);
 const repeated=await A.run(settings);assert.equal(repeated.published.length,0);assert.equal(generated,1);
 assert.equal(await A.visible(client,{...article,body:['Changed']},{secret,methods:[m],rights,now}),false);assert.equal(await A.visible(client,{...article,aiDisclosure:'Changed'},{secret,methods:[m],rights,now}),false);
 fs.writeFileSync(file,JSON.stringify({version:1,approvals:[{...approval,status:'revoked'}]}));assert.equal(await A.visible(client,article,{secret,methods:[m],rights,now}),false);
}));
test('negative model review retains needs_review and never renders or publishes',{skip:!process.env.REDIS_TEST_URL},()=>using(async({options,client})=>{
 let renders=0;const report=await A.run({...options,review:async()=>({...review(),approved:false,issues:['Feit niet onderbouwd']}),renderImage:()=>{renders++;}});assert.equal(report.published.length,0);assert.equal(renders,0);const drafts=await require('../editorial-drafts').listDrafts(client);assert.equal(drafts.length,1);assert.equal(drafts[0].status,'needs_review');assert.equal((await client.keys('article:*')).length,0);
}));
test('unreadable archive or failed duplicate-scan read holds the draft before image and publication',{skip:!process.env.REDIS_TEST_URL},async()=>{
 for(const failure of ['network','corrupt'])await using(async({options,client})=>{
  await client.set('article:existing',failure==='corrupt'?'invalid JSON':JSON.stringify({status:'published',headline:'Bestaand artikel'}));
  const read=client.get;client.get=async key=>{if(failure==='network'&&key==='article:existing')throw Error('Archive storage unavailable');return read(key);};
  let renders=0,generated=0;const report=await A.run({...options,generate:async()=>{generated++;return p().draft;},renderImage:()=>{renders++;throw Error('Unexpected render');}});
  assert.equal(report.published.length,0);assert.equal(renders,0);assert.equal(generated,0);assert.equal(report.held[0].stage,'facts');
  assert.match(report.held[0].reason,/Archive storage unavailable|duplicaatcontrole niet voltooid/);
  const drafts=await require('../editorial-drafts').listDrafts(client);assert.equal(drafts[0].status,'needs_review');
  assert.deepEqual(await client.keys('article:*'),['article:existing']);
 });
});
test('source outage is recorded, releases lock and performs no generation',{skip:!process.env.REDIS_TEST_URL},()=>using(async({options,client})=>{
 let generated=0;const report=await A.run({...options,fetcher:async()=>{throw Error('Source offline');},generate:()=>{generated++;}});assert.equal(report.status,'source_or_backend_failure');assert.equal(generated,0);assert.equal(await client.get('editorial:method-lock:'+options.methodId),null);
}));
test('publication failure is recovered from signed pending evidence without model or image regeneration',{skip:!process.env.REDIS_TEST_URL},()=>using(async({options,client})=>{
 const realEval=client.eval;let fail=true,generated=0,renders=0;
 client.eval=async(s,o)=>{if(fail&&s.includes("local existing=redis.call('GET',KEYS[1])")){fail=false;throw Error('Simulated write outage');}return realEval(s,o);};
 const settings={...options,generate:async()=>{generated++;return p().draft;},renderImage:payload=>{renders++;return A.render(payload);}};
 const first=await A.run(settings);assert.equal(first.published.length,0);assert.equal(first.held[0].stage,'publication');assert.equal((await require('../editorial-drafts').listDrafts(client))[0].status,'publication_failed');
 const second=await A.run(settings);assert.equal(second.recovered.length,1,JSON.stringify(second));assert.equal(generated,1);assert.equal(renders,1);assert.equal((await client.keys('article:*')).length,1);assert.equal((await client.keys('editorial:pending:*')).length,0);
}));
test('reusing an approval after a method/input change is blocked before fetch',{skip:!process.env.REDIS_TEST_URL},()=>using(async({options})=>{
 let calls=0;const changed=structuredClone(options.methods);changed[0].feeds[0].url='https://other-source.example/feed.json';const report=await A.run({...options,methods:changed,fetcher:()=>{calls++;}});assert.equal(report.status,'blocked');assert.equal(calls,0);
}));
test('a changed feed event ID with the same facts is rejected before another model call',{skip:!process.env.REDIS_TEST_URL},()=>using(async({options,client,now})=>{
 let generated=0,changed=false;const settings={...options,generate:async()=>{generated++;return p().draft;},fetcher:async()=>{const data=structuredClone(feeds(now)[0].data);if(changed)data.events[0].eventId='other-id-same-facts';return Response.json(data);}};
 assert.equal((await A.run(settings)).published.length,1);changed=true;const second=await A.run(settings);assert.equal(second.published.length,0);assert.equal(generated,1);assert.match(second.held[0].reason,/Dubbel/);assert.equal((await client.keys('article:*')).length,1);
}));

test('context text also requires factual coverage and unsupported context numbers never publish',{skip:!process.env.REDIS_TEST_URL},()=>using(async({options,client})=>{
 const params={paragraphs:3,factIds:['f0','f1','f2','f3'],context:true};
 assert.equal(Q.assess(review(),params).approved,false);
 assert.equal(Q.assess({...review(),coverage:[...review().coverage,['f0']]},params).approved,true);
 const result=await A.run({...options,generate:async()=>({...p().draft,why_it_matters:'De club heeft daarnaast 999 nieuwe medewerkers aangenomen.'})});
 assert.equal(result.published.length,0);assert.match(result.held[0].reason,/Cijfers ontbreken/);assert.equal((await client.keys('article:*')).length,0);
}));
