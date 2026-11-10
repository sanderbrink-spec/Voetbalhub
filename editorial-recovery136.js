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

// The new end-to-end run rejected only unsupported comeback wording and the
// artificial 3/2 scoring split. A genuine source-bound half-break repair
// justifies one more full 85/90 review, never silent acceptance.
function reopenUtrechtNecHalfTimeV71(job,record,now=Date.now()){
 const observed='38868ad260058cc8ed3623f523cb24308a0d668fee874e2e4b5a9e2ac73dd6b3';
 const at=Date.parse(record?.publishedAt||'');
 if(!job||!record||record.matchId!=='sm-19714594'||job.matchId!==record.matchId||
    record.articleKind!=='match_report'||!Array.isArray(record.verifiedFacts)||
    record.verifiedFacts.length<5||!Number.isFinite(at)||at>now||now-at>72*3600000||
    job.status!=='review'||job.failureStage!=='quality'||
    job.failureCategory!=='journalistic_rejection'||job.errorHash!==observed||
    job.utrechtNecHalfTimeRecoveryV71)return false;
 job.utrechtNecHalfTimeRecoveryV71=true;
 job.status='pending';job.attempts=0;job.nextAttemptAt=now;job.updatedAt=now;
 delete job.checkpoint;
 return true;
}

// The exact last production rejection after verified half-time repair is
// unsupported passive "achterstand" language, not a missing registered goal.
function reopenUtrechtNecPassiveLanguageV71(job,record,now=Date.now()){
 const observed='e6d65c46095e7da26e5ffa5f80463c05343faabe60d43ac2ca274f9289b88e03';
 const at=Date.parse(record?.publishedAt||'');
 if(!job||!record||record.matchId!=='sm-19714594'||job.matchId!==record.matchId||
    record.articleKind!=='match_report'||!Array.isArray(record.verifiedFacts)||
    record.verifiedFacts.length<5||!Number.isFinite(at)||at>now||now-at>72*3600000||
    job.status!=='review'||job.failureStage!=='quality'||
    job.failureCategory!=='journalistic_rejection'||job.errorHash!==observed||
    job.utrechtNecPassiveLanguageRecoveryV71)return false;
 job.utrechtNecPassiveLanguageRecoveryV71=true;
 job.status='pending';job.attempts=0;job.nextAttemptAt=now;job.updatedAt=now;
 delete job.checkpoint;
 return true;
}

// The current Sportmonks scorer/team facts were not included in the previous
// independent review. A new reviewed manuscript is permitted for the exact
// rejected match only after the verified event IDs supply club attribution.
function reopenUtrechtNecScorerClubV71(job,record,now=Date.now()){
 const observed='45005172fee74f9622f64cd26f286956971683b3ba944a2e408cd4da979c5f5c';
 const at=Date.parse(record?.publishedAt||'');
 if(!job||!record||record.matchId!=='sm-19714594'||job.matchId!==record.matchId||
    record.articleKind!=='match_report'||!Array.isArray(record.verifiedFacts)||
    !record.verifiedFacts.some(f=>String(f).includes('Sportmonks-participantregistratie koppelt'))||
    !Number.isFinite(at)||at>now||now-at>72*3600000||
    job.status!=='review'||job.failureStage!=='quality'||
    job.failureCategory!=='journalistic_rejection'||job.errorHash!==observed||
    job.utrechtNecScorerClubRecoveryV71)return false;
 job.utrechtNecScorerClubRecoveryV71=true;
 job.status='pending';job.attempts=0;job.nextAttemptAt=now;job.updatedAt=now;
 delete job.checkpoint;
 return true;
}

// Exactly the recorded post-PR200 rejection. The prior retry flags remain
// one-shot; this newly corrected false chronology/comeback path gets one
// independent review without reusing drafts or bypassing 85/90.
function reopenUtrechtNecDualScorerV71(job,record,now=Date.now()){
 const observed='e6d65c46095e7da26e5ffa5f80463c05343faabe60d43ac2ca274f9289b88e03';
 const at=Date.parse(record?.publishedAt||'');
 if(!job||!record||record.matchId!=='sm-19714594'||job.matchId!==record.matchId||
    record.articleKind!=='match_report'||!Array.isArray(record.verifiedFacts)||
    !record.verifiedFacts.some(f=>String(f).includes('Dusan Tadic als doelpuntenmaker aan NEC Nijmegen'))||
    !Number.isFinite(at)||at>now||now-at>72*3600000||
    job.status!=='review'||job.failureStage!=='quality'||
    job.failureCategory!=='journalistic_rejection'||job.errorHash!==observed||
    job.utrechtNecDualScorerRecoveryV71)return false;
 job.utrechtNecDualScorerRecoveryV71=true;
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
module.exports={REVISION,reopenVerifiedMatch,reopenUtrechtNecAfterChronologyV71,reopenUtrechtNecScoreOrientationV71,reopenUtrechtNecHalfTimeV71,reopenUtrechtNecPassiveLanguageV71,reopenUtrechtNecScorerClubV71,reopenUtrechtNecDualScorerV71,publicationBlocker};
