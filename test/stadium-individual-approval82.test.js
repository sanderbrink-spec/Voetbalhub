'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const reviewTool=require('../scripts/stadium-approval82');
const gate=require('../premium-match-images72');
const rows=require('../image-library49.json').assets;
const findings=require('../stadium-review-findings79.json').findings;
const TARGET='veldio74-ajax-preview';
function syntheticDossier(id=TARGET){
 const t=reviewTool.template(id);
 return {...t,score:8.7,reviewer:'Controleur Testomgeving',reviewedAt:'2026-11-12',
  notes:'Lege tribunes, herkenbare thuisclubkleuren en geen score of wedstrijdgebeurtenis zichtbaar.',
  rightsEvidence:'Origineel intern vervaardigd beeld, creatiebron en bestandsidentiteit gecontroleerd in dit geïsoleerde testgeval.',
  humanConfirmation:'Ik heb dit exacte beeld zelf gecontroleerd',
  checked:Object.fromEntries(reviewTool.checks.map(x=>[x,true]))};
}
test('Fase 82: standaard beoordelingsformulier verleent geen enkele toestemming',()=>{
 const t=reviewTool.template(TARGET);
 assert.equal(t.score,null);
 assert.equal(t.reviewer,'');
 assert.equal(t.rightsEvidence,'');
 assert.ok(Object.values(t.checked).every(v=>v===false));
 assert.equal(rows.find(a=>a.id===TARGET).approval,'pending');
 assert.equal(gate.accepted(rows.find(a=>a.id===TARGET)),false);
});
test('Fase 82: volledig synthetisch dossier werkt alleen in memory; echte publicatiestatus blijft pending',()=>{
 const s=syntheticDossier();
 assert.throws(()=>reviewTool.verify(s),/Publicatiepoort weigert/);
 const raw=rows.find(x=>x.id===TARGET);
 const fixture={...raw,id:'test-approval82-isolated',manualReview115:undefined,brandingAudit115:require('../test-support/branding-fixture115')(raw.sha256)};
 const a=reviewTool.verify({...s,assetId:fixture.id},{assets:rows.map(x=>x.id===TARGET?fixture:x)});
 assert.equal(a.approval,'approved');
 assert.equal(a.visualReview.score,8.7);
 assert.equal(a.visualReview.assetSha256,s.assetSha256);
 assert.equal(a.visualReview.clubScope,'home-only');
 assert.equal(gate.accepted(a),true);
 assert.equal(rows.find(x=>x.id===TARGET).approval,'pending');
});
test('Fase 82: ontbrekende score, rechten, persoonlijke controle, bronhash of stadioncontext blokkeren',()=>{
 const sample=syntheticDossier();
 const broken=[
  {...sample,score:8.49},
  {...sample,assetSha256:'0'.repeat(64)},
  {...sample,reviewer:''},
  {...sample,rightsEvidence:'nog controleren'},
  {...sample,notes:'te kort'},
  {...sample,humanConfirmation:'nee'},
  {...sample,checked:{...sample.checked,rights:false}},
  {...sample,club:'Feyenoord'},
  {...sample,kind:'report'},
  {...sample,reviewedAt:'2030-01-01'},
 ];
 for(const v of broken)assert.throws(()=>reviewTool.verify(v));
});
test('Fase 82: alle acht bekende risicobeelden blijven buiten individuele vrijgave',()=>{
 assert.equal(Object.keys(findings).length,8);
 for(const id of Object.keys(findings)){
  const asset=rows.find(x=>x.id===id);
  assert.throws(()=>reviewTool.verify(syntheticDossier(id)),asset.approval==='pending'?/Bekend herstelprobleem/:/niet in afwachting/);
 }
});
test('106D-2 a rejected full-resolution quality score cannot be overwritten for the same hash',()=>{
 const desk=require('../stadium-desk74').overview();
 for(const [id,score] of [['veldio74-fcgroningen-report',8],['veldio75-sccambuur-report',7.5]]){
  const asset=rows.find(a=>a.id===id);
  assert.equal(asset.approval,'pending');
  const slot=desk.slots.find(s=>s.pendingAssetIds.includes(id));
  const item=slot.pendingImages.find(a=>a.id===id);
  const old=require('../stadium-screening84.json').candidates.find(x=>x.id===id);
  if(old.sha256!==asset.sha256){
   assert.equal(old.fullResolutionAssessment.score,score);
   assert.equal(gate.accepted(asset),false);
   assert.equal(item.fullResolutionAssessment,undefined);
   continue;
  }
  assert.equal(item.fullResolutionAssessment.score,score);
  assert.equal(item.qualityStatus,'requires-replacement');
  assert.equal(item.canRequestApproval,false);
  assert.match(item.reviewBlockReason,/Nieuw beeld vereist/);
  // Even a fabricated high rating and every checkbox must not override the
  // older exact-SHA failed assessment.
  assert.throws(()=>reviewTool.verify(syntheticDossier(id)),/Eerdere volledige-resolutiebeoordeling onder 8,5/);
 }
});
test('Fase 82: reviewdossier en UI blijven individueel, niet als batch of automatische goedkeuring',()=>{
 const fs=require('node:fs'),path=require('node:path');
 const js=fs.readFileSync(path.join(__dirname,'../public/desk.js'),'utf8');
 assert.match(js,/addStadiumReviewExport/);
 assert.match(js,/beoordelingsdossier/i);
 assert.match(js,/assetSha256:asset.sha256/);
 assert.match(js,/Ik heb dit exacte beeld zelf gecontroleerd/);
 assert.match(js,/Geen automatische goedkeuring/);
 assert.doesNotMatch(js,/autoApproveStadium/);
});

test('Fase 83: synthetische QA-dossiers worden expliciet geweigerd',()=>{
 const sample=syntheticDossier();
 for(const changes of [
  {reviewer:'Synthetic QA reviewer'},
  {notes:'Uitsluitend synthetische QA-test: lege tribunes en juiste club.'},
  {rightsEvidence:'Uitsluitend synthetisch QA-bewijs, niet voor productie.'},
  {rightsEvidence:'Placeholder rights evidence not for production.'},
 ])assert.throws(()=>reviewTool.verify({...sample,...changes}),/Synthetische of testbeoordeling/);
});
