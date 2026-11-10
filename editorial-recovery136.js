'use strict';

// One bounded recovery after fixing the observed November 9 production preflight:
// rich verified matches were incorrectly checked as compact and stored in review. Never reuse a rejected article, reset standards or retry stale data.
const REVISION='match-structure-gate-138';
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
// The live Utrecht-NEC reviewer rejected an unsupported 3-2, unproven
// comeback and minute 58 in the wrong paragraph (run 42649713550).
// PR #189 subsequently corrected the incident/goal chronology. Permit
// exactly one NEW review using that verified current record; never reuse
// the rejected manuscript or lower its factual/independent review gates.
function reopenUtrechtNecAfterChronologyV71(job,record,now=Date.now()){
 const observedHash='1c192ff599130a4d8a4d698c0efb797c02796c6a486b5f57021a32599c1b4460';
 const at=Date.parse(record?.publishedAt||'');
 if(!job||!record||record.matchId!=='sm-19714594'||
    job.matchId!==record.matchId||record.articleKind!=='match_report'||
    !Array.isArray(record.verifiedFacts)||record.verifiedFacts.length<5||
    !Number.isFinite(at)||at>now||now-at>72*3600000||
    job.status!=='review'||job.failureStage!=='quality'||
    job.failureCategory!=='journalistic_rejection'||
    job.errorHash!==observedHash||job.utrechtNecChronologyRecoveryV71)return false;
 job.utrechtNecChronologyRecoveryV71=true;
 job.status='pending';job.attempts=0;job.nextAttemptAt=now;job.updatedAt=now;
 delete job.checkpoint;
 return true;
}

// The proof run 42873738802 found only two inverse home-away score strings
// in the twice-revised Utrecht-NEC draft, despite verified 2-3 and 0-2.
// A code-level orientation repair justifies one new *full* editorial review.
function reopenUtrechtNecScoreOrientationV71(job,record,now=Date.now()){
 const observedHash='77eda278e452862d5033b25e7fd1b05e39cc9b965864d446c340a25b7de4197a';
 const at=Date.parse(record?.publishedAt||'');
 if(!job||!record||record.matchId!=='sm-19714594'||
    job.matchId!==record.matchId||record.articleKind!=='match_report'||
    !Array.isArray(record.verifiedFacts)||record.verifiedFacts.length<5||
    !Number.isFinite(at)||at>now||now-at>72*3600000||
    job.status!=='review'||job.failureStage!=='quality'||
    job.failureCategory!=='journalistic_rejection'||
    job.errorHash!==observedHash||job.utrechtNecScoreOrientationRecoveryV71)return false;
 job.utrechtNecScoreOrientationRecoveryV71=true;
 job.status='pending';job.attempts=0;job.nextAttemptAt=now;job.updatedAt=now;
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
module.exports={REVISION,reopenVerifiedMatch,reopenUtrechtNecAfterChronologyV71,reopenUtrechtNecScoreOrientationV71,publicationBlocker};
