'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const W=require('../scripts/weekly-feature'),Home=require('../android-ui/assets/home-model');
const kickoff=Date.parse('2026-11-01T13:30:00Z'),nextKickoff=Date.parse('2026-11-08T15:45:00Z');
const team=(id,name)=>({id,name});
const a=team(1,'Ajax'),b=team(2,'PSV'),c=team(3,'AZ'),d=team(4,'FC Groningen');
const fixture=(id,date,home=a,away=b)=>({id,date:new Date(date).toISOString(),home,away,status:'NS',round:'Ronde '+id,venue:{name:'Teststadion'},goals:{home:null,away:null}});
function snapshot(){return {schemaVersion:1,updatedAt:new Date(kickoff).toISOString(),source:'Synthetic licensed test input',league:{id:88,season:2026},fixtures:[fixture(1,kickoff),fixture(2,nextKickoff,c,d)],standings:[a,b,c,d].map((team,i)=>({team,rank:i+1,points:20-i,all:{played:8,goals:{for:12,against:5}},home:{played:4},away:{played:4}})),players:{scorers:[]},warnings:[]};}
const art={imageUrl:'https://example.test/own.webp',imageCredit:'Synthetic own artwork'};
const options=now=>({now,previewImage:async()=>art,reportImage:async f=>({...art,imageReview:{method:'own-weekly-score-v1',fixtureId:f.id,goals:f.goals}})});
async function update(s,previous,opts){s.updatedAt=new Date(opts.now).toISOString();return W.update(s,previous,opts);}
async function initial(){return update(snapshot(),null,options(kickoff-3600000));}
async function finished(){const prev=await initial(),s=snapshot();s.fixtures[0].status='FT';s.fixtures[0].goals={home:2,away:1};return update(s,prev,options(kickoff+7200000));}
test('weekly preview stays linked during live play and switches only on confirmed final status and result',async()=>{
 const prev=await initial();assert.equal(prev.featured.phase,'preview');
 for(const status of ['NS','LIVE','HT','2H','ET','BT','P','INT','SUSP','PST','CANC','ABD','AWD','WO','TBD']){
  const s=snapshot();s.fixtures[0].status=status;s.fixtures[0].goals={home:2,away:1};const result=await update(s,prev,options(kickoff+7200000));
  assert.equal(result.featured.publicationId,prev.featured.publicationId,status);assert.equal(result.featured.phase,'preview',status);assert.ok(Home.currentMatch(result,kickoff+7200000),status);
 }
 const result=await finished();assert.equal(result.featured.phase,'report');assert.match(result.featured.report.headline,/2–1/);assert.equal(result.featured.fixtureId,1);assert.equal(Home.currentMatch(result,kickoff+7200000).phase,'report');
});
test('no inferred full time from the clock, incomplete scores, invalid values or future final',async()=>{
 const prev=await initial();for(const goals of [{home:null,away:1},{home:-1,away:0},{home:1.5,away:0},{home:100,away:0}]){const s=snapshot();s.fixtures[0].status='FT';s.fixtures[0].goals=goals;assert.equal((await update(s,prev,options(kickoff+86400000))).featured.phase,'preview');}
 const s=snapshot();s.fixtures[0].status='FT';s.fixtures[0].goals={home:2,away:1};assert.equal((await update(s,prev,options(kickoff-1))).featured.phase,'preview');
});
test('old report remains until exactly 72 hours before next selected kickoff, including milliseconds and DST',async()=>{
 const prev=await finished(),boundary=nextKickoff-W.HOURS;
 assert.equal(prev.nextFeatured.publishAt,new Date(boundary).toISOString());
 for(const offset of [-1,0,1]){const s=snapshot();s.fixtures[0]=prev.featured.report.fixture;const result=await update(s,prev,options(boundary+offset));assert.equal(result.featured.fixtureId,offset<0?1:2);assert.equal(result.featured.phase,offset<0?'report':'preview');}
 const staged={...prev};assert.equal(Home.currentMatch(staged,boundary-1).fixture.id,1);assert.equal(Home.currentMatch(staged,boundary).fixture.id,2);
 const dst=Date.parse('2026-10-25T15:00:00+01:00');assert.equal(new Date(dst-W.HOURS).toISOString(),'2026-10-22T14:00:00.000Z');
});
test('missing next match, failed preview/image and failed report retain last correct publication',async()=>{
 const prev=await finished(),s=snapshot();s.fixtures=[];assert.deepEqual((await update(s,prev,options(nextKickoff))).featured,prev.featured);
 const bad=snapshot();bad.fixtures[1].date=new Date(nextKickoff+86400000).toISOString();
 const result=await update(bad,prev,{...options(nextKickoff-3600000),previewImage:async()=>{throw Error('Image offline');}});assert.equal(result.featured.publicationId,prev.featured.publicationId);
 const original=await initial(),done=snapshot();done.fixtures[0].status='FT';done.fixtures[0].goals={home:1,away:1};const held=await update(done,original,{...options(kickoff+7200000),reportImage:async()=>{throw Error('Render failed');}});assert.equal(held.featured.publicationId,original.featured.publicationId);assert.ok(held.warnings.some(x=>x.includes('Render failed')));
});
test('postponement, cancellation and relocation do not produce a final report and recalculate cutoff',async()=>{
 const prev=await finished();for(const status of ['PST','CANC','TBD']){const s=snapshot();s.fixtures[1].status=status;const result=await update(s,prev,options(nextKickoff));assert.equal(result.featured.phase,'report');assert.equal(result.nextFeatured,undefined);}
 const s=snapshot();s.fixtures[1].date=new Date(nextKickoff+2*86400000).toISOString();s.fixtures[1].venue={name:'Nieuw bevestigd stadion'};
 const result=await update(s,prev,options(nextKickoff-W.HOURS));assert.equal(result.featured.phase,'report');assert.equal(result.nextFeatured.publishAt,new Date(nextKickoff+2*86400000-W.HOURS).toISOString());assert.equal(result.nextFeatured.preview.fixture.venue.name,'Nieuw bevestigd stadion');
});
test('repeated runs reuse the exact publication and artwork, corrected score replaces same report identity',async()=>{
 const prev=await finished();let renders=0;const s=snapshot();s.fixtures[0]=structuredClone(prev.featured.report.fixture);
 const opts={...options(kickoff+7200001),reportImage:async f=>{renders++;return options(0).reportImage(f);}};
 const repeated=await update(s,prev,opts);assert.equal(renders,0);assert.deepEqual(repeated.featured.report,prev.featured.report);
 const corrected=snapshot();corrected.fixtures[0]={...prev.featured.report.fixture,goals:{home:1,away:1}};const next=await update(corrected,repeated,opts);assert.equal(renders,1);assert.equal(next.featured.publicationId,prev.featured.publicationId);assert.match(next.featured.report.headline,/1–1/);
});
test('extra time and penalties have explicit final status and never invent shootout goals or scorers',()=>{
 for(const status of ['AET','PEN']){const f={...fixture(1,kickoff),status,goals:{home:1,away:1}};const report=W.buildReport(f,kickoff+10800000);assert.equal(report.fixture.status,status);assert.match(report.body.join(' '),status==='PEN'?/geen afzonderlijke strafschoppenserie/:/na verlenging/);}
});
test('previous publication read failures stop publication instead of deleting the known block',async()=>{
 for(const response of [{ok:false,status:503},{ok:true,json:async()=>({})}])await assert.rejects(W.readPrevious(async()=>response),/Vorig wedstrijdblok/);
 await assert.rejects(W.readPrevious(async()=>{throw Error('offline');}),/offline/);
 assert.equal(await W.readPrevious(async()=>({status:404})),null);
});
test('out-of-order snapshots cannot replace current publication, and stale NS does not revert a final report',async()=>{
 const prev=await finished(),s=snapshot();s.updatedAt=new Date(Date.parse(prev.updatedAt)-1).toISOString();await assert.rejects(W.update(s,prev,options(kickoff+7200000)),/ouder/);
 const repeated=await update(snapshot(),prev,options(kickoff+7200001));assert.equal(repeated.featured.phase,'report');assert.equal(repeated.featured.fixtureId,1);
 const expiry=nextKickoff-W.HOURS;assert.equal(Home.currentMatch({...prev,rightsPolicyVersion:26,rightsExpiresAt:expiry-1},expiry).phase,'report');
});
test('own report cover is genuinely rendered with the checked score and uploaded using existing storage',async()=>{
 const f={...fixture(1,kickoff),status:'FT',goals:{home:2,away:1}};let bytes;
 const result=await W.ownReportImage(f,{token:'synthetic-test-only',fetcher:async(url,opts)=>{
  assert.ok(String(url).startsWith('https://api.github.com/repos/sanderbrink-spec/Voetbalhub/contents/weekly/'));
  if(opts.method==='PUT'){bytes=Buffer.from(JSON.parse(opts.body).content,'base64');return {ok:true};}return {ok:false,status:404};
 }});
 const meta=await require('sharp')(bytes).metadata();assert.equal(meta.width,1600);assert.equal(meta.height,900);assert.equal(meta.format,'webp');assert.deepEqual(result.imageReview.goals,f.goals);assert.match(result.imageUrl,/1-report-[a-f0-9]{64}\.webp$/);
});
test('existing collector publishes report and media together; failed snapshot publication keeps previous feature',async()=>{
 const {collect,DATA_URL}=require('../scripts/eredivisie-data');let remote=await initial(),fail=true,mediaWrites=0;const original=JSON.stringify(remote),media=new Map();
 const fetcher=async(url,opts={})=>{
  const u=new URL(url);
  if(String(url)===DATA_URL)return Response.json(remote);
  if(u.hostname==='v3.football.api-sports.io'){
   let response=[];
   if(u.pathname==='/fixtures')response=[{fixture:{id:1,date:new Date(kickoff).toISOString(),status:{short:'FT'},venue:{}},league:{id:88,round:'Ronde 1'},teams:{home:a,away:b},goals:{home:2,away:1}}];
   if(u.pathname==='/standings')response=[{league:{standings:[snapshot().standings]}}];
   return Response.json({response});
  }
  assert.equal(u.hostname,'api.github.com');const file=u.pathname.split('/contents/')[1];
  if(opts.method==='PUT'){
   const content=JSON.parse(opts.body).content;
   if(file==='statistics/eredivisie.json'){if(fail)return new Response('',{status:503});remote=JSON.parse(Buffer.from(content,'base64').toString());}
   else{mediaWrites++;media.set(file,content);}return Response.json({});
  }
  if(file==='statistics/eredivisie.json')return Response.json({sha:'synthetic-existing',content:Buffer.from(JSON.stringify(remote)).toString('base64')});
  return media.has(file)?Response.json({sha:'synthetic-media',content:media.get(file)}):new Response('',{status:404});
 };
 const opts={key:'synthetic-key',token:'synthetic-token',fetcher,now:kickoff+7200000};
 await assert.rejects(collect(opts),/konden niet worden bewaard/);assert.equal(JSON.stringify(remote),original);
 fail=false;await collect(opts);assert.equal(remote.featured.phase,'report');const id=remote.featured.publicationId;
 await collect({...opts,now:opts.now+60000});assert.equal(remote.featured.publicationId,id);assert.equal(mediaWrites,1);
});
test('a later match in the same round never replaces the chosen live match or fresh report',async()=>{
 const original=await initial();
 for(const status of ['LIVE','FT']){const s=snapshot();s.fixtures[0].status=status;s.fixtures[0].goals={home:2,away:1};s.fixtures.push({...fixture(3,kickoff+86400000,c,d),round:'Ronde 1'});
  const next=await update(s,original,options(kickoff+7200000));assert.equal(next.featured.fixtureId,1);assert.equal(next.featured.phase,status==='FT'?'report':'preview');assert.equal(next.nextFeatured.fixtureId,2);
 }
});
