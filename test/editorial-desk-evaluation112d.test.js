'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {audit,main}=require('../scripts/editorial-desk-evaluation112d');
function sample(){
 return {validationOnly:true,runMode:{validationOnly:true},commit:'test-sha',
  status:'validation_incomplete',outcome:'error',startedAt:'2026-11-23T12:00:00Z',
  finishedAt:'2026-11-23T12:03:00Z',
  counts:{found:70,eligible:9,selected:3,generated:2,approved:1,
   aiRequests:5,stored:0,publicationAttempts:0,published:0},
  dossierResearch:{scoutHandoffCount:1,deep:2,
   scoutHandoffs:[{kind:'unverified_scout_questions_only',agentId:'groningen',
    publicationAllowed:false,sourceEvidenceVerified:false,independentlyConfirmed:false,
    articleDraftAllowed:false,
    sourceUrls:['https://www.vi.nl/nieuws/a'],
    questions:['Welke primaire bron bevestigt deze mededeling?']}],
   topics:[{topic:'FC Groningen',status:'insufficient_dated_event_evidence'},
    {topic:'PSV',status:'awaiting_approved_artwork'}]},
  skipped:[{topic:'PSV',stage:'quality',reason:'Verkeerde minuten'},
   {topic:'Ajax',stage:'artwork',reason:'Geen passend beeld'}],
  assessments:[{topic:'PSV',revision:0,approved:false,score:null,reasons:['Geen bron']},
   {topic:'PSV',revision:1,approved:true,score:87,scores:{journalism:86,reliability:91}},
   {topic:'Groningen',revision:0,approved:false,score:82,
    scores:{journalism:83,reliability:94}}],
  validated:[{topic:'PSV',score:87,scores:{journalism:86,reliability:91}}],
  sourceErrors:[],processingErrors:[]
 };
}
test('112D: valid run reports evidence-backed handoffs and truthful independent review metrics',()=>{
 const o=audit(sample());
 assert.equal(o.schemaVersion,1124);
 assert.equal(o.runMode.validationOnly,true);
 assert.equal(o.runMode.safe,true);
 assert.equal(o.runMode.published,0);
 assert.equal(o.scoutToDesk.totalAcceptedHandoffs,1);
 assert.equal(o.scoutToDesk.questions,1);
 assert.equal(o.scoutToDesk.uniqueAgents,1);
 assert.equal(o.scoutToDesk.uniqueSourceURLs,1);
 assert.equal(o.scoutToDesk.dossierStatusCounts.awaiting_approved_artwork,1);
 assert.equal(o.scoutToDesk.factualConversion.independentAnswersToScoutQuestions,null);
 assert.equal(o.newsroom.assessedVersions,3);
 assert.equal(o.newsroom.scoredVersions,2);
 assert.equal(o.newsroom.rejectedUniqueTopics,2);
 assert.equal(o.newsroom.validatedCount,1);
 assert.equal(o.newsroom.validatedMeeting85and90,1);
 assert.equal(o.newsroom.journalismScores.mean,84.5);
 assert.equal(o.newsroom.reliabilityScores.mean,92.5);
 assert.equal(o.newsroom.aiRequests,5);
 assert.equal(o.interpretation.journalismImprovementVerified,false);
});
test('112D: no dossier scan is unknown, never misreported as zero scout handoffs',()=>{
 const r=sample();delete r.dossierResearch;
 const o=audit(r);
 assert.equal(o.scoutToDesk.measurementAvailable,false);
 assert.equal(o.scoutToDesk.totalAcceptedHandoffs,null);
 assert.equal(o.scoutToDesk.questions,null);
 assert.equal(o.scoutToDesk.uniqueAgents,null);
 assert.equal(o.scoutToDesk.factualConversion.status,'not_measured');
});
test('112D: malformed or unauthorized scout memo triggers warning and cannot masquerade as approval',()=>{
 const r=sample();
 r.dossierResearch.scoutHandoffs.push({kind:'unverified_scout_questions_only',
  agentId:'transfers',publicationAllowed:true,independentlyConfirmed:true,
  sourceEvidenceVerified:true,articleDraftAllowed:true,questions:['Welke bronnen?']});
 const o=audit(r);
 assert.equal(o.runMode.safe,false);
 assert.ok(o.runMode.warnings.includes('unsafe_scout_handoff_in_report'));
 assert.equal(o.scoutToDesk.totalAcceptedHandoffs,1);
});
test('112D: accidental publication and non-validation mode cause explicit unsafe failure, not success metrics',()=>{
 const r=sample();
 r.validationOnly=false;r.runMode.validationOnly=false;r.counts.publicationAttempts=1;
 r.counts.published=1;r.counts.stored=1;
 const o=audit(r);
 assert.equal(o.runMode.safe,false);
 assert.ok(o.runMode.warnings.includes('not_validation_run'));
 assert.ok(o.runMode.warnings.includes('unexpected_publication_or_storage_activity'));
});
test('112D: do not count unscored revisions as having failed numerical journalism thresholds',()=>{
 const r=sample();r.assessments=[{topic:'A',approved:false,score:null,reasons:['Geen bewijs']}];r.validated=[];
 const o=audit(r);
 assert.deepEqual(o.newsroom.journalismScores,{count:0,mean:null,min:null,max:null});
 assert.equal(o.newsroom.validationPassedPct,null);
 assert.equal(o.newsroom.scoredVersions,0);
 assert.equal(o.newsroom.rejectedVersions,1);
});
test('112D: missing report produces explicit missing-report artifact, without invented evidence',()=>{
 const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'veldio-112d-'));
 try{
  const out=path.join(tmp,'evaluation.json');
  const ret=main([path.join(tmp,'absent.json'),out],{});
  assert.equal(ret.status,'missing_report');
  const parsed=JSON.parse(fs.readFileSync(out,'utf8'));
  assert.equal(parsed.interpretation.journalismImprovementVerified,false);
  assert.equal(parsed.scoutToDesk,undefined);
 }finally{fs.rmSync(tmp,{recursive:true,force:true});}
});
test('112D: existing editorial reporting process invokes safe evaluators and retains artifact',()=>{
 const y=fs.readFileSync(path.join(__dirname,'../.github/workflows/automatic-publication.yml'),'utf8');
 assert.match(y,/node scripts\/editorial-desk-evaluation112d\.js/);
 assert.match(y,/if: \$\{\{ always\(\)/);
 assert.match(y,/automatic-editorial-report/);
 assert.match(y,/\[validate-editorial-generation\]/);
});
