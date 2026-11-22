'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const review=require('../stadium-visual-prescreen106d.json');
const library=require('../image-library49');
const premium=require('../premium-match-images72');
const approvals=require('../scripts/stadium-approval82');
const data=require('../image-library49.json');

test('106D exact per-image prescreen records 10 candidates and 8 held risks without release',()=>{
 assert.equal(review.candidates.length,10);
 assert.equal(review.withheld.length,8);
 assert.equal(review.approvalGranted,0);
 assert.equal(review.finalIndependentReviewCompleted,0);
 const ids=[...review.candidates,...review.withheld].map(x=>x.id);
 assert.equal(new Set(ids).size,18);
 assert.doesNotThrow(()=>library.validate(data.assets));
 for(const entry of [...review.candidates,...review.withheld]){
  const asset=data.assets.find(a=>a.id===entry.id);
  assert.ok(asset,entry.id);
  assert.equal(asset.approval,'pending',entry.id);
  assert.equal(asset.sha256,entry.sha256,entry.id);
  assert.equal(asset.file,entry.file,entry.id);
  assert.equal(asset.imageKind,'report',entry.id);
  assert.equal(asset.stadiumOccupancy,'full',entry.id);
  assert.equal(premium.accepted(asset),false,entry.id);
  const bytes=fs.readFileSync(path.resolve(__dirname,'..',entry.file));
  assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'),entry.sha256,entry.id);
  const template=approvals.template(entry.id);
  assert.equal(template.score,null,entry.id);
  assert.equal(template.reviewer,'',entry.id);
  assert.ok(Object.values(template.checked).every(value=>value===false),entry.id);
 }
});

test('106D plausible concepts are not falsely promoted to final legal or visual clearance',()=>{
 for(const entry of review.candidates){
  assert.equal(entry.recommendation,'human_review_candidate',entry.id);
  assert.ok(entry.preliminaryVisualScore>=8.5&&entry.preliminaryVisualScore<=10,entry.id);
  assert.ok(['night','twilight'].includes(entry.sceneDaypart),entry.id);
  assert.equal(entry.sceneAudience,'full',entry.id);
  assert.ok(entry.visualFindings.length>40,entry.id);
  assert.equal(data.assets.find(x=>x.id===entry.id).homeClubReusable,true,entry.id);
 }
 for(const entry of review.withheld){
  assert.equal(entry.recommendation,'hold_for_rework',entry.id);
  assert.ok(entry.reason.length>45,entry.id);
  if(['veldio73-telstar-report-evening','veldio74-az-report','veldio74-goaheadeagles-report'].includes(entry.id))
   assert.match(entry.reason,/Historisch herstelpunt/,entry.id);
 }
});
