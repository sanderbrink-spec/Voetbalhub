'use strict';
// 112D: measurable, read-only newsroom validation. A research question is
// NEVER evidence of a proven claim or a publication-ready article.
const fs=require('node:fs');
const path=require('node:path');
const safeCount=x=>Number.isSafeInteger(x)&&x>=0?x:null;
const finiteScore=x=>Number.isFinite(x)&&x>=0&&x<=100?x:null;
const pct=(n,d)=>Number.isInteger(n)&&Number.isInteger(d)&&d>0?Math.round(1000*n/d)/10:null;
function audit(report){
 if(!report||typeof report!=='object'||Array.isArray(report)||
   !report.counts||!Array.isArray(report.skipped)||!Array.isArray(report.assessments))
   throw Error('Redactierapport onvolledig: beoordeling onmogelijk.');
 const mode=report.runMode||{};
 const validationOnly=report.validationOnly===true&&mode.validationOnly===true;
 const c=report.counts;
 const dossier=report.dossierResearch;
 const measured=dossier!==undefined&&dossier!==null&&typeof dossier==='object';
 const handoffs=measured&&Array.isArray(dossier.scoutHandoffs)?dossier.scoutHandoffs:null;
 const safeHandoffs=handoffs?handoffs.filter(h=>h?.kind==='unverified_scout_questions_only'&&
   h.publicationAllowed===false&&h.sourceEvidenceVerified===false&&
   h.independentlyConfirmed===false&&h.articleDraftAllowed===false):[];
 const byStage={};
 const topics=new Set();
 for(const s of report.skipped){
  const stage=typeof s?.stage==='string'&&s.stage.length<50?s.stage:'unspecified';
  byStage[stage]=(byStage[stage]||0)+1;
  if(typeof s?.topic==='string'&&s.topic.trim())topics.add(s.topic.trim());
 }
 const assessments=report.assessments.filter(a=>a&&typeof a==='object');
 const scored=assessments.filter(a=>finiteScore(a.scores?.journalism)!==null&&
  finiteScore(a.scores?.reliability)!==null);
 const approvedScored=scored.filter(a=>a.approved===true&&
  a.scores.journalism>=85&&a.scores.reliability>=90);
 const failingTopics=new Set(assessments.filter(a=>a.approved===false)
  .map(a=>a.topic).filter(t=>typeof t==='string'&&t.trim()));
 const passingTopics=new Set(approvedScored
  .map(a=>a.topic).filter(t=>typeof t==='string'&&t.trim()));
 const validated=Array.isArray(report.validated)?report.validated:[];
 const validatedAboveGates=validated.filter(v=>finiteScore(v?.scores?.journalism)!==null&&
  finiteScore(v?.scores?.reliability)!==null&&v.scores.journalism>=85&&v.scores.reliability>=90);
 const scoreStats=(key)=>{
  if(!scored.length)return {count:0,mean:null,min:null,max:null};
  const vals=scored.map(a=>a.scores[key]);
  return {count:vals.length,mean:Math.round(vals.reduce((x,y)=>x+y,0)/vals.length*10)/10,
   min:Math.min(...vals),max:Math.max(...vals)};
 };
 const statuses={};
 const topicsList=Array.isArray(dossier?.topics)?dossier.topics:[];
 for(const t of topicsList){
  const status=typeof t?.status==='string'?t.status:'unknown';
  statuses[status]=(statuses[status]||0)+1;
 }
 const factualConversion={
  status:measured?'not_attributable':'not_measured',
  independentAnswersToScoutQuestions:null,
  originalAnglesIndependentlyProven:null,
  explanation:'Het redactierapport koppelt nog geen letterlijk onafhankelijk bronbewijs aan een afzonderlijke scoutvraag. Geen conversie of kwaliteitswinst afleiden uit een notitie of protocolscore.'
 };
 const flags=[];
 if(!validationOnly)flags.push('not_validation_run');
 if(safeCount(c.published)>0||safeCount(c.publicationAttempts)>0||safeCount(c.stored)>0)
  flags.push('unexpected_publication_or_storage_activity');
 if(handoffs!==null&&safeHandoffs.length!==handoffs.length)flags.push('unsafe_scout_handoff_in_report');
 return {
  schemaVersion:1124,kind:'read_only_editorial_training_evaluation',
  commit:report.commit||null,startedAt:report.startedAt||null,finishedAt:report.finishedAt||null,
  runMode:{validationOnly,status:report.status||null,outcome:report.outcome||null,
   publicationAttempts:safeCount(c.publicationAttempts),stored:safeCount(c.stored),
   published:safeCount(c.published),safe:flags.length===0,warnings:flags},
  scoutToDesk:{
   measurementAvailable:measured,
   totalAcceptedHandoffs:handoffs===null?null:safeHandoffs.length,
   questions:handoffs===null?null:safeHandoffs.reduce((n,h)=>n+(Array.isArray(h.questions)?h.questions.length:0),0),
   uniqueAgents:handoffs===null?null:new Set(safeHandoffs.map(h=>h.agentId)).size,
   uniqueSourceURLs:handoffs===null?null:new Set(safeHandoffs.flatMap(h=>h.sourceUrls||[])).size,
   dossierStatusCounts:measured?statuses:null,
   deepInvestigations:measured?safeCount(dossier.deep):null,
   factualConversion
  },
  newsroom:{
   found:safeCount(c.found),eligible:safeCount(c.eligible),
   selected:safeCount(c.selected),generated:safeCount(c.generated),
   independentlyApproved:safeCount(c.approved),
   validatedCount:validated.length,validatedMeeting85and90:validatedAboveGates.length,
   validationPassedPct:pct(validatedAboveGates.length,validated.length),
   assessedVersions:assessments.length,scoredVersions:scored.length,
   rejectedVersions:assessments.filter(a=>a.approved===false).length,
   rejectedUniqueTopics:failingTopics.size,approvedScoredUniqueTopics:passingTopics.size,
   journalismScores:scoreStats('journalism'),reliabilityScores:scoreStats('reliability'),
   skippedByStage:byStage,skippedUniqueTopics:topics.size,
   aiRequests:safeCount(c.aiRequests),
   externalSourceErrors:Array.isArray(report.sourceErrors)?report.sourceErrors.length:null,
   processingErrors:Array.isArray(report.processingErrors)?report.processingErrors.length:null
  },
  interpretation:{
   journalismImprovementVerified:false,
   reason:'Eén validatieronde bewijst geen verandering in journalistieke kwaliteit. Vergelijk pas meerdere gelijkwaardige runs met dezelfde bronnen, tijdsperiode en onafhankelijk beoordeelde dossiers.',
   score85andReliability90StillRequired:true,
   noRightsOverride:true,createdNoNewFacts:true
  }
 };
}
function main(args=process.argv.slice(2),env=process.env){
 const file=path.resolve(args[0]||'.automatic-output/report.json');
 const out=path.resolve(args[1]||'.automatic-output/desk-evaluation112d.json');
 let result;
 if(!fs.existsSync(file)){
  result={schemaVersion:1124,kind:'read_only_editorial_training_evaluation',
   status:'missing_report',interpretation:{journalismImprovementVerified:false}};
 }else result=audit(JSON.parse(fs.readFileSync(file,'utf8')));
 fs.mkdirSync(path.dirname(out),{recursive:true});
 fs.writeFileSync(out,JSON.stringify(result,null,2)+'\n');
 if(env.GITHUB_STEP_SUMMARY){
  const summary=[
   '## Veldio 112D: onafhankelijke nulmeting (geen publicatie)',
   'Validatiemodus: '+Boolean(result.runMode?.validationOnly)+'. Veilig: '+Boolean(result.runMode?.safe)+'.',
   'Scoutvragen: '+(result.scoutToDesk?.questions??'niet gemeten')+
    ', handoffs: '+(result.scoutToDesk?.totalAcceptedHandoffs??'niet gemeten')+
    ', unieke agents: '+(result.scoutToDesk?.uniqueAgents??'niet gemeten')+'.',
   'Artikelen gevalideerd: '+(result.newsroom?.validatedCount??'niet gemeten')+
    ', voldoen aan 85/90: '+(result.newsroom?.validatedMeeting85and90??'niet gemeten')+'.',
   'Kwaliteitsafwijzingen: '+JSON.stringify(result.newsroom?.skippedByStage||{})+'.',
   'Modelaanroepen: '+(result.newsroom?.aiRequests??'niet gemeten')+'.',
   'Onafhankelijk bewezen uit scoutvragen: onbekend (nog geen traceerbare claimkoppeling).',
   'Publicaties: '+(result.runMode?.published??'niet gemeten')+'.',
   'Deze controle maakt geen artikelen, voegt geen bronfeiten toe en verandert geen rechten.',
   ''
  ].join('\n');
  fs.appendFileSync(env.GITHUB_STEP_SUMMARY,summary+'\n');
 }
 process.stdout.write(JSON.stringify({status:result.runMode?.status||result.status,
  safe:result.runMode?.safe,measuredHandoffs:result.scoutToDesk?.totalAcceptedHandoffs??null,
  validated:result.newsroom?.validatedCount??null,
  qualityImprovementVerified:false})+'\n');
 if(result.runMode&&!result.runMode.safe)process.exitCode=1;
 return result;
}
if(require.main===module)try{main();}catch(e){console.error(e.message);process.exitCode=1;}
module.exports={audit,main};
