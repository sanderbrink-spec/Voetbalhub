'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const sharp=require('sharp');
const library=require('../image-library49');
const gate=require('../premium-match-images72');
const all=require('../image-library49.json').assets;
const review=require('../stadium-review74.json');
test('Fase 75: 13 extra review-only images are SHA bound, not automatically published',async()=>{
 const staged=all.filter(a=>a.id.startsWith('veldio75-'));
 assert.equal(staged.length,13);
 const combos=new Set();
 for(const a of staged){
  assert.equal(a.approval,'pending');
  assert.equal(gate.accepted(a),false);
  assert.equal(a.homeClubReusable,true);
  assert.equal(a.clubs[1],'*');
  assert.equal(a.stadiumOccupancy,a.imageKind==='preview'?'empty':'full');
  assert.match(a.caption,/AI-illustratie/);
  const key=a.stadiumIdentity+':'+a.imageKind;
  assert(!combos.has(key));combos.add(key);
  const b=fs.readFileSync(path.join(__dirname,'..',a.file));
  assert.equal(crypto.createHash('sha256').update(b).digest('hex'),a.sha256);
  const meta=await sharp(b).metadata();
  assert.equal(meta.width,1280);assert.equal(meta.height,720);assert.equal(meta.format,'webp');
 }
 library.validate(all);
 assert.equal(review.clubs.length,18);
 assert.equal(review.requiredSlots,36);
 assert.equal(require('../stadium-desk74').overview().counts['stored-awaiting-review'],36);
});
