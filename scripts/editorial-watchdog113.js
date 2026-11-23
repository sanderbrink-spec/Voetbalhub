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
module.exports={WINDOW_MS,isSafeValidationOnly,recoveryWindow};
