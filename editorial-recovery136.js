'use strict';

// A bounded recovery for the explicitly documented November 9 match-writing
// failures. Never reuse a rejected article, reset standards or retry stale data.
const REVISION='match-writer-136';
function reopenVerifiedMatch(job,record,now=Date.now()){
 if(!job||!record||!/^sm-\d+$/.test(record.matchId||'')||
  job.matchId!==record.matchId||
  !['score_update','match_report'].includes(record.articleKind)||
  !Array.isArray(record.verifiedFacts)||record.verifiedFacts.length<2||
  !(Date.parse(record.publishedAt)<=now && now-Date.parse(record.publishedAt)<=48*3600000)||
  job.status!=='review'||job.failureStage!=='quality'||
  job.failureCategory!=='journalistic_rejection'||job.writerRecoveryRevision===REVISION)return false;
 job.writerRecoveryRevision=REVISION;
 // This replaces, rather than stacks with, the older rich-match retry.
 if(record.articleKind==='match_report' &&
   (record.matchEvidence||record.verifiedFacts.length>=5))
  job.richSportmonksRecoveryV132=true;
 job.status='pending';job.attempts=0;job.nextAttemptAt=now;
 delete job.checkpoint;
 return true;
}
function publicationBlocker(report){
 const c=report?.counts||{};
 if(c.published>0)return null;
 if(c.uniqueGroups>0&&c.queued===0&&c.attempted===0&&report.queue?.review>0)
  return 'editorial_stalled';
 if(c.generated>0&&c.approved===0&&c.published===0)
  return 'editorial_rejected';
 return null;
}
module.exports={REVISION,reopenVerifiedMatch,publicationBlocker};
