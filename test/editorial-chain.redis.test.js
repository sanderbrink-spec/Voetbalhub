'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),http=require('node:http'),vm=require('node:vm'),crypto=require('node:crypto'),{createRequire}=require('node:module');
const A=require('../scripts/automatic-publication'),D=require('../editorial-drafts');
const payload=()=>structuredClone(require('./fixtures/editorial-chain.json'));
function media(){
 const images=new Map();let puts=0;
 return {images,get puts(){return puts;},fetch:async(url,options={})=>{
  const u=new URL(url);
  if(u.hostname==='api.github.com'){
   if(u.pathname.includes('/git/ref/'))return Response.json({object:{sha:'test-base'}});
   const name=u.pathname.split('/').at(-1);
   if(options.method==='PUT'){images.set(name,Buffer.from(JSON.parse(options.body).content,'base64'));puts++;return Response.json({content:{path:name}},{status:201});}
   return images.has(name)?Response.json({name}):Response.json({},{status:404});
  }
  const bytes=images.get(u.pathname.split('/').at(-1));return new Response(bytes||'',{status:bytes?200:404,headers:{'Content-Type':'image/webp'}});
 }};
}
async function usingApi(run){
 const redis=require('redis').createClient({url:process.env.REDIS_TEST_URL});await redis.connect();const prefix='chain24:'+crypto.randomUUID()+':';
 const client={isReady:true,on(){},get:k=>redis.get(prefix+k),set:(k,v,o)=>redis.set(prefix+k,v,o),keys:async p=>(await redis.keys(prefix+p)).map(k=>k.slice(prefix.length)),eval:(s,o)=>redis.eval(s,{...o,keys:o.keys.map(k=>prefix+k)})};
 const serverPath=path.join(__dirname,'../server.js'),realRequire=createRequire(serverPath),AI=realRequire('./editorial-ai');
 const context={require:id=>id==='./content-rights'?{decision:()=>({allowed:true})}:id==='./launch-policy'?{allowed:()=>true}:id==='redis'?{createClient:()=>client}:id==='./editorial-ai'?{...AI,createEditorialDraft:(data,options)=>AI.createEditorialDraft(data,{...options,fetcher:async()=>Response.json({choices:[{message:{content:JSON.stringify(payload().draft)}}]})})}:realRequire(id),process:{env:{HUB_API_SECRET:'chain-test-only',GROQ_API_KEY:'test-only',REDIS_URL:'test://isolated'}},console,URL,Buffer,crypto,__dirname:path.dirname(serverPath),module:{exports:{}},fetch};
 vm.runInNewContext(fs.readFileSync(serverPath,'utf8').replace(/start\(\);\s*$/,'module.exports={handle};'),context,{filename:serverPath});
 const server=http.createServer((req,res)=>context.module.exports.handle(req,res).catch(error=>{res.writeHead(500);res.end(JSON.stringify({error:error.message}));}));
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port;
 const api=async(endpoint,body,authorized=true)=>{const response=await fetch(base+endpoint,{headers:{'Content-Type':'application/json',...(authorized?{Authorization:'Bearer chain-test-only'}:{})},...(body?{method:'POST',body:JSON.stringify(body)}:{})});return {...await response.json(),status:response.status};};
 try{await run({api,base,client});}finally{server.closeAllConnections();await new Promise(r=>server.close(r));const keys=await redis.keys(prefix+'*');if(keys.length)await redis.del(keys);await redis.quit();}
}
test('complete manual chain: generated draft, facts, real rendered cover, approval, publication, visible feed and rejected revision',{skip:!process.env.REDIS_TEST_URL},()=>usingApi(async({api})=>{
 const p=payload();assert.equal((await api('/editorial-drafts',{payload:p},false)).status,401);
 const generated=await api('/draft',{topic:p.draft.headline,category:p.category,facts:p.verifiedFacts,sourceUrls:p.sources.map(s=>s.url)});assert.equal(generated.status,200);assert.ok(generated.savedDraft);
 const m=media();Object.assign(p,await A.uploadCover(p,{token:'test-only',fetcher:m.fetch}));assert.equal(m.puts,1);assert.equal(m.images.size,1);
 const saved=await api('/editorial-drafts',{id:generated.savedDraft.id,expectedRevision:generated.savedDraft.revision,payload:p,approve:true});assert.equal(saved.record.status,'approved');
 const request={...p,approved:true,editorialDraftId:saved.record.id,expectedRevision:saved.record.revision};
 const [a,b]=await Promise.all([api('/publish',request),api('/publish',request)]);assert.equal(a.status,200);assert.equal(b.status,200);assert.equal(a.article.id,b.article.id);
 const visible=(await api('/articles')).articles;assert.equal(visible.length,1);assert.equal(visible[0].category,'Eredivisie');assert.equal(visible[0].imageUrl,p.imageUrl);assert.deepEqual(visible[0].body,p.draft.body);
 if(process.env.EDITORIAL_BROWSER_TEST==='1'){
  const browser=await require('playwright').chromium.launch({headless:true});
  try{
   const page=await browser.newPage({viewport:{width:393,height:852}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
   await page.route('**/automatic-covers/**',route=>route.fulfill({contentType:'image/webp',body:m.images.get(new URL(route.request().url()).pathname.split('/').at(-1))}));
   const html=fs.readFileSync('android-ui/assets/home-features.html','utf8').replace('<script src="home-model.js"></script>','<script>'+fs.readFileSync('android-ui/assets/home-model.js','utf8')+'</script>');
   await page.setContent(html);
   await page.evaluate(articles=>{window.opened=[];window.HomeHub={resize(){},openColumn(){},openMatch(){},openArticle:id=>opened.push(id)};window.setData(JSON.stringify({articles,stats:{},videos:{videos:[]},loading:false}));},visible);
   assert.equal(await page.locator('.news-slide h1').innerText(),p.draft.headline);
   await page.locator('.news-slide img').first().evaluate(image=>image.decode());
   await page.locator('.news-slide').click();assert.deepEqual(await page.evaluate(()=>opened),[visible[0].id]);assert.deepEqual(errors,[]);
   console.log('Full chain: published article and rendered cover visible and clickable in unchanged Veldio home asset.');
  }finally{await browser.close();}
 }
 const rejection=await api('/editorial-drafts',{payload:{...p,draft:{...p.draft,headline:'Ajax beoordeelt aanvullende voorstellen voor toekomstige bijeenkomsten'}},state:'rejected',issues:['Bron nog niet voldoende bevestigd.']});assert.equal(rejection.record.status,'rejected');
 assert.equal((await api('/publish',{...rejection.record.payload,approved:true,editorialDraftId:rejection.record.id,expectedRevision:rejection.record.revision})).status,409);
 assert.equal((await api('/articles')).articles.length,1);
}));
async function automaticScenario(refuse=false,scenario='lost-ack'){return usingApi(async({api,base,client})=>{
 const p=payload(),now=Date.parse('2026-10-31T12:00:00Z');p.sources[1].url='https://www.az.nl/inside-az/nieuws/2026/oktober/veldio-test-overleg';
 const m=media(),text=p.verifiedFacts.join(' '),docUrls=p.sources.map(s=>s.url),fragments=A.evidenceFragments({text});let completions=0,lost=false;
 if(scenario==='reversed-sources'){docUrls.reverse();}
 const candidate={kind:'announcement',topic:p.draft.headline,category:'Eredivisie',eventDate:'',teams:['Ajax'],facts:p.verifiedFacts.map(t=>({text:t,evidence:[{source:0,fragment:Math.max(0,fragments.findIndex(f=>f.includes(t.slice(0,25))))}]})),sharedEventEvidence:[{source:0,fragment:0},{source:1,fragment:0}]};
 const fetcher=async(url,options={})=>{
  const u=new URL(url);
  if(u.hostname==='voetbalhub-redactie.onrender.com'){
   const r=await fetch(base+u.pathname,options);
   if(scenario==='lost-ack'&&u.pathname==='/publish'&&!lost&&r.ok){lost=true;await r.text();throw Error('Simulated lost acknowledgement after commit');}return r;
  }
  if(u.hostname==='api.groq.com'){
   if(u.pathname.endsWith('/models'))return Response.json({data:[{id:'openai/gpt-oss-120b'}]});
   completions++;const req=JSON.parse(options.body),prompt=req.messages[0].content;
   let result=prompt.startsWith('Je extraheert')?candidate:prompt.startsWith('Je bent een strenge tweede')?{approved:!refuse,issues:refuse?['De bron bevestigt het onderwerp onvoldoende.']:[]}:p.draft;
   return Response.json({choices:[{message:{content:JSON.stringify(result)}}]});
  }
  if(u.hostname==='api.github.com'||u.hostname==='raw.githubusercontent.com')return m.fetch(url,options);
  if(docUrls.includes(url))return new Response((scenario==='source-navigation'?'<nav>Transfergeruchten zonder bron.</nav><script>irrelevant()</script>':'')+'<script type="application/ld+json">'+JSON.stringify({datePublished:new Date(now-3600000).toISOString()})+'</script><main><h1>'+p.draft.headline+'</h1><p>'+text+'</p></main>');
  if(url==='https://www.ajax.nl/')return new Response('<a href="'+new URL(p.sources[0].url).pathname+'">Onderwerp</a>'+(scenario==='duplicate-links'?'<a href="'+new URL(p.sources[0].url).pathname+'#extra">Nogmaals</a>':'' ));
  if(url==='https://www.az.nl/inside-az/nieuws/')return new Response('<a href="'+new URL(p.sources[1].url).pathname+'">Onderwerp</a>');
  return new Response('',{status:404});
 };
 let report=await A.run({secret:'chain-test-only',groqKey:'test-only',githubToken:'test-only',fetcher,now,aiIntervalMs:0});
 if(refuse){assert.equal(report.published.length,0);const records=(await api('/editorial-drafts')).items;assert.equal(records[0].status,'needs_review');assert.match(records[0].issues.join(' '),/Tweede feitencontrole/);assert.equal(records[0].payload.draft.body.length,3);assert.equal((await api('/articles')).articles.length,0);assert.equal(m.puts,0);return;}
 assert.equal(report.published.length,1,JSON.stringify(report.skipped));assert.equal(lost,scenario==='lost-ack');assert.equal(m.puts,1);
 const visible=(await api('/articles')).articles;assert.equal(visible.length,1);assert.equal(visible[0].category,'Eredivisie');assert.ok(visible[0].imageUrl.includes('automatic-covers/'));
 const records=(await api('/editorial-drafts')).items;assert.equal(records[0].status,'published');assert.equal(records[0].verification.claims.length,4);
 const oldCalls=completions;await A.run({secret:'chain-test-only',groqKey:'test-only',githubToken:'test-only',fetcher,now,aiIntervalMs:0});assert.equal(completions,oldCalls);assert.equal((await api('/articles')).articles.length,1);
 });}
test('automatic discovery, fact check, real cover, approval, public feed, lost response retry and repeated-run cost guard',{skip:!process.env.REDIS_TEST_URL},()=>automaticScenario());
test('negative automatic fact check preserves needs_review draft and never uploads or publishes',{skip:!process.env.REDIS_TEST_URL},()=>automaticScenario(true));

for(const scenario of ['normal','duplicate-links','reversed-sources','source-navigation'])test('isolated full editorial chain: '+scenario,{skip:!process.env.REDIS_TEST_URL},()=>automaticScenario(false,scenario));
