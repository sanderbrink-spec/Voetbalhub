'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const crypto=require('node:crypto');
const path=require('node:path');
const library=require('../image-library49');
const premium=require('../premium-match-images72');
const review=require('../stadium-review74.json');
const rows=require('../image-library49.json').assets;
const revised=new Map([
 ['ADO Den Haag:preview','public/stadium74/adodenhaag-preview.webp'],
 ['ADO Den Haag:report','public/stadium75/adodenhaag-report.webp'],
 ['FC Twente:preview','public/stadium75/fctwente-preview.webp'],
 ['FC Twente:report','public/stadium74/fctwente-report.webp'],
 ['Feyenoord:preview','public/stadium74/feyenoord-preview.webp'],
 ['Feyenoord:report','public/stadium75/feyenoord-report.webp'],
 ['PSV:preview','public/stadium75/psv-preview.webp'],
 ['PSV:report','public/stadium75/psv-report.webp'],
 ['Sparta Rotterdam:preview','public/stadium75/spartarotterdam-preview.webp'],
 ['Sparta Rotterdam:report','public/stadium75/spartarotterdam-report.webp']
]);
test('Fase 76: ten new stadium rasters have exact SHA256 and stay review-only',()=>{
 const desk=require('../stadium-desk74').overview();
 assert.equal(desk.clubsTotal,18);
 assert.equal(desk.slotsTotal,36);
 assert.equal((desk.counts['stored-awaiting-review']||0)+(desk.counts['approved-for-use']||0),36);
 for(const [key,file] of revised){
  const [club,kind]=key.split(':');
  const row=rows.find(a=>a.file===file);
  assert.ok(row,'Manifest entry missing '+key);
  const binary=fs.readFileSync(path.join(__dirname,'..',file));
  assert.equal(crypto.createHash('sha256').update(binary).digest('hex'),row.sha256,key);
  assert.ok(binary.length>60000&&binary.length<2000000,key);
  assert.ok(['pending','approved'].includes(row.approval),key);
  if(row.approval==='pending'){assert.equal(row.reviewer,'',key);assert.equal(row.visualReview,undefined,key);}
  else{assert.ok(row.reviewer,key);assert.ok(row.visualReview?.score>=8.5,key);}
  assert.equal(premium.accepted(row),row.approval==='approved',key);
  assert.equal(library.catalog().some(a=>a.id===row.id),row.approval==='approved',key);
  assert.equal(row.imageKind,kind,key);
  assert.equal(row.stadiumOccupancy,kind==='preview'?'empty':'full',key);
  assert.equal(row.homeClubReusable,true,key);
  assert.equal(row.clubs[0],club,key);
  assert.equal(row.clubs[1],'*',key);
  const slot=review.clubs.find(c=>c.name===club)?.slots[kind];
  assert.ok(slot,'Slot missing '+key);
  assert.equal(slot.assetPath,file,key);
  assert.ok(typeof slot.productionApproved==='boolean',key);
  assert.equal(slot.qualityReviewRequired,true,key);
  assert.equal(slot.rightsReviewRequired,true,key);
  assert.equal(slot.revision, ['FC Twente:preview','Sparta Rotterdam:preview','Sparta Rotterdam:report'].includes(key) ? 77 : 76, key);
 }
});
