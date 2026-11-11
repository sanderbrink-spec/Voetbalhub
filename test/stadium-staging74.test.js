'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const fs=require('node:fs');
const path=require('node:path');
const sharp=require('sharp');
const library=require('../image-library49');
const premium=require('../premium-match-images72');
const desk=require('../stadium-desk74');
const assets=require('../image-library49.json').assets;
const review=require('../stadium-review74.json');

test('Fase 74: twenty full-resolution stadium candidates are safely staged and intact',async()=>{
 const staged=assets.filter(a=>a.id.startsWith('veldio74-'));
 assert.equal(staged.length,20);
 library.validate(assets);
 for(const a of staged){
  assert.equal(a.approval,'pending');
  assert.equal(premium.accepted(a),false);
  assert.equal(a.homeClubReusable,true);
  assert.deepEqual(a.clubs,[a.clubs[0],'*']);
  assert.equal(a.stadiumIdentity,'home:'+a.clubs[0].normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]/g,''));
  assert.equal(a.stadiumOccupancy,a.imageKind==='preview'?'empty':'full');
  assert.match(a.caption,/AI-illustratie/);
  assert.match(a.rightsEvidence,/review vereist/);
  const bytes=fs.readFileSync(path.resolve(__dirname,'..',a.file));
  assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'),a.sha256);
  const meta=await sharp(bytes).metadata();
  assert.equal(meta.width,1280);
  assert.equal(meta.height,720);
  assert.equal(meta.format,'webp');
 }
});
test('Fase 74: every club has two review slots, pending is not automatically published',()=>{
 assert.equal(review.clubs.length,18);
 assert.equal(review.requiredSlots,36);
 const stats=desk.overview();
 assert.equal(stats.slotsTotal,36);
 assert.equal(stats.counts['stored-awaiting-review'],23);
 assert.equal(stats.counts['missing-full-resolution-image'],13);
 assert.equal(stats.counts['approved-for-use']||0,0);
 for(const slot of stats.slots)assert.notEqual(slot.state,'approved-for-use');
});
