'use strict';
const M=require('./editorial-desk-model');
// Retry an existing *rejected* three-fact official brief precisely once after
// a verified writer fix. Do not replay old copy, scores, factual evidence,
// outdated sources, already published items or genuinely unsupported subjects.
function reopenVerifiedOfficialBrief(job,candidate,doc,now=Date.now(),maxAgeHours=72){
 if(!job||job.status!=='review'||job.failureStage!=='generation'||
    job.failureCategory!=='journalistic_rejection'||
    job.reason!=='insufficient_verified_facts'||job.shortOfficialWriterRecoveryV71)return false;
 if(!doc||typeof doc.url!=='string'||!Array.isArray(job.urls)||job.urls.length!==1||
    job.urls[0]!==doc.url||typeof doc.text!=='string')return false;
 const publishedAt=Date.parse(doc.publishedAt||'');
 if(!Number.isFinite(publishedAt)||publishedAt>now||
    now-publishedAt>Math.min(Math.max(1,maxAgeHours),72)*3600000)return false;
 const facts=candidate?.facts;
 if(!Array.isArray(facts)||facts.length<3||facts.length>3||
    facts.some(f=>typeof f?.text!=='string'||!Array.isArray(f.evidence)||f.evidence.length!==1||
      f.evidence[0].source!==0||!doc.text.includes(f.text)||
      !doc.text.includes(f.evidence[0].quote||'')||
      !f.evidence[0].quote.includes(f.text)))return false;
 if(!M.briefEligible({articleKind:candidate.kind,primaryAuthority:candidate.primaryAuthority,
   verifiedFacts:facts.map(f=>f.text),sources:[{url:doc.url}]}))return false;
 job.shortOfficialWriterRecoveryV71=true;
 job.status='pending';job.attempts=0;job.nextAttemptAt=now;job.updatedAt=now;
 delete job.checkpoint;
 return true;
}
module.exports={reopenVerifiedOfficialBrief};