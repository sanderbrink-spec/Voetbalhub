'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const recovery=require('../editorial-recovery136');
const {diagnose,classifyQualityReason,main}=require('../scripts/editorial-desk-diagnostic111');
function artworkJob(matchId){return {status:'retry',failureCategory:'missing_approved_artwork',reason:'awaiting_approved_artwork',matchId,nextAttemptAt:Date.parse('2026-11-23T00:00:00Z')};}
test('111B: 41 retries are not 41 artworks and a 20-row sample is not a unique count',()=>{
 const rows=[...Array.from({length:26},(_,i)=>artworkJob('sm-'+(2000+i))),
  ...Array.from({length:15},(_,i)=>artworkJob('sm-'+(2000+i)))];
 const result=recovery.summarizeQueue105A(rows,Date.parse('2026-11-23T10:00:00Z'));
 assert.equal(result.awaitingApprovedArtwork,41);
 assert.equal(result.uniqueArtworkDossiers,26);
 assert.equal(result.duplicateArtworkRetries,15);
 assert.equal(result.unidentifiedArtworkRetries,0);
 assert.equal(result.artworkDossiers.length,20);
 assert.equal(result.artworkDossiersTruncated,true);
 const report={counts:{found:70,readable:67,eligible:5,selected:2,generated:2,approved:0,stored:0,published:0,aiRequests:9},
  queue:result,skipped:[{stage:'artwork',topic:'Chelsea - Leeds',reason:'Geen passend goedgekeurd artikelbeeld beschikbaar.'},
   {stage:'quality',topic:'Liverpool - Manchester United',reason:'Intro en alinea’s herhalen te veel dezelfde inhoud. Niet-geverifieerd tijdsverschil tussen doelpunten. Niet aangeleverd wedstrijdverloop: overwicht of dominantie.'},
   {stage:'quality',topic:'Hull - Brighton',reason:'Niet-geverifieerd tijdsverschil tussen doelpunten.'}],
  assessments:[{revision:0,approved:false,score:null},{revision:1,approved:false,score:null}],
  sourceErrors:[{source:'GDELT'}],processingErrors:[]};
 const d=diagnose(report);
 assert.equal(d.evidence.queue.artworkRetries,41);
 assert.equal(d.evidence.queue.uniqueArtworkDossiers,26);
 assert.equal(d.evidence.queue.uniqueCountComplete,true);
 assert.equal(d.evidence.qualityAffectedTopics.unsupported_timing,2);
 assert.equal(d.evidence.qualityAffectedTopics.repetition,1);
 assert.equal(d.evidence.qualityAffectedTopics.invented_dynamics,1);
 assert.equal(d.evidence.qualityAssessmentAttempts,2);
 assert.equal(d.evidence.assessedWithScores,0);
 assert.equal(d.conversion.generatedToApprovedPct,0);
 assert.equal(d.conversion.approvedToPublishedPct,null);
 assert.equal(d.safety.publishesArticles,false);
});
test('111B: unknown identities and capped legacy lists never produce a fabricated exact unique total',()=>{
 const rows=[artworkJob('sm-123'),artworkJob('sm-123'),{...artworkJob(undefined)}, {...artworkJob(undefined),clubPreviewId:'cp-1'}];
 const q=recovery.summarizeQueue105A(rows,Date.now());
 assert.equal(q.awaitingApprovedArtwork,4);
 assert.equal(q.uniqueArtworkDossiers,2);
 assert.equal(q.duplicateArtworkRetries,1);
 assert.equal(q.unidentifiedArtworkRetries,1);
 const d=diagnose({counts:{generated:0,selected:0,approved:0},queue:q,skipped:[]});
 assert.equal(d.evidence.queue.uniqueCountComplete,false);
 assert.equal(d.conversion.selectedToGeneratedPct,null);
 const legacy=diagnose({counts:{generated:2,selected:2,approved:0},
  queue:{awaitingApprovedArtwork:41,artworkDossiers:Array.from({length:20},(_,i)=>({matchId:'sm-'+i}))},
  skipped:[]});
 assert.equal(legacy.evidence.queue.uniqueArtworkDossiers,null);
 assert.equal(legacy.evidence.queue.sampleTruncated,true);
 assert.equal(legacy.evidence.queue.uniqueCountComplete,false);
});
test('111B: separated source, writing and technical failures have no unverified quality score',()=>{
 const d=diagnose({startedAt:'2026-11-23T08:00:00Z',counts:{eligible:0,selected:0,generated:0,approved:0,published:0},
  skipped:[{stage:'quality',topic:'A',reason:'Controleer namen die niet in de aangeleverde feiten staan.'},
   {stage:'quality',topic:'A',reason:'Controleer namen die niet in de aangeleverde feiten staan.'},
   {stage:'generation',topic:'B',reason:'provider error'}],
  sourceErrors:[{source:'a'}],processingErrors:[{stage:'generation'}],
  queue:{awaitingApprovedArtwork:0,uniqueArtworkDossiers:0,unidentifiedArtworkRetries:0}});
 assert.equal(d.evidence.qualityFailureRecords.unsupported_identity,2);
 assert.equal(d.evidence.qualityAffectedTopics.unsupported_identity,1);
 assert.equal(d.evidence.stageExits.generation,1);
 assert.equal(d.priorities.some(x=>x.stage==='technical'),true);
 assert.equal(d.safety.unverifiedQualityScore,null);
 assert.deepEqual(classifyQualityReason('Losse afwijzing'),['other_quality']);
});
test('111B: artifact creation is read only, and absent input does not pretend to be a healthy editorial run',()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'veldio111b-'));
 try{
  const output=path.join(root,'desk.json');
  const result=main([path.join(root,'missing.json'),output],{});
  assert.equal(result.status,'missing_report');
  assert.equal(JSON.parse(fs.readFileSync(output,'utf8')).status,'missing_report');
 }finally{fs.rmSync(root,{recursive:true,force:true});}
});
