'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {reopenRichSportmonksV132}=require('../scripts/automatic-publication');
const now=Date.parse('2026-11-09T12:00:00Z');
const record={matchId:'sm-19714600',articleKind:'match_report',verifiedFacts:['score','date','goal 1','goal 2','goal 3']};
const rejection=()=>({matchId:'sm-19714600',status:'review',failureStage:'quality',failureCategory:'journalistic_rejection',attempts:1});
test('one rich match may be rewritten once under the corrected full-story quality gates',()=>{
 const job=rejection();assert.equal(reopenRichSportmonksV132(job,record,now),true);
 assert.equal(job.status,'pending');assert.equal(job.nextAttemptAt,now);
 job.status='review';assert.equal(reopenRichSportmonksV132(job,record,now+1000),false);
});
test('no reopening of unrelated, low-evidence, technical or prior-score rejections',()=>{
 for(const job of [{...rejection(),matchId:'of-nl-2026-a-b'},{...rejection(),failureCategory:'provider_quota'},{...rejection(),failureStage:'generation'},{...rejection(),status:'published'}]){
  assert.equal(reopenRichSportmonksV132(job,record,now),false);
 }
 assert.equal(reopenRichSportmonksV132(rejection(),{...record,articleKind:'score_update'},now),false);
 assert.equal(reopenRichSportmonksV132(rejection(),{...record,verifiedFacts:['score','date']},now),false);
});
