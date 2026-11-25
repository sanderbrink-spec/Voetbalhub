'use strict';
// Head editor: planning only. No claim, approval, retry-budget or publication
// permission is produced here. Existing evidence and independent gates decide.
const EURO=new Set(['Champions League','Europa League','Conference League']);
const DUTCH=/\b(?:ajax|psv|feyenoord|az|fc twente|fc utrecht|go ahead eagles|fc groningen|oranje)\b/i;
const IMPACT=/\b(?:ontslag|aangesteld|benoemd|transfer|contractverlenging|blessure|schorsing|kwalificatie|kampioen|uitschakeling|loting|opstelling)\b/i;
const HOUR=3600000;
function describe(group,now,checkpoint=0){
 const record=group?.matchRecord;
 const preview=group?.clubPreview||group?.internationalPreview;
 const title=String(record?.topic||preview?.topic||group?.[0]?.title||'');
 const date=Date.parse(record?.publishedAt||group?.[0]?.publishedAt||'');
 const age=Number.isFinite(date)?Math.max(0,(now-date)/HOUR):Infinity;
 const until=Number.isFinite(preview?.kickoff)?(preview.kickoff-now)/HOUR:Infinity;
 const european=EURO.has(record?.category)||/\b(?:champions league|europa league|conference league)\b/i.test(title);
 const national=DUTCH.test(title);
 const facts=Array.isArray(record?.verifiedFacts)?record.verifiedFacts.length:0;
 const sources=new Set((Array.isArray(group)?group:[]).map(d=>{try{return new URL(d.url).hostname.replace(/^www\./,'')}catch{return ''}}).filter(Boolean)).size;
 const urgent=Boolean(preview&&until>0&&until<=6);
 const freshFinal=Boolean(record&&age<=24);
 const freshness=age<=3?28:age<=12?22:age<=24?15:age<=48?5:0;
 const importance=(european?14:0)+(national?14:0)+(IMPACT.test(title)?10:0);
 const ready=record?Math.min(14,facts*2):Math.min(8,sources*3);
 const timeCritical=urgent?40:freshFinal?24:0;
 const score=freshness+importance+ready+timeCritical+Math.min(2,Math.max(0,checkpoint))*5;
 return {title,score,route:record?'match':preview?'preview':'news',european,national,ageHours:Number.isFinite(age)?Math.round(age*10)/10:null,hoursToKickoff:Number.isFinite(until)?Math.round(until*10)/10:null,verifiedMatchFacts:facts,sourceDomains:sources,checkpoint,reason:urgent?'imminent_verified_preview':freshFinal?'fresh_verified_final':IMPACT.test(title)?'material_news':'ordinary_news'};
}
function plan(jobs,now,checkpoint=()=>0){
 const ordered=jobs.map((item,index)=>({item,index,decision:describe(item.group,now,checkpoint(item.job,item.group))}))
  .sort((a,b)=>b.decision.score-a.decision.score||a.index-b.index);
 // Reserve a place for important non-match news when an all-match slate
 // would otherwise consume every processing slot. Never add an unqueued job.
 const firstNews=ordered.findIndex(x=>x.decision.route==='news'&&x.decision.ageHours!==null&&x.decision.ageHours<=24&&x.decision.score>=35);
 if(firstNews>=6){const [entry]=ordered.splice(firstNews,1);ordered.splice(5,0,entry);}
 return {runnable:ordered.map(x=>x.item),decisions:ordered.slice(0,20).map(x=>x.decision)};
}
function nextActions(report={}){
 const counts=report.counts||{};
 const unavailable=Object.entries(report.sources||{}).filter(([key,value])=>key!=='match'&&value?.status==='unavailable').map(([key])=>key);
 const actions=[];
 if(unavailable.length)actions.push({kind:'source_recovery',sources:unavailable});
 if((report.queue?.awaitingApprovedArtwork||0)>0)actions.push({kind:'rights_cleared_artwork',count:report.queue.awaitingApprovedArtwork});
 if((counts.generated||0)>(counts.approved||0))actions.push({kind:'editorial_quality_review',count:counts.generated-counts.approved});
 if((counts.approved||0)>(counts.stored||0))actions.push({kind:'storage_or_artwork_check',count:counts.approved-counts.stored});
 if((counts.stored||0)>(counts.published||0))actions.push({kind:'publication_check',count:counts.stored-counts.published});
 if(!(counts.queued||0))actions.push({kind:'fresh_evidence_search',reason:'no_runnable_dossiers'});
 return actions;
}
module.exports={describe,plan,nextActions};
