'use strict';
// Read-only live evidence. Never posts a contact message or publishes test content.
const fs=require('node:fs');
(async()=>{
 const report={checkedAt:new Date().toISOString(),physicalDevice:false,checks:{}};
 for(const path of ['/health','/ready','/articles','/integrations/statistics']){
  const start=Date.now();try{const res=await fetch('https://voetbalhub-redactie.onrender.com'+path,{signal:AbortSignal.timeout(18000),redirect:'error'});const data=await res.json();report.checks[path]={status:res.status,durationMs:Date.now()-start,...(path==='/articles'?{count:data.articles?.length,ids:data.articles?.map(a=>a.id),headlines:data.articles?.map(a=>a.headline)}:{data})};}catch(e){report.checks[path]={error:e.name,durationMs:Date.now()-start};}
 }
 report.publicTest='NO-GO';report.reason='Live mail configuration, three newly verified autonomous publications and complete integrated production rollout are not proven.';
 fs.mkdirSync('.phase35',{recursive:true});fs.writeFileSync('.phase35/production.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));
})().catch(e=>{console.error(e.message);process.exitCode=1;});
