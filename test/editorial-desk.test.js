const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const http = require('node:http');
const {createRequire} = require('node:module');
const M = require('../editorial-desk-model');
function valid() {
  return {approved:true, draft:{headline:'FC Groningen wint na spannende slotfase van Ajax',standfirst:'Groningen boekte een overwinning na een intensieve wedstrijd waarin de bezoekers tot het laatste moment bleven aandringen.',body:[
    'De thuisploeg begon met veel druk op de tegenstander en zocht via de vleugels voortdurend naar vrije spelers achter de verdediging.',
    'Na de onderbreking koos de bezoekende trainer voor twee wissels op het middenveld om meer controle te krijgen over het balbezit.',
    'Supporters bleven hun team aanmoedigen terwijl beide trainers richting het laatste fluitsignaal de resterende spelers op de bank instructies gaven.'
  ]},verifiedFacts:['Gecontroleerd feit één','Gecontroleerd feit twee'],sources:[{url:'https://flashscore.nl/wedstrijd/test'},{url:'https://fcgroningen.nl/nieuws/test'}],editorialChecks:Object.fromEntries(M.checks.map(k=>[k,true])),imageRights:'not_needed'};
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
let server,base,store;
test.before(async()=>{
  store=new Map();const redis={isReady:true,on(){},get:async key=>store.get(key)||null,set:async(key,value)=>store.set(key,value),keys:async pattern=>[...store.keys()].filter(k=>k.startsWith(pattern.slice(0,-1)))};
  const serverPath=path.join(__dirname,'../server.js'),realRequire=createRequire(serverPath);
  const context={require:id=>id==='redis'?{createClient:()=>redis}:realRequire(id),process:{env:{HUB_API_SECRET:'test-only',REDIS_URL:'test://mock'}},console,URL,Buffer,crypto:require('node:crypto'),__dirname:path.dirname(serverPath),module:{exports:{}},fetch};
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
