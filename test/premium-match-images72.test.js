'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const gate=require('../premium-match-images72');
const library=require('../image-library49');
const rows=require('../image-library49.json').assets;
const original=rows.find(a=>a.id==='veldio71-twente-ajax-report');
const newAsset=(changes={})=>({...original,id:'new-premium-fixture',visualReview:{
 score:9.1,style:'photorealistic',reviewer:'Veldio independent visual reviewer',reviewedAt:'2026-11-11'
},...changes});
test('Fase 72: previously approved raster requires original SHA; flattened SVG is never accepted',()=>{
 assert.ok(original && gate.accepted(original));
 assert.equal(gate.accepted({...original,sha256:'changed-bytes'}),false);
 const retired=rows.find(a=>a.id==='veldio71-utrecht-nec-report');
 assert.equal(gate.accepted({...retired,approval:'approved',visualReview:{score:10,style:'photorealistic',reviewer:'fake approval',reviewedAt:'2026-11-11'}}),false);
 assert.equal(gate.isRetiredVector(retired),true);
 assert.equal(gate.accepted(rows.find(a=>a.file.startsWith('public/match-covers64/'))),false);
});
test('Fase 72: every new fixture asset needs explicit human premium review >= 8.5',()=>{
 assert.equal(gate.MIN_SCORE,8.5);
 assert.equal(gate.accepted(newAsset()),true);
 for(const review of [
  undefined,{score:8.49,style:'photorealistic',reviewer:'visual reviewer',reviewedAt:'2026-11-11'},
  {score:10,style:'flat-vector',reviewer:'visual reviewer',reviewedAt:'2026-11-11'},
  {score:9.5,style:'photorealistic',reviewer:'',reviewedAt:'2026-11-11'},
  {score:9.5,style:'photorealistic',reviewer:'visual reviewer',reviewedAt:'invalid'}
 ])assert.equal(gate.accepted(newAsset({visualReview:review})),false);
});
test('Fase 72: the premiere image gate verifies preview/report occupancy and ordered clubs',()=>{
 assert.equal(gate.accepted(newAsset({stadiumOccupancy:'empty'})),false);
 assert.equal(gate.accepted(newAsset({imageKind:'preview',stadiumOccupancy:'full'})),false);
 assert.equal(gate.accepted(newAsset({stadiumIdentity:'unknown'})),false);
 assert.equal(gate.accepted(newAsset({clubs:['FC Twente']})),false);
 const exact={category:'report',fixtureId:original.fixtureId,clubs:original.clubs,
  competition:'Eredivisie',daypart:'neutral'};
 assert.equal(library.choose(exact,[newAsset()]).id,'new-premium-fixture');
 assert.equal(library.choose({...exact,clubs:[...original.clubs].reverse()},[newAsset()]),null);
 assert.equal(library.choose({...exact,category:'preview'},[newAsset()]),null);
});
test('Fase 72: previously published article can be detected for reversible visual withdrawal',()=>{
 const retired=rows.find(a=>a.id==='veldio71-utrecht-nec-report');
 assert.equal(gate.isRetiredReference({status:'published',imageAssetId:retired.id},rows),true);
 assert.equal(gate.isRetiredReference({status:'published',imageUrl:'https://voetbalhub-redactie.onrender.com/article-art71/utrecht-nec-report.webp'},rows),true);
 assert.equal(gate.isRetiredReference({status:'draft',imageAssetId:retired.id},rows),false);
 assert.equal(gate.isRetiredReference({status:'published',imageAssetId:'elsewhere'},rows),false);
});
