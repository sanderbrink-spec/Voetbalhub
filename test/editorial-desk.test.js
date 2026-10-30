const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const http = require('node:http');
const {createRequire} = require('node:module');
const M = require('../editorial-desk-model');
function valid() {
  const result={approved:true,match:{homeTeam:'FC Groningen',awayTeam:'Ajax',homeScore:2,awayScore:0,playedAt:'2026-10-29'},factChecks:{resultVerified:true,namesVerified:true,dateVerified:true,timelineVerified:true}, draft:{headline:'FC Groningen wint na spannende slotfase van Ajax',standfirst:'Groningen boekte een overwinning na een intensieve wedstrijd waarin de bezoekers tot het laatste moment bleven aandringen.',body:[
    'De thuisploeg begon met veel druk op de tegenstander en zocht via de vleugels voortdurend naar vrije spelers achter de verdediging.',
    'Na de onderbreking koos de bezoekende trainer voor twee wissels op het middenveld om meer controle te krijgen over het balbezit.',
    'Supporters bleven hun team aanmoedigen terwijl beide trainers richting het laatste fluitsignaal de resterende spelers op de bank instructies gaven.'
  ]},verifiedFacts:['FC Groningen speelde thuis tegen Ajax op 2026-10-29. De eindstand thuis-uit was 2-0.','Een tweede door de redactie gecontroleerd feit.'],sources:[{url:'https://flashscore.nl/wedstrijd/test'},{url:'https://fcgroningen.nl/nieuws/test'}],editorialChecks:Object.fromEntries(M.checks.map(k=>[k,true])),imageRights:'not_needed'};result.verifiedFacts.push(...result.draft.body);return result;
}
test('shared publication preflight accepts complete review',()=>assert.deepEqual(M.publicationIssues(valid()),[]));
test('Flashscore required for scores and actual Flashscore host, not lookalikes',()=>{
  const p=valid();p.draft.headline='FC Groningen wint met 2-0 van Ajax';
  for(const url of ['https://example.org/test','https://flashscore.nl.evil.example/test','https://evilflashscore.nl/test']){
    p.sources[0].url=url;assert.ok(M.publicationIssues(p).some(x=>x.includes('Flashscore')));
  }
  p.sources[0].url='https://www.flashscore.nl/wedstrijd/test';assert.deepEqual(M.publicationIssues(p),[]);
});
test('www and mobile aliases do not count as independent sources',()=>{
  const p=valid();p.sources=[{url:'https://www.fcgroningen.nl/a'},{url:'https://m.fcgroningen.nl/b'}];
  assert.ok(M.publicationIssues(p).some(x=>x.includes('verschillende websites')));
});
test('malformed sources, inherited checks and incomplete copy stay blocked',()=>{
  const p=valid();p.sources[1].url='https://';p.editorialChecks={};p.draft.body=['Kort'];
  assert.equal(M.publicationIssues(p).length,3);
});
test('queue filters by source date, excludes future records, and sorts newest first',()=>{
  const now=Date.parse('2026-10-30T10:00:00Z');
  const a={headline:'Oud bericht',source:{publishedAt:'2026-10-28T00:00:00Z'}};
  const b={headline:'Nieuw bericht',source:{publishedAt:'2026-10-30T09:00:00Z'}};
  const c={headline:'Eerder bericht',source:{publishedAt:'2026-10-30T08:00:00Z'}};
  const d={headline:'Toekomst',source:{publishedAt:'2026-10-31T00:00:00Z'}};
  assert.deepEqual(M.queue([a,c,b,d],{hours:36,rss:true,english:true},now),[b,c]);
  assert.equal(M.queue([b,c],{hours:36,rss:true,english:true,search:'Nieuw'},now).length,1);
});
test('queue preserves undated/news leads and distinguishes draft body shapes',()=>{
  const item={headline:'FC Groningen onderzoekt nieuwe plannen',draft:{body:'Eerste alinea.\n\nTweede alinea.'}};
  assert.equal(M.paragraphs(item).length,2);
  assert.equal(M.queue([item],{undated:true,rss:true,filter:'text'}).length,1);
  assert.equal(M.queue([item],{undated:false,rss:true}).length,0);
});
let server,base,store,redisOptions;
test.before(async()=>{
  store=new Map();const redis={isReady:true,on(){},get:async key=>store.get(key)||null,set:async(key,value,options)=>{if(options?.NX&&store.has(key))return null;store.set(key,value);return 'OK';},
  eval:async(script,options)=>{
    assert.match(script,/record.revision/);
    const key=options.keys[0],current=store.get(key),expected=Number(options.arguments[0]);
    if(current?JSON.parse(current).revision!==expected:expected!==0)return 0;
    store.set(key,options.arguments[1]);return 1;
  },keys:async pattern=>[...store.keys()].filter(k=>k.startsWith(pattern.slice(0,-1)))};
  const serverPath=path.join(__dirname,'../server.js'),realRequire=createRequire(serverPath);
  const context={require:id=>id==='redis'?{createClient:options=>{redisOptions=options;return redis;}}:realRequire(id),process:{env:{HUB_API_SECRET:'test-only',REDIS_URL:'test://mock'}},console,URL,Buffer,crypto:require('node:crypto'),__dirname:path.dirname(serverPath),module:{exports:{}},fetch};
  const source=fs.readFileSync(serverPath,'utf8').replace(/start\(\);\s*$/,'module.exports={handle};');
  vm.runInNewContext(source,context,{filename:serverPath});
  server=http.createServer((req,res)=>context.module.exports.handle(req,res).catch(err=>{res.writeHead(500);res.end(String(err));}));
  await new Promise(r=>server.listen(0,'127.0.0.1',r));base='http://127.0.0.1:'+server.address().port;
});
test.after(async()=>{if(server)await new Promise(r=>server.close(r));});
const publish=p=>fetch(base+'/publish',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer test-only'},body:JSON.stringify(p)});
test('real server enforces Flashscore and does not write blocked submissions',async()=>{
  const p=valid();p.draft.headline='FC Groningen wint met 2-0 van Ajax';p.sources[0].url='https://ajax.nl/test';
  const r=await publish(p);assert.equal(r.status,400);assert.match((await r.json()).error,/Flashscore/);assert.equal(store.size,0);
});
test('publication requires authorization and explicit approval; duplicate retry writes once',async()=>{
  let r=await fetch(base+'/publish',{method:'POST',body:JSON.stringify(valid())});assert.equal(r.status,401);
  r=await publish({...valid(),approved:false});assert.equal(r.status,400);
  r=await publish(valid());assert.equal(r.status,200);assert.equal(store.size,1);
  r=await publish(valid());assert.equal(r.status,409);assert.equal(store.size,1);
});
test('desk and both javascript assets served, old hardcoded story absent',async()=>{
  const r=await fetch(base+'/publish-desk'),html=await r.text();assert.equal(r.status,200);
  assert.ok(!html.includes('originalStory'));assert.ok(html.includes('Herstel bewerking'));
  for(const url of ['/desk.js','/desk-model.js']){const asset=await fetch(base+url);assert.equal(asset.status,200);new vm.Script(await asset.text());}
  assert.equal((await fetch(base+'/desk/../../server.js')).status,404);
});
test('server blocks contradictory headline despite checked boxes',async()=>{
  const p=valid();p.draft.headline='FC Twente wint en speelt gelijk tegen AZ';
  const before=store.size,r=await publish(p);assert.equal(r.status,400);assert.match((await r.json()).error,/Tegenstrijdige kop/);assert.equal(store.size,before);
});
test('all-time queue reveals all 49 stored records without changing their dates or content',()=>{
  const now=Date.parse('2026-10-30T10:00:00Z');
  const items=Array.from({length:49},(_,i)=>({id:String(i),headline:'Opgeslagen nieuwsaanleiding '+i,source:{publishedAt:'2026-10-24T08:00:00Z'},body:[],sourceEvidence:{evidenceLevel:'publisher_link_only'}}));
  const before=JSON.stringify(items);
  assert.equal(M.queue(items,{hours:36,rss:true,english:true,undated:true},now).length,0);
  assert.equal(M.queue(items,{hours:'all',rss:true,english:true,undated:true},now).length,49);
  assert.equal(M.excludedBy(items[0],{hours:36,rss:true,english:true,undated:true},now),'date');
  assert.equal(JSON.stringify(items),before);
});
test('legacy malformed date falls through to valid evidence date; creation date never substitutes',()=>{
  const time='2026-10-30T08:00:00Z';
  assert.equal(M.date({source:{publishedAt:'onbekend'},sourceEvidence:{publishedAt:time}}),Date.parse(time));
  assert.equal(M.date({createdAt:time}),0);
});
test('queue exclusion reasons identify saved RSS, search and view filters',()=>{
  const item={headline:'FC Groningen kijkt vooruit',body:[]};
  assert.equal(M.excludedBy(item,{hours:'all',undated:true,rss:false},Date.now()),'rss');
  assert.equal(M.excludedBy(item,{hours:'all',undated:true,rss:true,search:'Ajax'},Date.now()),'search');
  assert.equal(M.excludedBy(item,{hours:'all',undated:true,rss:true,filter:'text'},Date.now()),'type');
});
test('inbox exposes server time so phone clock cannot empty the recent queue',async()=>{
  const r=await fetch(base+'/inbox',{headers:{Authorization:'Bearer test-only'}}),d=await r.json();
  assert.equal(r.status,200);assert.ok(Math.abs(Date.parse(d.serverTime)-Date.now())<5000);
});

test('storage reconnects with bounded backoff and fails offline commands promptly',()=>{
 assert.equal(redisOptions.disableOfflineQueue,true);
 assert.equal(redisOptions.socket.connectTimeout,5000);
 assert.ok(redisOptions.socket.reconnectStrategy(0)>0);
 assert.equal(redisOptions.socket.reconnectStrategy(100),5000);
});
test('service status accurately reports fact-based drafts and disabled automatic intake',async()=>{
 const d=await (await fetch(base+'/health')).json();
 assert.equal(d.draftMode,'verified_facts_only');assert.equal(d.automaticSourceIngestion,false);assert.equal(d.autoPublish,false);
});
test('the browser preflight and publication server both reject repeated paragraphs',async()=>{
 const p=valid();p.draft.body=[p.draft.body[0],p.draft.body[0],p.draft.body[2]];
 assert.ok(M.publicationIssues(p).some(x=>x.includes('herhalen')));
 const before=store.size,r=await publish(p);assert.equal(r.status,400);assert.match((await r.json()).error,/herhalen/);assert.equal(store.size,before);
});

function ownPayload(){
 const p=valid();p.draft={headline:'Club bespreekt nieuwe plannen voor supporters rond het stadion',standfirst:'Vertegenwoordigers van de club overleggen met supporters over de bereikbaarheid van het stadion en de ontvangst tijdens toekomstige evenementen.',body:[
 'De directie verzamelde tijdens een bijeenkomst voorstellen van bezoekers over de toegangswegen en besprak welke praktische verbeteringen op korte termijn onderzocht kunnen worden.',
 'Medewerkers van verschillende afdelingen spraken vervolgens over afspraken voor de ontvangst van gezinnen waarbij duidelijke informatie op de toegangsbewijzen een belangrijk aandachtspunt vormde.',
 'Een werkgroep neemt de verzamelde reacties mee naar een volgend overleg en zal per voorstel bekijken welke betrokken partijen verantwoordelijk zijn voor verdere uitwerking.'
 ]};return p;
}
const saveOwn=p=>fetch(base+'/editorial-drafts',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer test-only'},body:JSON.stringify(p)});
let ownRecord;
test('full own drafts stay private and can be reopened with facts and sources',async()=>{
 assert.equal((await fetch(base+'/editorial-drafts')).status,401);
 const p=ownPayload();p.editorialChecks={};
 const before=(await (await fetch(base+'/articles')).json()).count;
 const r=await saveOwn({payload:{...p,secret:'must-not-persist'},approve:false});assert.equal(r.status,200);
 ownRecord=(await r.json()).record;assert.equal(ownRecord.status,'draft');assert.equal(ownRecord.revision,1);
 assert.equal(ownRecord.payload.draft.body.length,3);assert.ok(ownRecord.payload.verifiedFacts.length>=2);assert.equal(ownRecord.payload.sources.length,2);
 assert.ok(!JSON.stringify(ownRecord).includes('must-not-persist'));
 const records=(await (await fetch(base+'/editorial-drafts',{headers:{Authorization:'Bearer test-only'}})).json()).items;
 assert.ok(records.some(x=>x.id===ownRecord.id));
 assert.equal((await (await fetch(base+'/articles')).json()).count,before);
});
test('own draft approval requires completed checks and an unchanged revision',async()=>{
 let r=await saveOwn({id:ownRecord.id,expectedRevision:1,payload:ownRecord.payload,approve:true});assert.equal(r.status,400);
 r=await publish({...ownPayload(),editorialDraftId:ownRecord.id,expectedRevision:1});assert.equal(r.status,409);
 r=await saveOwn({id:ownRecord.id,expectedRevision:1,payload:ownPayload(),approve:true});assert.equal(r.status,200);ownRecord=(await r.json()).record;
 assert.equal(ownRecord.status,'approved');assert.equal(ownRecord.revision,2);
 r=await saveOwn({id:ownRecord.id,expectedRevision:1,payload:ownPayload()});assert.equal(r.status,409);
});
test('only the exact approved draft can be published and retries cannot duplicate it',async()=>{
 const p=ownPayload();p.draft.headline='Andere kop met voldoende woorden voor een artikel';
 let r=await publish({...p,editorialDraftId:ownRecord.id,expectedRevision:2});assert.equal(r.status,409);
 const before=(await (await fetch(base+'/articles')).json()).count;
 const payload={...ownPayload(),editorialDraftId:ownRecord.id,expectedRevision:2};
 r=await publish(payload);assert.equal(r.status,200);const published=await r.json();assert.equal(published.article.id,ownRecord.id.slice(14));
 r=await publish(payload);assert.equal(r.status,200);assert.equal((await r.json()).article.id,published.article.id);
 assert.equal((await (await fetch(base+'/articles')).json()).count,before+1);
 const records=(await (await fetch(base+'/editorial-drafts',{headers:{Authorization:'Bearer test-only'}})).json()).items;
 assert.equal(records.find(x=>x.id===ownRecord.id).status,'published');
});
test('concurrent saves of the same revision cannot overwrite each other',async()=>{
 let r=await saveOwn({payload:ownPayload()});const record=(await r.json()).record;
 const results=await Promise.all([saveOwn({id:record.id,expectedRevision:1,payload:ownPayload()}),saveOwn({id:record.id,expectedRevision:1,payload:ownPayload()})]);
 assert.deepEqual(results.map(x=>x.status).sort(),[200,409]);
});
test('general approval cannot bypass the report-specific factual checks',async()=>{
 const p=valid();delete p.factChecks;delete p.match;
 const r=await publish(p);assert.equal(r.status,400);assert.match((await r.json()).error,/Wedstrijdverslag|Feitencontrole/);
});
test('reversed result stays blocked by the publication API despite checked boxes',async()=>{
 const p=valid();p.draft.headline='FC Groningen wint met 0-2 van Ajax';
 const r=await publish(p);assert.equal(r.status,400);assert.match((await r.json()).error,/Uitslag of tussenstand/);
});
test('unsupported match narrative cannot be approved just by ticking all controls',async()=>{
 const p=valid();p.draft.body[0]+=' Ajax domineerde het duel maar Groningen maakte een comeback.';
 const r=await saveOwn({payload:p,approve:true});assert.equal(r.status,400);assert.match((await r.json()).error,/Niet aangeleverd wedstrijdverloop/);
});
