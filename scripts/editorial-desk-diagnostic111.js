'use strict';
// Publicatiedesk 111B: read-only evidence-based bottleneck audit.
// Never approves, edits, queues, generates or publishes an article.
const fs=require('node:fs');
const path=require('node:path');
const safeCount=x=>Number.isSafeInteger(x)&&x>=0?x:null;
const ratio=(a,b)=>a!==null&&b!==null&&b>0?Math.round(1000*a/b)/10:null;
const rules=Object.freeze({
 repetition:/\b(?:herhal\w*|dezelfde inhoud|intro en alinea|dubbele alinea)\b/i,
 unsupported_timing:/\b(?:niet-geverifieerd tijdsverschil|blessuretijd door over de rust|chronolog\w*|rustovergang|minuut\w* in de verkeerde)\b/i,
 unsupported_identity:/\b(?:namen die niet|onbewezen speler|niet geverifieerde speler|niet bewezen naam|identiteit)\b/i,
 invented_dynamics:/\b(?:overwicht|dominantie|niet aangeleverd wedstrijdverloop|comeback|onbewezen spelbeeld)\b/i,
 evidence_shortage:/\b(?:onvoldoende gecontroleerde feiten|onvoldoende onafhankelijke feiten|ontbrekend bewijs|zonder tweede bron)\b/i
});
function classifyQualityReason(reason){
 const result=[];
 for(const [code,pattern] of Object.entries(rules))if(pattern.test(String(reason||'')))result.push(code);
 return result.length?result:['other_quality'];
}
function diagnose(report){
 if(!report||typeof report!=='object'||Array.isArray(report)||!report.counts||
  typeof report.counts!=='object'||!Array.isArray(report.skipped))
  throw Error('Niet-herkend redactierapport.');
 const c=report.counts,q=report.queue||{};
 const skipped=report.skipped.filter(x=>x&&typeof x==='object');
 const assessments=Array.isArray(report.assessments)?report.assessments.filter(x=>x&&typeof x==='object'):[];
 const stageExits={};
 const quality={};
 const qualityTopicSets={};
 for(const row of skipped){
  const stage=typeof row.stage==='string'&&row.stage.length<40?row.stage:'unknown';
  stageExits[stage]=(stageExits[stage]||0)+1;
  if(stage!=='quality')continue;
  for(const code of classifyQualityReason(row.reason)){
   if(!qualityTopicSets[code])qualityTopicSets[code]=new Set();
   // Empty topic cannot be silently treated as one unique dossier.
   if(typeof row.topic==='string'&&row.topic.trim())qualityTopicSets[code].add(row.topic.trim());
   quality[code]=(quality[code]||0)+1;
  }
 }
 const qualityAssessmentAttempts=assessments.length;
 const assessedWithScores=assessments.filter(x=>x.scores&&
  Number.isFinite(x.scores.journalism)&&Number.isFinite(x.scores.reliability));
 const sampledDossiers=Array.isArray(q.artworkDossiers)?q.artworkDossiers:[];
 const newUnique=safeCount(q.uniqueArtworkDossiers);
 const unidentified=safeCount(q.unidentifiedArtworkRetries);
 const awaiting=safeCount(q.awaitingApprovedArtwork);
 // A list of up to 20 samples is never the total number of unique jobs.
 const queue={
  artworkRetries:awaiting,
  uniqueArtworkDossiers:newUnique,
  duplicateArtworkRetries:safeCount(q.duplicateArtworkRetries),
  unidentifiedArtworkRetries:unidentified,
  uniqueCountComplete:newUnique!==null&&unidentified===0,
  dossierSampleSize:sampledDossiers.length,
  sampleTruncated:q.artworkDossiersTruncated===true||
   (awaiting!==null&&awaiting>sampledDossiers.length),
  technicalReview:safeCount(q.technicalReview)
 };
 const reported={found:safeCount(c.found),readable:safeCount(c.readable),
  eligible:safeCount(c.eligible),selected:safeCount(c.selected),
  generated:safeCount(c.generated),approved:safeCount(c.approved),
  stored:safeCount(c.stored),published:safeCount(c.published),
  aiRequests:safeCount(c.aiRequests)};
 const evidence={
  reported,queue,stageExits,
  qualityFailureRecords:quality,
  qualityAffectedTopics:Object.fromEntries(Object.entries(qualityTopicSets).map(([code,topics])=>[code,topics.size])),
  qualityAssessmentAttempts,assessedWithScores:assessedWithScores.length,
  sourceErrorRecords:Array.isArray(report.sourceErrors)?report.sourceErrors.length:0,
  processingErrorRecords:Array.isArray(report.processingErrors)?report.processingErrors.length:0,
  routeCounts:report.routes||{}
 };
 const priority=[];
 if(awaiting>0)priority.push({
  stage:'artwork',
  count:awaiting,
  unit:'retry records, not unique images',
  action:'Beoordeel bestaande pending beelden individueel; bepaal nieuwe creatietaken uit complete unieke dossier-ID’s, niet uit het retryaantal.'
 });
 const qualityRejected=stageExits.quality||0;
 if(qualityRejected>0)priority.push({
  stage:'writing_and_factcheck',
  count:qualityRejected,unit:'rejected topics this run',
  action:'Herstel de meest frequente bewezen schrijffout per dossier; controleer nieuwe versies tegen dezelfde feiten en onafhankelijke 85/90-poort.'
 });
 if(evidence.sourceErrorRecords>0)priority.push({
  stage:'sources',count:evidence.sourceErrorRecords,unit:'source error records',
  action:'Onderzoek mislukte bronopvragingen zonder uitgeversinhoud of claims te verzinnen.'
 });
 if(evidence.processingErrorRecords>0)priority.push({
  stage:'technical',count:evidence.processingErrorRecords,unit:'processing error records',
  action:'Herstel daadwerkelijke technische fouten afzonderlijk van journalistieke afwijzingen.'
 });
 return {
  schemaVersion:1112,kind:'readonly_publication_desk_diagnostic',
  run:{startedAt:report.startedAt||null,finishedAt:report.finishedAt||null,
   commit:report.commit||null,outcome:report.outcome||null,status:report.status||null},
  evidence,
  conversion:{
   eligibleToSelectedPct:ratio(reported.selected,reported.eligible),
   selectedToGeneratedPct:ratio(reported.generated,reported.selected),
   generatedToApprovedPct:ratio(reported.approved,reported.generated),
   approvedToPublishedPct:ratio(reported.published,reported.approved)
  },
  priorities:priority,
  safety:{changesContent:false,approvesArticles:false,approvesImages:false,
   publishesArticles:false,unverifiedQualityScore:null}
 };
}
function main(argv=process.argv.slice(2),env=process.env){
 const input=path.resolve(argv[0]||'.automatic-output/report.json');
 const output=path.resolve(argv[1]||'.automatic-output/desk-diagnostic111.json');
 let diagnostic;
 if(!fs.existsSync(input)){
  diagnostic={schemaVersion:1112,kind:'readonly_publication_desk_diagnostic',
   status:'missing_report',safety:{changesContent:false,publishesArticles:false}};
 }else{
  diagnostic=diagnose(JSON.parse(fs.readFileSync(input,'utf8')));
 }
 fs.mkdirSync(path.dirname(output),{recursive:true});
 fs.writeFileSync(output,JSON.stringify(diagnostic,null,2)+'\n');
 if(env.GITHUB_STEP_SUMMARY){
  const q=diagnostic.evidence?.queue||{},c=diagnostic.evidence?.reported||{};
  fs.appendFileSync(env.GITHUB_STEP_SUMMARY,[
   '## Publicatiedesk 111B (alleen lezen)',
   'Status: '+(diagnostic.run?.status||diagnostic.status||'onbekend')+'. Geen content, rechten of publicaties aangepast.',
   'Schrijfronde: '+(c.generated??'onbekend')+' concepten, '+(c.approved??'onbekend')+' goedgekeurd.',
   'Beeldwachtrij: '+(q.artworkRetries??'onbekend')+' retries, '+(q.uniqueArtworkDossiers??'nog niet gemeten')+' unieke bekende dossiers; identificatie compleet: '+Boolean(q.uniqueCountComplete)+'.',
   'Redactionele afwijzingen: '+JSON.stringify(diagnostic.evidence?.qualityAffectedTopics||{}),
   'Prioriteiten: '+JSON.stringify((diagnostic.priorities||[]).map(x=>({stage:x.stage,count:x.count,unit:x.unit}))),
   ''
  ].join('\n')+'\n');
 }
 process.stdout.write(JSON.stringify({status:diagnostic.run?.status||diagnostic.status,
  queue:diagnostic.evidence?.queue||null,priorities:diagnostic.priorities?.map(x=>x.stage)||[]})+'\n');
 return diagnostic;
}
if(require.main===module)try{main();}catch(error){console.error(error.message);process.exitCode=1;}
module.exports={diagnose,classifyQualityReason,main};
