'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const path=require('node:path');
const fs=require('node:fs');
const entries=require('../stadium-screening84.json');
const findings=require('../stadium-review-findings79.json').findings;
const rows=require('../image-library49.json').assets.filter(x=>x.homeClubReusable);
const desk=require('../stadium-desk74').overview;
const gate=require('../premium-match-images72');
test('Fase 84: individuele SHA-screening 28/8 geeft geen valse score of rechtsvrijgave',()=>{
 assert.equal(entries.candidates.length,28);
 assert.equal(Object.keys(findings).length,8);
 assert.equal(new Set(entries.candidates.map(c=>c.id)).size,28);
 assert.equal(entries.productionApprovalGranted,0);
 for(const item of entries.candidates){
  const a=rows.find(x=>x.id===item.id);
  assert.ok(a,item.id);
  if(a.sha256!==item.sha256){
   const q=require('../branding-correction-queue115.json').items.find(x=>x.id===a.id);
   assert.equal(q.originalSha256,item.sha256,item.id);assert.equal(q.correctedSha256,a.sha256,item.id);
  }
  assert.equal(a.clubs[0],item.club,item.id);
  assert.equal(a.imageKind,item.kind,item.id);
  if(a.sha256===item.sha256)assert.equal(a.approval,'pending',item.id);
  assert.equal(item.state,'screening-only',item.id);
  assert.equal(item.qualityScore,null,item.id);
  assert.equal(item.rightsReleased,false,item.id);
  assert.equal(item.hasIndependentStadiumReference,false,item.id);
  assert.equal(item.hasExactRasterPersonalReview,false,item.id);
  if(a.sha256===item.sha256)assert.equal(gate.accepted(a),false,item.id);
  assert.ok(item.preliminaryVisualNote.length>=40,item.id);
  assert.equal(Boolean(findings[item.id]),false,item.id);
 }
 const overview=desk();
 assert.equal(overview.slotsTotal,36);
 assert.equal(overview.reviewPlan.firstReview,rows.filter(a=>a.approval==='pending'&&!findings[a.id]).length);
 assert.equal(overview.reviewPlan.repairFirst,rows.filter(a=>a.approval==='pending'&&findings[a.id]).length);
 for(const slot of overview.slots){
  const candidate=slot.pendingImages[0];
  if(slot.state==='approved-for-use'){assert.equal(candidate,undefined);continue;}
  assert.ok(candidate);
  assert.equal(candidate.preliminaryScreening?.independentScore??null,null);
  assert.equal(candidate.preliminaryScreening?.rightsReleased??false,false);
  const old=entries.candidates.find(x=>x.id===candidate.id);
  if(old&&old.sha256===candidate.sha256)assert.ok(candidate.preliminaryScreening?.note.length>=40);
  else assert.equal(candidate.preliminaryScreening,null);
 }
});
test('Fase 84: visuele screeningsinformatie verschijnt alleen als voorlopige notitie',()=>{
 const ui=fs.readFileSync(path.resolve(__dirname,'../public/desk.js'),'utf8');
 assert.match(ui,/Voorlopige beeldscreening/);
 assert.match(ui,/Geen eindscore of rechtenvrijgave/);
 assert.doesNotMatch(ui,/approveFromScreening|autoApproveStadium/);
});
test('Fase 85: vier beoordelingen zijn zichtbaar zonder wijziging van de vrijgavestatus',()=>{
 const assessments=desk().slots.flatMap(slot=>slot.pendingImages)
  .filter(asset=>asset.fullResolutionAssessment);
 const exactPending=entries.candidates.filter(x=>x.fullResolutionAssessment&&rows.some(a=>a.id===x.id&&a.sha256===x.sha256&&a.approval==='pending'));
 assert.deepEqual(assessments.map(a=>a.id).sort(),exactPending.map(x=>x.id).sort());
 for(const asset of assessments){
  const entry=entries.candidates.find(item=>item.id===asset.id);
  assert.equal(asset.sha256,entry.sha256);
  assert.equal(asset.fullResolutionAssessment.decision,'pending');
  assert.ok(Number.isFinite(asset.fullResolutionAssessment.score));
  assert.equal(asset.preliminaryScreening.rightsReleased,false);
 }
 assert.equal(desk().reviewPlan.approved,rows.filter(a=>gate.accepted(a)).length);
});
