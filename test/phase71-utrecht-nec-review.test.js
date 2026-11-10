'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {reopenUtrechtNecAfterChronologyV71}=require('../editorial-recovery136');
const observed='1c192ff599130a4d8a4d698c0efb797c02796c6a486b5f57021a32599c1b4460';
const match={matchId:'sm-19714594',articleKind:'match_report',publishedAt:'2026-11-08T15:00:00Z',verifiedFacts:['a','b','c','d','e','f','g','h']};
const make=()=>({matchId:match.matchId,status:'review',failureStage:'quality',failureCategory:'journalistic_rejection',errorHash:observed,checkpoint:'old-rejected',attempts:2});
test('Fase 71: exactly one bounded fresh review after corrected registered match timeline',()=>{
 const job=make(),now=Date.parse('2026-11-10T18:00:00Z');
 assert.equal(reopenUtrechtNecAfterChronologyV71(job,match,now),true);
 assert.equal(job.status,'pending');
 assert.equal(job.attempts,0);
 assert.equal(job.checkpoint,undefined);
 assert.equal(reopenUtrechtNecAfterChronologyV71(job,match,now),false);
});
test('Fase 71: no replay for unsupported results, other games, stale data, or prior retry',()=>{
 const now=Date.parse('2026-11-10T18:00:00Z');
 for(const [job,record,time] of [
   [{...make(),errorHash:'unverified'},match,now],
   [make(),{...match,matchId:'sm-999'},now],
   [make(),{...match,articleKind:'score_update'},now],
   [make(),{...match,verifiedFacts:['a','b']},now],
   [make(),match,now+100*3600000],
   [{...make(),utrechtNecChronologyRecoveryV71:true},match,now],
   [{...make(),failureCategory:'generator_failure'},match,now]
 ])assert.equal(reopenUtrechtNecAfterChronologyV71(job,record,time),false);
});
