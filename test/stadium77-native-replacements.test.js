'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const sharp=require('sharp');
const rows=require('../image-library49.json').assets;
const queue=require('../stadium-review-queue77.json');
const gate=require('../premium-match-images72');
const desk=require('../stadium-desk74');
const expected={
 'veldio75-fctwente-preview':'e16caf69cdc26f8778b02a541135aeb5f8ee9a192408ced3a85bf11b55b9be94',
 'veldio75-necnijmegen-report':'952ecc36540a420234b939fa80fe6950e7c65c57990701bf0aec864104f77fdb',
 'veldio75-spartarotterdam-preview':'e6a43616c1063aed3f0478a9e925576420dbc7c7caef9560c8890a1a589cc884',
 'veldio75-spartarotterdam-report':'58e538b78fb0e7c223da2c25aa26620011e90f9c1613baef7895ceedc12bd0c2'
};
test('Fase 77: vier native rastervervangingen blijven volledig onder handmatige review',async()=>{
 for(const [id,sha] of Object.entries(expected)){
  const a=rows.find(x=>x.id===id);
  assert.ok(a,'Ontbreekt: '+id);
  assert.equal(a.sha256,sha);
  assert.equal(a.sourceNativeCropWidth,1672);
  assert.equal(a.sourceNativeCropHeight,941);
  assert.equal(a.approval,'pending');
  assert.equal(gate.accepted(a),false);
  assert.match(a.rightsEvidence,/controle/);
  const b=fs.readFileSync(path.resolve(__dirname,'..',a.file));
  assert.equal(crypto.createHash('sha256').update(b).digest('hex'),sha);
  const m=await sharp(b).metadata();
  assert.equal(m.width,1280);assert.equal(m.height,720);
  assert.equal(m.format,'webp');
  const q=queue.images.find(x=>x.id===id);
  assert.equal(q.sha256,sha);assert.equal(q.requiresRecreation,false);
  assert.equal(q.replacementStaged,true);
 }
 assert.equal(queue.images.length,36);
 assert.equal(queue.counts.needsRecreation,2);
 assert.equal(queue.counts.needsIndependentReview,36);
 assert.equal(desk.overview().counts['stored-awaiting-review'],36);
 assert.equal(desk.overview().counts['approved-for-use']||0,0);
 const remaining=queue.images.filter(x=>x.requiresRecreation).map(x=>x.id).sort();
 assert.deepEqual(remaining,['veldio75-sccambuur-preview','veldio75-sccambuur-report']);
});
