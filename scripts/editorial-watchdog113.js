'use strict';
// Pure safety gate shared by the existing watchdog. Do not initiate jobs here.
const WINDOW_MS=90*60*1000;
function isSafeValidationOnly(run) {
 return run?.event==='push' &&
  /\[validate-editorial-generation\]/i.test(String(run.head_commit?.message||''));
}
function recoveryWindow(items,now=Date.now()){
 const runs=Array.isArray(items)?items:[];
 // Do not overlap any active run, including a non-publishing dry run.
 const active=runs.some(run=>run&&run.status!=='completed');
 const recentReal=runs.some(run=>{
  if(!run||run.status!=='completed'||run.conclusion==='skipped'||isSafeValidationOnly(run))return false;
  const age=now-Date.parse(run.created_at||'');
  return Number.isFinite(age)&&age>=0&&age<WINDOW_MS;
 });
 return {allowed:!active&&!recentReal,active,recentReal};
}

// 117: cheap scout heartbeat, bounded full editorial processing. A lead is
// only a scheduling signal, not verified evidence or permission to publish.
function publicationOpportunity117(items,scoutState,now=Date.now()){
 const runs=Array.isArray(items)?items:[];
 if(runs.some(run=>run&&run.status!=='completed'))return {allowed:false,reason:'active'};
 const real=runs.filter(run=>run?.status==='completed'&&run.conclusion!=='skipped'&&!isSafeValidationOnly(run))
  .map(run=>Date.parse(run.created_at||'')).filter(at=>Number.isFinite(at)&&at<=now);
 const last=real.length?Math.max(...real):null;
 if(last===null||now-last>=75*60000)return {allowed:true,reason:'overdue'};
 if(now-last<30*60000)return {allowed:false,reason:'cooldown'};
 const scan=Date.parse(scoutState?.lastScanAt||'');
 const fresh=Number.isFinite(scan)&&scan<=now&&now-scan<=30*60000&&
  Array.isArray(scoutState?.leads)&&scoutState.leads.some(lead=>{
   const seen=Date.parse(lead?.seenAt||'');const published=Date.parse(lead?.publishedAt||'');
   return Number.isFinite(seen)&&seen>last&&seen<=scan&&
    Number.isFinite(published)&&published<=now&&now-published<=72*3600000;
  });
 return {allowed:Boolean(fresh),reason:fresh?'new_scout_lead':'no_new_lead'};
}
module.exports={WINDOW_MS,isSafeValidationOnly,recoveryWindow,publicationOpportunity117};
