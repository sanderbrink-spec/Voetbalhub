'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const recovery=require('../editorial-recovery136');
const facts=require('../editorial-facts');
const now=Date.parse('2026-11-09T10:00:00Z');
const validRecord={matchId:'sm-19714597',publishedAt:'2026-11-08T16:00:00Z',articleKind:'match_report',verifiedFacts:[
 'FC Twente – Ajax eindigde in 2-2.',
 'Eredivisie, speelronde 12, gespeeld op 2026-11-08.',
 'Ruststand 1-1.',
 'Volgens de Sportmonks-wedstrijdregistratie viel in minuut 24 een doelpunt van Testspeler, waarna de stand 1-0 was.',
 'Volgens de Sportmonks-wedstrijdregistratie viel in minuut 60 een doelpunt van Testspeler, waarna de stand 2-2 was.'
]};
const reviewed=()=>({status:'review',matchId:validRecord.matchId,failureStage:'quality',failureCategory:'journalistic_rejection',attempts:1,checkpoint:{draft:{headline:'rejected'}}});

test('recovers one live verified match once and never reuses the rejected draft',()=>{
 const job=reviewed();
 assert.equal(recovery.reopenVerifiedMatch(job,validRecord,now),true);
 assert.equal(job.status,'pending');
 assert.equal(job.attempts,0);
 assert.equal(job.nextAttemptAt,now);
 assert.equal(job.checkpoint,undefined);
 assert.equal(job.writerRecoveryRevision,recovery.REVISION);
 assert.equal(job.richSportmonksRecoveryV132,true);
 job.status='review';
 assert.equal(recovery.reopenVerifiedMatch(job,validRecord,now),false);
});
test('rejects stale, unrelated, unfounded and technical retries without any bypass',()=>{
 for (const [patch,edit] of [
  [{publishedAt:'2026-10-30T10:00:00Z'},{}],
  [{verifiedFacts:['Only one fact']},{}],
  [{matchId:'sm-2'},{}],
  [{articleKind:'preview'},{}],
  [{}, {failureCategory:'quality_control_failure'}],
  [{}, {failureStage:'verification'}]
 ]) {
  const job={...reviewed(),...edit};
  assert.equal(recovery.reopenVerifiedMatch(job,{...validRecord,...patch},now),false);
  assert.equal(job.status,'review');
 }
});
test('a healthy empty news round is distinct from a stalled review queue',()=>{
 const input={counts:{uniqueGroups:9,queued:0,attempted:0,generated:0,approved:0,published:0},queue:{review:65}};
 assert.equal(recovery.publicationBlocker(input),'editorial_stalled');
 assert.equal(recovery.publicationBlocker({counts:{...input.counts,uniqueGroups:0},queue:input.queue}),null);
 assert.equal(recovery.publicationBlocker({counts:{...input.counts,queued:7},queue:input.queue}),null);
 assert.equal(recovery.publicationBlocker({counts:{...input.counts,generated:8,attempted:8},queue:input.queue}),'editorial_rejected');
 assert.equal(recovery.publicationBlocker({counts:{...input.counts,generated:8,attempted:8,published:1},queue:input.queue}),null);
});
test('a verified ISO date permits precisely the corresponding Dutch calendar phrase',()=>{
 const match={homeTeam:'FC Twente',awayTeam:'Ajax',homeScore:2,awayScore:2,playedAt:'2026-11-08'};
 const draft={headline:'FC Twente en Ajax delen opnieuw de punten',standfirst:'Op 8 november speelden FC Twente en Ajax met 2-2 gelijk.',body:['Volgens de wedstrijdregistratie werd het 2-2.']};
 const issues=facts.evidenceIssues(draft,validRecord.verifiedFacts,match);
 assert.ok(!issues.some(x=>x.includes('Cijfers ontbreken')),issues.join(' | '));
 const invalid={...draft,standfirst:'Op 7 november speelden FC Twente en Ajax met 2-2 gelijk.'};
 assert.ok(facts.evidenceIssues(invalid,validRecord.verifiedFacts,match).some(x=>x.includes('Cijfers ontbreken')));
 const wrongMonth={...draft,standfirst:'Op 8 december speelden FC Twente en Ajax met 2-2 gelijk.'};
 assert.ok(facts.evidenceIssues(wrongMonth,validRecord.verifiedFacts,match).some(x=>x.includes('Cijfers ontbreken')));
});
test('known attribution is supported but does not authorize a made-up score',()=>{
 const match={homeTeam:'FC Twente',awayTeam:'Ajax',homeScore:2,awayScore:2,playedAt:'2026-11-08'};
 const draft={headline:'FC Twente en Ajax delen opnieuw de punten',standfirst:'Sportmonks Football API meldt 2-2 tussen FC Twente en Ajax.',body:['De controle bevestigt de uitslag.']};
 const allowed=facts.evidenceIssues(draft,validRecord.verifiedFacts,match,'Sportmonks Football API');
 assert.ok(!allowed.some(x=>x.includes('Football API')),allowed.join(' | '));
 const fake={...draft,standfirst:'Sportmonks Football API meldt 5-4 tussen FC Twente en Ajax.'};
 assert.ok(facts.evidenceIssues(fake,validRecord.verifiedFacts,match,'Sportmonks Football API').some(x=>x.includes('Uitslag of tussenstand')));
});
