'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const matches=require('../editorial-match55');
const guidance=require('../editorial-match-guidance133');
const recovery=require('../editorial-recovery136');
const desk=require('../editorial-desk-model');
const now=Date.parse('2026-11-09T10:00:00Z');
const base=()=>({
 id:'sm-19714597',competition:'eredivisie',resultSource:'Sportmonks Football API',
 resultExpiresAt:now+3600000,status:'FT',date:'2026-11-08T15:00:00Z',
 home:{name:'FC Twente'},away:{name:'Ajax'},goals:{home:2,away:2},
 halfTime:{home:1,away:1},round:'Speelronde 12'
});
const timeline=[
 {minute:15,extra:0,kind:'goal',player:'Speler Een',home:1,away:0},
 {minute:22,extra:0,kind:'goal',player:'Speler Twee',home:1,away:1},
 {minute:70,extra:0,kind:'goal',player:'Speler Drie',home:2,away:1},
 {minute:86,extra:0,kind:'goal',player:'Speler Vier',home:2,away:2}
];
test('half-time alone produces only a compact score update, never fabricated match depth',()=>{
 const record=matches.candidate(base(),now);
 assert.equal(record.articleKind,'score_update');
 assert.equal(record.verifiedFacts.length,3);
 const plan=guidance.paragraphPlan(record);
 assert.equal(plan.format,'compact');
 assert.deepEqual(plan.lead,['F1']);
 assert.deepEqual(plan.body[0].factIds,['F2','F3']);
 assert.match(guidance.writingPrompt(record),/EXACT ÉÉN/);
 assert.equal(desk.draftIssues({
  headline:'FC Twente en Ajax spelen gelijk in Enschede',
  standfirst:'FC Twente en Ajax sloten hun competitieduel af met een gelijkspel van 2-2.',
  body:['Het duel vond plaats op 8 november in de Eredivisie, tijdens speelronde 12. Bij rust was de stand 1-1.']
 },true).some(s=>s.startsWith('Tekst: 3 tot 5')),false);
});
test('a verified four-goal sequence supports a three-section detailed plan',()=>{
 const record=matches.candidate({...base(),goalTimeline:timeline},now);
 assert.equal(record.articleKind,'match_report');
 assert.equal(record.verifiedFacts.length,7);
 const plan=guidance.paragraphPlan(record);
 assert.equal(plan.format,'rich');
 assert.equal(plan.body.length,3);
 assert.deepEqual(plan.body[0].factIds,['F2','F3']);
 assert.deepEqual(plan.body[1].factIds,['F4','F5']);
 assert.deepEqual(plan.body[2].factIds,['F6','F7']);
 assert.equal(new Set(plan.body.flatMap(x=>x.factIds)).size,6);
 assert.match(guidance.writingPrompt(record),/EXACT DRIE/);
 assert.deepEqual(guidance.allowedScores(record.verifiedFacts).sort(),['1-0','1-1','2-1','2-2']);
});
test('a prior v136 rejection receives one genuine new v137 review only while recent',()=>{
 const record=matches.candidate({...base(),goalTimeline:timeline},now);
 const job={status:'review',matchId:record.matchId,attempts:1,failureStage:'quality',
 failureCategory:'journalistic_rejection',writerRecoveryRevision:'match-writer-136',
 checkpoint:{draft:{headline:'rejected'}}};
 assert.equal(recovery.reopenVerifiedMatch(job,record,now),true);
 assert.equal(job.status,'pending');
 assert.equal(job.checkpoint,undefined);
 job.status='review';
 assert.equal(recovery.reopenVerifiedMatch(job,record,now),false);
 assert.equal(recovery.reopenVerifiedMatch({...job,writerRecoveryRevision:'match-writer-136'},
  {...record,publishedAt:'2026-10-30T12:00:00Z'},now),false);
});
