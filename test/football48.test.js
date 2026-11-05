'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const M=require('../football-data47');
const now=Date.parse('2026-11-05T12:00:00Z');
const rows=()=>Array.from({length:306},(_,i)=>({matchID:i+1,leagueShortcut:'bl1',leagueSeason:2026,team1:{teamId:1,teamName:'A'},team2:{teamId:2,teamName:'B'},matchDateTimeUTC:'2026-12-01T12:00:00Z',matchIsFinished:false,matchResults:[]}));
const response=()=>({ok:true,text:async()=>JSON.stringify(rows())});
test('Redis read failure does not disable an independent licensed provider',async()=>{
 let calls=0;const s=M.create({clock:()=>now,redis:{isReady:true,get:async()=>{throw Error('storage offline');}},fetcher:async()=>{calls++;return response();}});
 assert.equal((await s.get('bundesliga')).fixtures.length,306);assert.equal(calls,1);
 assert.equal((await s.get('eredivisie')).status,'source_unavailable');
});
test('cached-source failures are coalesced and retry at most once per minute without renewing dates',async()=>{
 let time=now,calls=0,offline=false;const s=M.create({clock:()=>time,fetcher:async()=>{calls++;if(offline)throw Error('offline');return response();}});
 const first=await s.get('bundesliga');offline=true;time+=16*60000;
 const cached=await s.get('bundesliga');assert.equal(cached.status,'cached');assert.equal(cached.updatedAt,first.updatedAt);
 await Promise.all(Array.from({length:30},()=>s.get('bundesliga')));assert.equal(calls,2);
 time+=61000;await s.get('bundesliga');assert.equal(calls,3);
 time=now+37*3600000;const expired=await s.get('bundesliga');assert.equal(expired.status,'source_unavailable');assert.equal(expired.fixtures.length,0);
});
test('new manual entries never renew older fixture checks, including cached reads',async()=>{
 const value=M.envelope('eredivisie',[],now,{name:'Veldio · handmatig gecontroleerd'});
 value.fixtures=[{id:'old',checkedAt:new Date(now-35*3600000).toISOString()},{id:'new',checkedAt:new Date(now).toISOString()}];
 let time=now;const s=M.create({clock:()=>time,redis:{isReady:true,get:async()=>JSON.stringify(value)}});
 assert.equal((await s.get('eredivisie')).fixtures.length,2);time+=2*3600000;
 assert.deepEqual((await s.get('eredivisie')).fixtures.map(f=>f.id),['new']);
 assert.equal(value.fixtures.length,2);
});
test('oversized decompressed source responses stop reading before unbounded allocation',async()=>{
 let chunks=0;const body={async *[Symbol.asyncIterator](){for(let i=0;i<100;i++){chunks++;yield Buffer.alloc(512);}}};
 await assert.rejects(M.sourceBody({body},1000),/te groot/);assert.equal(chunks,2);
});
test('prototype keys cannot select fictitious competitions',async()=>{
 const s=M.create({clock:()=>now});for(const key of ['__proto__','constructor','toString'])await assert.rejects(s.get(key),/Onbekende/);
});
