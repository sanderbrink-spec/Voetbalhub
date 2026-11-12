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
 return {...t,score:8.7,reviewer:'Synthetic QA reviewer',reviewedAt:'2026-11-12',
  notes:'Uitsluitend synthetische QA-test: lege tribune, correcte thuisclub en geen wedstrijdscore.',
  rightsEvidence:'Uitsluitend synthetisch QA-bewijs, niet geschikt voor werkelijke commerciële vrijgave.',
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
 const a=reviewTool.verify(s);
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
 for(const id of Object.keys(findings))assert.throws(()=>reviewTool.verify(syntheticDossier(id)),/Bekend herstelprobleem/);
});
test('Fase 82: reviewdossier en UI blijven individueel, niet als batch of automatische goedkeuring',()=>{
 const fs=require('node:fs'),path=require('node:path');
 const js=fs.readFileSync(path.join(__dirname,'../public/desk.js'),'utf8');
 assert.match(js,/addStadiumReviewExport/);
 assert.match(js,/Beoordelingsdossier/);
 assert.match(js,/assetSha256:asset.sha256/);
 assert.match(js,/Ik heb dit exacte beeld zelf gecontroleerd/);
 assert.match(js,/Geen automatische goedkeuring/);
 assert.doesNotMatch(js,/autoApproveStadium/);
});
