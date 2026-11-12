'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const crypto=require('node:crypto');
const sharp=require('sharp');
const rows=require('../image-library49.json').assets;
const read=require('../stadium-review78').readCandidate;
const gate=require('../premium-match-images72');
const desk=require('../stadium-desk74');
const expected={
 'veldio75-sccambuur-preview':'9f68d0d22bc48d1e76b4a8e32cf38d8fee8738cfba965aad3491945cdba9b871',
 'veldio75-sccambuur-report':'b41d0fefc74172f391e265cc83ab911af25c13b0389614c689871155a2399af2'
};
test('Fase 78: native Cambuur-beelden zijn valide, maar niet ongecontroleerd gepubliceerd',async()=>{
 for(const [id,sha] of Object.entries(expected)){
  const a=rows.find(x=>x.id===id);
  assert.ok(a);
  assert.equal(a.sha256,sha);
  assert.equal(a.sourceNativeCropWidth,1672);
  assert.equal(a.sourceNativeCropHeight,941);
  assert.equal(a.approval,'pending');
  assert.equal(a.visualReview,undefined);
  assert.equal(gate.accepted(a),false);
  const v=read(id);
  assert.equal(v.status,200);
  assert.equal(crypto.createHash('sha256').update(v.bytes).digest('hex'),sha);
  const m=await sharp(v.bytes).metadata();
  assert.equal(m.width,1280);assert.equal(m.height,720);assert.equal(m.format,'webp');
 }
 assert.equal(desk.overview().counts['stored-awaiting-review'],36);
 assert.equal(desk.overview().counts['approved-for-use']||0,0);
});
test('Fase 78: preview route is isolated from catalogue and validates every request',()=>{
 const v=read('veldio75-sccambuur-preview');
 assert.equal(v.mime,'image/webp');
 assert.equal(read('../../etc/passwd').status,404);
 assert.equal(read('veldio72-utrecht-nec-report').status,404);
 assert.equal(read('missing').status,404);
 assert.equal(read('veldio75-sccambuur-preview',{root:'/tmp/non-existent-stadium-preview'}).status,503);
 const slot=desk.overview().slots.find(s=>s.club==='SC Cambuur'&&s.kind==='preview');
 assert.equal(slot.pendingImages[0].reviewUrl,'/editorial/stadium-review74/veldio75-sccambuur-preview/image');
 assert.equal(slot.pendingImages[0].minQualityScore,8.5);
});
