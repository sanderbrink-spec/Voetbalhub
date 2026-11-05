'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),M=require('../football-data47'),UI=require('../android-project/app/src/main/assets/football47');
const now=Date.parse('2026-11-04T12:00:00Z');
const fixture=(id,h,a,goals,date='2026-11-01T12:00:00Z')=>({id,home:{id:h,name:h},away:{id:a,name:a},date,status:goals?'FT':'NS',goals:goals||{home:null,away:null}});
test('round-robin totals conserve goals, wins, draws and points; tied totals share rank',()=>{const rows=M.table([fixture(1,'A','B',{home:2,away:1}),fixture(2,'B','C',{home:1,away:1}),fixture(3,'C','A',{home:2,away:0})]);assert.equal(rows.reduce((s,r)=>s+r.all.goals.for,0),rows.reduce((s,r)=>s+r.all.goals.against,0));assert.equal(rows.reduce((s,r)=>s+r.points,0),8);assert.equal(rows.find(r=>r.team.id==='C').points,4);assert.equal(rows.find(r=>r.team.id==='A').away.lose,1);const tied=M.table([fixture(1,'A','B',{home:1,away:1})]);assert.equal(tied[0].rank,tied[1].rank);});
test('exact score, correct outcome and wrong outcome score 3/1/0; no unknown or future finals',()=>{const f=fixture(1,'A','B',{home:2,away:1});assert.equal(UI.prediction({home:2,away:1},f,now).points,3);assert.equal(UI.prediction({home:4,away:0},f,now).points,1);assert.equal(UI.prediction({home:0,away:1},f,now).points,0);assert.equal(UI.prediction({home:0,away:0},fixture(2,'A','B',{home:1,away:1}),now).points,1);assert.equal(UI.prediction({home:2,away:1},{...f,date:'2026-11-05T12:00:00Z'},now).points,null);assert.equal(UI.prediction({home:2,away:1},{...f,goals:{home:null,away:null}},now).points,null);assert.equal(UI.prediction({home:2,away:1},fixture(2,'A','B',null,'2026-11-03T12:00:00Z'),now).status,'gesloten');});
test('verified award survives missing source and offline restart',()=>{const p=JSON.parse(JSON.stringify({home:1,away:1,kickoff:'2026-11-01T12:00:00Z',assessment:{points:3,checkedAt:'2026-11-02T12:00:00Z'}}));assert.deepEqual(UI.prediction(p,null,now),{points:3,status:'beoordeeld'});});
const input=()=>({competition:'eredivisie',fixtures:[fixture('a','PSV','Ajax',null,'2026-11-06T12:00:00Z')],checks:{independentlyVerified:true,commercialReuseAllowed:true,originalEntry:true,noProtectedDatabaseExtraction:true},reviewer:'Redactie',sourceUrl:'https://example.org/permission',rightsEvidence:'Eigen onafhankelijke invoer met vastgelegde toestemming.'});
test('manual publication fails closed without every approval, duplicate IDs, future final or concrete rights evidence',()=>{for(const key of Object.keys(input().checks)){const b=input();b.checks[key]=false;assert.throws(()=>M.manual(b,now));}const b=input();b.fixtures.push(b.fixtures[0]);assert.throws(()=>M.manual(b,now));const c=input();c.fixtures[0].status='FT';c.fixtures[0].goals={home:1,away:0};assert.throws(()=>M.manual(c,now));const d=input();d.rightsEvidence='gratis';assert.throws(()=>M.manual(d,now));assert.equal(M.manual(input(),now).standings.length,0);});
test('unavailable leagues never acquire fabricated standings or paid fallback; no extra remote calls',async()=>{let calls=0;const service=M.create({clock:()=>now,fetcher:()=>{calls++;throw Error();}});const s=await service.get('kkd');assert.equal(s.status,'unavailable');assert.equal(s.fixtures.length,0);assert.equal(s.standings.length,0);await service.get('kkd');assert.equal(calls,0);});
test('concurrent source requests share a request; outage retries after one minute',async()=>{let calls=0,t=now;const service=M.create({clock:()=>t,fetcher:async()=>{calls++;throw Error('offline');}});await Promise.all([service.get('bundesliga'),service.get('bundesliga')]);assert.equal(calls,1);await service.get('bundesliga');assert.equal(calls,1);t+=61000;await service.get('bundesliga');assert.equal(calls,2);});
test('shirt markup only accepts validated colours and escapes club names',()=>{const s=UI.shirt({name:'<img onerror=alert(1)>',colours:['red" onload="alert(1)','#ffffff']});assert.equal((s.match(/<img/g)||[]).length,1);assert.ok(!s.includes('onload='));assert.ok(s.includes('&lt;img'));});

test('postponed or unknown-time games never remain open for predictions',()=>{for(const status of ['PST','CANC','TBD','AWAITING'])assert.equal(UI.prediction({home:1,away:0},{...fixture(1,'A','B',null,'2026-11-05T12:00:00Z'),status},now).status,'gesloten');});

test('supplementary Eredivisie results match the same fixture and preserve known scores and IDs',()=>{
 const {supplement}=require('../football-results52');
 const now=Date.parse('2026-11-06T12:00:00Z');
 const fixture={id:'stable',status:'AWAITING',date:'2026-11-01T13:30:00Z',round:'Speelronde 11',home:{name:'Excelsior'},away:{name:'FC Twente'}};
 const match={matchday:11,season:{startDate:'2026-08-07'},utcDate:fixture.date,status:'FINISHED',
  homeTeam:{name:'SBV Excelsior',shortName:'Excelsior'},awayTeam:{name:'FC Twente',shortName:'Twente'},
  score:{duration:'REGULAR',fullTime:{home:0,away:2}}};
 const run=(rows,matches)=>supplement(rows,{competition:{code:'DED'},matches},2026,now);
 assert.deepEqual(run([fixture],[match])[0].goals,{home:0,away:2});
 assert.equal(run([fixture],[match])[0].id,'stable');
 assert.equal(run([fixture],[match])[0].resultExpiresAt,now+36*3600000);
 const final={...fixture,status:'FT',goals:{home:3,away:0}};
 assert.equal(run([final],[match])[0],final);
 for(const variants of [[match,match],[{...match,matchday:10}],[{...match,status:'IN_PLAY'}],[{...match,utcDate:'2026-11-02T13:30:00Z'}],[{...match,score:{...match.score,fullTime:{home:null,away:2}}}]]){
  assert.equal(run([fixture],variants)[0],fixture);
 }
});
