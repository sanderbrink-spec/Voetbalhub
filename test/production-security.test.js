"use strict";
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),http=require('node:http'),vm=require('node:vm'),{createRequire}=require('node:module');
const R=require('../content-rights'),S=require('../production-security');
test('rights bind exact article, sources and images; missing, expired, revoked or malformed evidence fails closed',()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'veldio-rights-')),file=path.join(dir,'rights.json'),now=Date.now(),events=[];
 const article={headline:'Fictief nieuws',author:'Test',body:['Eigen observaties'],sources:[{url:'https://example.com/bron'}],imageUrl:'https://example.com/eigen.webp',imageReview:{aiDisclosureVerified:true,reviewedAt:'dynamic'}};
 const rights=R.createRights({file,now:()=>now,log:e=>events.push(e)}),approval={scope:'publication',contentHash:R.digest(R.articleContent(article)),status:'approved',evidenceRef:'private:test-evidence',basis:'Eigen fictief testmateriaal',reviewer:'Fictieve tester',reviewedAt:new Date(now-1000).toISOString(),validUntil:new Date(now+60000).toISOString()};
 try{
  assert.equal(rights.decision('publication',article).allowed,false);
  fs.writeFileSync(file,JSON.stringify({version:1,approvals:[approval]}));assert.equal(rights.decision('publication',article).allowed,true);
  assert.equal(rights.decision('publication',{...article,imageReview:{...article.imageReview,reviewedAt:'other'}}).allowed,true);
  for(const altered of [{...article,body:['Gewijzigd']},{...article,sources:[{url:'https://other.example/'}]},{...article,imageUrl:'https://other.example/b.webp'}])assert.equal(rights.decision('publication',altered).allowed,false);
  for(const override of [{status:'revoked'},{validUntil:new Date(now-1).toISOString()},{evidenceRef:''},{reviewer:''},{reviewedAt:new Date(now+1).toISOString()}]){fs.writeFileSync(file,JSON.stringify({version:1,approvals:[{...approval,...override}]}));assert.equal(rights.decision('publication',article).allowed,false);}
  fs.writeFileSync(file,'bad JSON');assert.equal(rights.decision('publication',article).allowed,false);
  assert.ok(events.every(e=>!JSON.stringify(e).includes('Eigen observaties')));
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
});
test('authentication fails closed; origin matching rejects wildcard/null and lookalikes; limiter is bounded and expires',()=>{
 assert.equal(S.authorized('Bearer abc','abc'),true);for(const h of ['',null,'Bearer ab','Basic abc','Bearer abc '])assert.equal(S.authorized(h,'abc'),false);assert.equal(S.authorized('Bearer ',' '),false);
 assert.equal(S.authorized('Bearer ',' '),false);
 for(const origin of ['null','https://evil.example','https://good.example.evil','*'])assert.equal(S.originAllowed(origin,'https://good.example'),false);
 assert.equal(S.originAllowed('https://good.example','https://other.example, https://good.example'),true);
 let now=0;const limit=S.createLimiter({now:()=>now,maxKeys:1});assert.equal(limit('a',2),true);assert.equal(limit('a',2),true);assert.equal(limit('a',2),false);assert.equal(limit('b'),false);now=60001;assert.equal(limit('b'),true);
});
async function withApi(run,rightsModule=null){
 const root=path.join(__dirname,'..'),file=path.join(root,'server.js'),real=createRequire(file);const store=new Map();let aiCalls=0;
 const client={isReady:true,on(){},get:async k=>store.get(k)||null,keys:async()=>[...store.keys()]};
 const ctx={require:id=>id==='./content-rights'&&rightsModule?rightsModule:id==='redis'?{createClient:()=>client}:real(id),process:{env:{REDIS_URL:'test://isolated',HUB_API_SECRET:'test-secret',GROQ_API_KEY:'test-key'}},URL,Buffer,console,fetch:()=>{aiCalls++;throw Error('Unexpected network');},__dirname:root,module:{exports:{}}};
 vm.runInNewContext(fs.readFileSync(file,'utf8').replace(/start\(\);\s*$/,'module.exports={handle};'),ctx);
 const server=http.createServer((q,r)=>ctx.module.exports.handle(q,r).catch(()=>{r.writeHead(500);r.end();}));await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const api=(url,body,auth=true)=>fetch('http://127.0.0.1:'+server.address().port+url,{headers:{'Content-Type':'application/json',...(auth?{Authorization:'Bearer test-secret'}:{})},...(body!==undefined?{method:'POST',body:JSON.stringify(body)}:{})});
 try{await run({api,store,client,base:'http://127.0.0.1:'+server.address().port,aiCalls:()=>aiCalls});}finally{server.closeAllConnections();await new Promise(r=>server.close(r));}
}
test('public feed keeps the newest cleared article beyond the first 200 Redis keys',()=>withApi(async({api,store})=>{
 for(let i=0;i<205;i++)store.set('article:'+i,JSON.stringify({id:String(i),status:'published',headline:'Fictieve testpublicatie '+i,body:['Uitsluitend een geïsoleerde testfixture.'],publishedAt:new Date(Date.UTC(2026,0,1,0,i)).toISOString()}));
 const response=await api('/articles');assert.equal(response.status,200);const data=await response.json();assert.equal(data.articles.length,200);assert.equal(data.articles[0].id,'204');assert.equal(data.articles.at(-1).id,'5');
}, {decision:()=>({allowed:true,validUntil:new Date(Date.now()+60000).toISOString()})}));
test('archive limit and storage read failure never become a successful partial public feed',()=>withApi(async({api,store,client})=>{
 for(let i=0;i<2001;i++)store.set('article:'+i,'{}');
 assert.equal((await api('/articles')).status,503);
 store.clear();store.set('article:failed','{}');client.get=async()=>{throw Error('Connection lost');};
 const response=await api('/articles');assert.equal(response.status,503);assert.match((await response.json()).error,/tijdelijk niet beschikbaar/);
}));
test('revocation and evidence storage outages never return a partial or empty successful feed',async()=>{
 for(const failPrefix of ['editorial:revoked:','editorial:evidence:'])await withApi(async({api,store,client})=>{
  const first={id:'first',status:'published',headline:'Eerste fictieve publicatie',body:['Alleen testmateriaal.'],publishedAt:'2026-01-02T00:00:00Z'};
  const second={...first,id:'second',headline:'Tweede fictieve publicatie',publishedAt:'2026-01-01T00:00:00Z',productionReceipt:{evidenceHash:'fixture'}};
  store.set('article:first',JSON.stringify(first));store.set('article:second',JSON.stringify(second));
  const read=client.get;let revocationReads=0;
  client.get=async key=>{
   if(key.startsWith('editorial:revoked:')&&++revocationReads===2&&failPrefix==='editorial:revoked:')throw Error('Revocation storage lost');
   if(key.startsWith(failPrefix)&&failPrefix==='editorial:evidence:')throw Error('Evidence storage lost');
   return read(key);
  };
  const response=await api('/articles');assert.equal(response.status,503);
  assert.equal((await response.json()).articles,undefined);
 },{decision:(scope,article)=>({allowed:article.id==='first',validUntil:new Date(Date.now()+60000).toISOString()})});
});
test('real production defaults protect unpublished generated images, block AI before network, reject primitive JSON and suppress unapproved legacy feed',()=>withApi(async({api,store,aiCalls})=>{
 assert.equal((await api('/generated-image/11111111-1111-4111-8111-111111111111',undefined,false)).status,401);
 for(const body of [null,[],42,'text'])assert.equal((await api('/draft',body)).status,400);
 const draft=await api('/draft',{topic:'Fictief onderwerp',facts:['Feit een','Feit twee'],sourceUrls:['https://example.com/bron']});assert.equal(draft.status,403);assert.equal(aiCalls(),0);
 for(const endpoint of ['/integrations/statistics','/integrations/videos'])assert.equal((await api(endpoint)).status,403);
 assert.equal(aiCalls(),0);
 assert.equal((await api('/generate-article-image',{approvedGeneration:true})).status,403);
 store.set('article:old',JSON.stringify({status:'published',headline:'Onbevestigd',body:['Niet vrijgegeven'],imageRights:'cleared'}));
 const feed=await api('/articles');assert.equal(feed.status,200);assert.equal((await feed.json()).articles.length,0);
 assert.equal((await api('/brand/fixture-image?source=https://raw.githubusercontent.com/sanderbrink-spec/Voetbalhub/editorial-media/test.webp')).status,403);
 const health=await api('/health');assert.equal(health.headers.get('x-content-type-options'),'nosniff');assert.equal((await health.json()).launchPolicyVersion,28);
}));
test('forged publisher/image checkboxes cannot authorize real publication route',()=>withApi(async({api})=>{
 const p=structuredClone(require('./fixtures/editorial-chain.json'));p.approved=true;
 const response=await api('/publish',p);assert.equal(response.status,403);assert.match((await response.json()).error,/rechtenbewijs/);
}));
test('production contact requires shared abuse storage before provider request',async()=>{
 let calls=0;const handler=require('../contact-mail').createContactHandler({env:{NODE_ENV:'production',CONTACT_PRIVACY_READY:'1',RESEND_API_KEY:'test-key',CONTACT_FROM:'test@example.com'},fetchImpl:()=>{calls++;}});
 const server=http.createServer(handler);await new Promise(r=>server.listen(0,'127.0.0.1',r));try{const response=await fetch('http://127.0.0.1:'+server.address().port,{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'});assert.equal(response.status,503);assert.equal(calls,0);}finally{server.closeAllConnections();await new Promise(r=>server.close(r));}
});

test('public feed accepts exact evidenced content and rejects modified or revoked content through the real registry',async()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'veldio-feed-')),file=path.join(dir,'rights.json'),now=Date.now();
 const article={id:'test-article',status:'published',author:'Veldio Redactie',headline:'Fictief gecontroleerd artikel',body:['Fictieve eigen tekst'],imageRights:'not_needed'};
 const approval={scope:'publication',contentHash:R.digest(R.articleContent(article)),status:'approved',basis:'Eigen fictieve testtekst',evidenceRef:'private:fixture-proof',reviewer:'Test',reviewedAt:new Date(now-1000).toISOString(),validUntil:new Date(now+60000).toISOString()};
 fs.writeFileSync(file,JSON.stringify({version:1,approvals:[approval]}));
 try{await withApi(async({api,store})=>{
  store.set('article:test',JSON.stringify(article));let response=await api('/articles'),data=await response.json();assert.equal(data.articles.length,1);assert.equal(data.rightsPolicyVersion,26);assert.ok(data.rightsExpiresAt<=Date.parse(approval.validUntil));
  store.set('article:test',JSON.stringify({...article,body:['Gewijzigd zonder herbeoordeling']}));assert.equal((await(await api('/articles')).json()).articles.length,0);
  store.set('article:test',JSON.stringify(article));fs.writeFileSync(file,JSON.stringify({version:1,approvals:[{...approval,status:'revoked'}]}));assert.equal((await(await api('/articles')).json()).articles.length,0);
 },R.createRights({file}));}finally{fs.rmSync(dir,{recursive:true,force:true});}
});
test('large and non-JSON authenticated requests fail explicitly; failed authentication is limited even with forged proxy headers',()=>withApi(async({api,base})=>{
 const nonJson=await fetch(base+'/draft',{method:'POST',headers:{Authorization:'Bearer test-secret','Content-Type':'text/plain'},body:'{}'});assert.equal(nonJson.status,415);
 const large=await api('/draft',{text:'x'.repeat(1000001)});assert.equal(large.status,413);
 for(let i=0;i<20;i++)assert.equal((await api('/inbox',undefined,false)).status,401);
 assert.equal((await api('/inbox',undefined,false)).status,429);
}));
