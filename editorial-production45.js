'use strict';
const crypto = require('node:crypto');
const WEIGHTS = {actuality:20, reliability:25, nationalValue:20, originality:15, journalism:15, diversity:5};
const normalize = x => String(x || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
function priority(doc) {
 const title=normalize(doc.title), text=normalize(doc.title+' '+(doc.text||'').slice(0,500));
 if (/\b(kkd|keuken kampioen divisie|eerste divisie)\b/.test(title)) return /\b(promotie|degradatie|kampioen|ontslag|faillissement|licentie|record)\b/.test(title)?1:0;
 if (/\b(ajax|feyenoord|psv)\b/.test(title)) return 5;
 if (/\b(fc twente|az|fc groningen)\b/.test(title)) return 4;
 if (/\b(eredivisie|knvb|champions league|europa league|conference league|transfer|trainer)\b/.test(text)) return 3;
 return 2;
}
function assess({review, docs, evidenceIssues=[], duplicate=false, copied=false, now=Date.now(), threshold=85, eventDate}) {
 threshold=Math.max(85,Number.isFinite(threshold)?threshold:85);
 const reasons=[]; const scores={};
 for (const key of Object.keys(WEIGHTS)) {
  const value=review?.scores?.[key];
  if (!Number.isInteger(value)||value<0||value>100) reasons.push('Ontbrekende of ongeldige beoordeling: '+key);
  scores[key]=Number.isInteger(value)&&value>=0&&value<=100?value:0;
 }
 const published=Date.parse(docs?.[0]?.publishedAt||'');
 const age=Number.isFinite(published)?(now-published)/3600000:Infinity;
 // Fixture calendars often have no publication timestamp. A verified, upcoming
 // event date is the freshness evidence for a preview.
 const event=Date.parse(eventDate+'T12:00:00Z');
 const upcoming=event>now&&event-now<=8*86400000;
 scores.actuality=Math.min(scores.actuality,upcoming?100:age< -5/60?0:age<=24?100:age<=48?90:age<=72?75:0);
 if (!review||review.approved!==true||!Array.isArray(review.issues)||review.issues.length) reasons.push('Tweede feitenredacteur heeft geen volledige goedkeuring gegeven.');
 if(evidenceIssues.length) {scores.reliability=0;reasons.push(...evidenceIssues);}
 if(duplicate) {scores.diversity=0;reasons.push('Dubbel onderwerp.');}
 if(copied) {scores.originality=0;reasons.push('Woordelijke overlap met bron.');}
 if(scores.reliability<90) reasons.push('Betrouwbaarheid lager dan 90.');
 if(scores.journalism<85) reasons.push('Journalistieke kwaliteit lager dan 85.');
 for(const key of Object.keys(WEIGHTS)) if(scores[key]<70) reasons.push(key+' lager dan 70.');
 const score=Math.round(Object.keys(WEIGHTS).reduce((sum,key)=>sum+scores[key]*WEIGHTS[key]/100,0));
 if(score<threshold) reasons.push('Redactiescore lager dan '+threshold+'.');
 return {version:45,score,scores,threshold,approved:reasons.length===0,reasons,checkedAt:new Date(now).toISOString()};
}
const queueKey=docs=>crypto.createHash('sha256').update(JSON.stringify(docs.map(d=>[d.url,crypto.createHash('sha256').update(d.text).digest('hex')]))).digest('hex');
class EditorialQueue {
 constructor(records=[]) {
  if(!Array.isArray(records))throw Error('Ongeldige redactiewachtrij.');
  this.records=records;
 }
 enqueue(docs,now=Date.now()) {
  const id=queueKey(docs);let job=this.records.find(j=>j.id===id);
  if(!job){job={id,urls:docs.map(d=>d.url),status:'pending',attempts:0,createdAt:now,nextAttemptAt:now};this.records.push(job);}
  return job;
 }
 due(job,now=Date.now()) {return ['pending','retry'].includes(job.status)&&job.attempts<4&&job.nextAttemptAt<=now;}
 finish(job,status,now=Date.now(),diagnostic={}) {job.status=status;job.updatedAt=now;
  if(!['pending','retry'].includes(status))delete job.checkpoint;
  if(diagnostic.reason)job.reason=diagnostic.reason;
  if(diagnostic.stage)job.failureStage=diagnostic.stage;
  if(diagnostic.category)job.failureCategory=diagnostic.category;
 }
 fail(job,error,now=Date.now(),{stage='verification'}={}) {
  // Provider capacity is not an unsuccessful editorial attempt. Retain the
  // existing attempt budget and wait until the provider permits another call.
  if(error?.code==='GROQ_DAILY_QUOTA'||(error?.code==='EDITORIAL_AI_UNAVAILABLE'&&error.availabilityCategory==='capacity')){
   const seconds=Number(error.retryAfterSeconds);
   job.status='retry';job.updatedAt=now;
   job.nextAttemptAt=now+1000*(Number.isFinite(seconds)&&seconds>0?Math.min(86400,seconds):3600);
   job.failureStage=stage;job.failureCategory='provider_quota';job.reason='provider_daily_limit';
   job.errorHash=crypto.createHash('sha256').update(error.code).digest('hex');
   return;
  }
  if(error?.code==='EDITORIAL_AI_UNAVAILABLE'){
   job.attempts++;job.updatedAt=now;job.status=job.attempts<4?'retry':'review';
   job.nextAttemptAt=now+1000*Math.max(60,Number(error.retryAfterSeconds)||3600);
   job.failureStage=stage;job.failureCategory='provider_'+(error.availabilityCategory||'unavailable');
   job.reason=error.availabilityCategory==='invalid_response'?'invalid_provider_json':error.availabilityCategory==='authentication'?'provider_authentication_failed':'external_service_unavailable';
   job.errorHash=crypto.createHash('sha256').update(error.code+job.reason).digest('hex');
   return;
  }
  job.attempts++;job.updatedAt=now;
  // Never mistake quoted source wording (e.g. "tijdelijk de leiding") for an
  // HTTP/provider outage inside a rejected quality assessment.
  const qualityRejection=stage==='quality'&&/^Kwaliteitscontrole na \d+ herschrijvingen:/.test(String(error?.message||''));
  const invalidRequest=error?.code==='GROQ_BAD_REQUEST'||/HTTP 400\b/.test(String(error?.message||''));
  // An explicit evidence-based writer skip is a journalistic decision, not a
  // broken service. It must never be mistaken for an approved article.
  const insufficientFacts=stage==='generation'&&error?.status===422&&
   /^Onvoldoende gecontroleerde feiten voor een inhoudelijk concept\./.test(String(error?.message||''));
  const transient=!qualityRejection&&!invalidRequest&&(error?.code==='GROQ_DAILY_QUOTA'||/HTTP (429|5\d\d)|timeout|timed out|fetch failed|network|tijdelijk|onbereikbaar|niet beschikbaar/i.test(error?.message||''));
  job.status=transient&&job.attempts<4?'retry':'review';
  job.nextAttemptAt=now+Math.min(24*3600000,3600000*2**(job.attempts-1));
  // Public queue stores URLs and machine status only, never source text, tokens or model output.
  const software=error instanceof ReferenceError||error instanceof TypeError||error instanceof SyntaxError;
  job.failureStage=stage;
  job.failureCategory=transient?'temporary_source_failure':stage==='storage'?'storage_failure':stage==='publication'?'publication_failure':insufficientFacts?'journalistic_rejection':software||stage==='generation'?'generator_failure':'journalistic_rejection';
  if(software&&stage==='quality')job.failureCategory='quality_control_failure';
  job.reason=transient?'external_service_unavailable':software?'software_error':stage==='storage'?'storage_error':stage==='publication'?'publication_error':insufficientFacts?'insufficient_verified_facts':stage==='generation'?'generation_error':'editorial_review_required';
  // Hash links the detailed artifact error without publishing source text or secrets.
  job.errorHash=crypto.createHash('sha256').update(String(error?.message||'')).digest('hex');
 }
 prune(now=Date.now()) {for(const job of this.records)if(!['pending','retry'].includes(job.status)||now-(job.updatedAt||job.createdAt)>86400000)delete job.checkpoint;this.records=this.records.filter(j=>now-(j.updatedAt||j.createdAt)<7*86400000).slice(-500);}
}
async function openQueue({token,branch,fetcher=fetch}) {
 const endpoint='https://api.github.com/repos/sanderbrink-spec/Voetbalhub/contents/editorial-queue45.json';
 const headers={Authorization:'Bearer '+token,Accept:'application/vnd.github+json','Content-Type':'application/json'};
 const response=await fetcher(endpoint+'?ref='+branch,{headers,signal:AbortSignal.timeout(25000)});
 let sha,records=[],capacity={};
 if(response.ok){const data=await response.json();sha=data.sha;const saved=JSON.parse(Buffer.from(data.content,'base64').toString());records=saved.records;capacity=saved.capacity||{};}
 else if(response.status!==404)throw Error('Redactiewachtrij niet beschikbaar: HTTP '+response.status);
 const queue=new EditorialQueue(records);
 async function save(){
  queue.prune();
  const result=await fetcher(endpoint,{method:'PUT',headers,signal:AbortSignal.timeout(25000),body:JSON.stringify({branch,message:'Checkpoint editorial queue [skip ci]',...(sha?{sha}:{}),content:Buffer.from(JSON.stringify({version:45,records:queue.records,capacity})).toString('base64')})});
  if(!result.ok)throw Error('Redactiewachtrij niet opgeslagen: HTTP '+result.status);
  const data=await result.json();sha=data.content.sha;
 }
 return {queue,save,capacity};
}
module.exports={WEIGHTS,priority,assess,EditorialQueue,openQueue};
