'use strict';

const test=require('node:test');
const assert=require('node:assert/strict');
const {research}=require('../scripts/eredivisie-research103b');
const {validateEvidence,preflightArtwork,plain,overlap}=require('../scripts/automatic-publication');
const {EditorialQueue}=require('../editorial-production45');
const now=Date.parse('2026-11-20T18:00:00Z');
const f={id:'example-fixture',home:{name:'FC Groningen'},away:{name:'SC Heerenveen'},
 date:'2026-11-21T20:00:00Z',status:'NS',round:'Speelronde 13',competition:'eredivisie'};
function article(url,title,paragraphs){
 return {url,title,publishedAt:'2026-11-19T11:00:00Z',text:paragraphs.join(' '),
  html:paragraphs.map(p=>'<p>'+p+'</p>').join('')};
}
const club=article('https://www.fcgroningen.nl/nieuws/competitieduel/','FC Groningen ontvangt SC Heerenveen',[
 'FC Groningen ontvangt zaterdagavond SC Heerenveen voor de volgende wedstrijd.',
 'FC Groningen mist voor dit competitieduel twee geschorste spelers.'
]);
const league=article('https://eredivisie.nl/nieuws/vooruitblik-speelronde-13/','Vooruitblik speelronde 13',[
 'FC Groningen ontvangt SC Heerenveen na de onderbreking van de competitie. SC Heerenveen pakte negen punten in de vorige speelronde en de twee speelronden daarvoor.',
 'PSV scoorde twee doelpunten tegen Ajax in de vorige competitiewedstrijd.'
]);
const run=(options={})=>research({fixtures:[f],docs:[club],now,plain,loadRound:async()=>league,
 validate:validateEvidence,artwork:preflightArtwork,matchGroups:[],leads:[],...options});
test('twee gedateerde primaire bronnen leveren een fixturegebonden plan met letterlijke nieuwe feiten',async()=>{
 const {topics,groups,deep}=await run({fixtures:[f,f]});
 assert.equal(deep,1);assert.equal(topics.length,1);
 const [row]=topics;
 assert.ok(row.questions.length);assert.equal(row.status,'awaiting_approved_artwork');
 assert.ok(row.ledger.some(r=>r.newFromCompetition));
 for(const fact of row.ledger){
  assert.ok(fact.publishedAt);
  assert.ok(groups[0].find(d=>d.url===fact.url).text.includes(fact.excerpt));
  assert.doesNotMatch(fact.excerpt,/PSV/);
 }
 assert.ok(overlap(league.text,{headline:'',standfirst:league.text,body:[]}));
 const queue=new EditorialQueue(),job=queue.enqueue(groups[0],now);
 queue.finish(job,'review',now);
 groups[0][1]={...groups[0][1],text:groups[0][1].text+' Ander nieuws elders op deze pagina.'};
 assert.equal(queue.enqueue(groups[0],now),job);
 assert.equal(queue.due(job,now),false);
});
test('verouderd, toekomstig, verkeerde speeldag, ander duel en onbevoegde herkomst leveren geen dossier op',async()=>{
 for(const altered of [{...league,publishedAt:'2026-11-15'},{...league,publishedAt:'2026-11-22'},
  {...league,url:'https://www.vi.nl/nieuws/ronde'},
  article(league.url,league.title,['FC Groningen ontvangt zondagmiddag SC Heerenveen in de competitie.']),
  article(league.url,league.title,['FC Groningen ontvangt zondag Ajax na de laatste competitiewedstrijd.'])]){
  assert.deepEqual((await run({loadRound:async()=>altered})).groups,[]);
 }
});
test('een 403 of time-out blijft een bronblokkade zonder herhaalde aanroep of modelverzoek',async()=>{
 for(const reason of ['HTTP 403','Timeout']){
  let calls=0;
  const result=await run({fixtures:[f,f],loadRound:async()=>{calls++;throw Error(reason);}});
  assert.equal(calls,1);assert.equal(result.topics[0].reason,reason);
  assert.equal(result.topics[0].status,'source_unavailable');assert.deepEqual(result.groups,[]);
 }
});
test('media en herhaalde transfergeruchten blijven signalen en leveren geen geverifieerde feiten op',async()=>{
 const lead={id:'lead1',url:'https://www.vi.nl/nieuws/bod',title:'PSV zou nieuw bod voorbereiden voor middenvelder',publisher:'vi',publishedAt:club.publishedAt};
 const result=await run({fixtures:[],docs:[],leads:[lead,lead]});
 assert.equal(result.topics.length,1);assert.equal(result.topics[0].status,'attributed_unconfirmed');
 assert.deepEqual(result.groups,[]);assert.equal(result.deep,0);
});
test('negen beeldblokkades bereiken de rechtencontrole zonder modelverzoek of publicatie',async()=>{
 const {run}=require('../scripts/automatic-publication');
 const matches=Array.from({length:9},(_,i)=>({
  id:'of-nl-2026-test-'+i,competition:'eredivisie',round:'Speelronde 13',status:'FT',
  date:new Date(now-4*3600000).toISOString(),home:{name:'Thuisclub '+i},away:{name:'Uitclub '+i},
  goals:{home:4,away:0},halfTime:{home:1,away:0}
 }));
 const fetcher=async(url,options={})=>{
  if(url.includes('/integrations/football?competition=eredivisie'))return Response.json({status:'available',fixtures:matches});
  if(url.includes('/articles'))return Response.json({articles:[]});
  if(url.includes('editorial-queue45.json'))return options.method==='PUT'?Response.json({content:{sha:'updated'}}):
   Response.json({content:Buffer.from('{"records":[]}').toString('base64'),sha:'old'});
  return new Response(null,{status:404});
 };
 const report=await run({now,fetcher,secret:'local-test',githubToken:'local-test',expectedRevision:null,
  providerRouter:{configured:()=>[{enabled:true}],trace:[],hasReviewCapacity:()=>true}});
 assert.equal(report.skipped.filter(r=>r.stage==='artwork').length,9);
 assert.equal(report.counts.aiRequests,0);assert.equal(report.counts.selected,0);
});
