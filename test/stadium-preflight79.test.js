'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const fs=require('node:fs');
const path=require('node:path');
const sharp=require('sharp');
const manifest=require('../image-library49.json').assets;
const findings=require('../stadium-review-findings79.json').findings;
const desk=require('../stadium-desk74');
const gate=require('../premium-match-images72');
const preflight=require('../scripts/premium-raster-preflight72');

test('Fase 79: 36 stadionbeelden zijn fysiek valide en geen enkel pending beeld passeert de publicatiepoort',async()=>{
 const rows=manifest.filter(a=>a.homeClubReusable===true);
 assert.equal(rows.length,36);
 for(const row of rows){
  assert.equal(row.approval,'pending',row.id);
  assert.equal(gate.accepted(row),false,row.id);
  assert.equal(row.clubs[1],'*',row.id);
  assert.equal(row.stadiumIdentity,'home:'+String(row.clubs[0]).normalize('NFD')
    .replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]/g,''),row.id);
  assert.equal(row.stadiumOccupancy,row.imageKind==='preview'?'empty':'full',row.id);
  const full=path.resolve(__dirname,'..',row.file);
  const buf=fs.readFileSync(full);
  assert.equal(crypto.createHash('sha256').update(buf).digest('hex'),row.sha256,row.id);
  const meta=await sharp(buf).metadata();
  assert.equal(meta.width,1280,row.id);
  assert.equal(meta.height,720,row.id);
  assert.equal(meta.format,'webp',row.id);
  const result=await preflight.inspect(row.file);
  assert.deepEqual(result.problems,[],row.id);
 }
});
test('Fase 79: acht concrete herstelpunten zijn zichtbaar, en Cambuur-native beelden hebben geen opschalingsblokkade',()=>{
 const listed=desk.overview();
 assert.equal(listed.slotsTotal,36);
 assert.equal(listed.issuesForExtraReview,8);
 assert.equal(Object.keys(findings).length,8);
 assert.equal(listed.riskCounts.rebuild,4);
 assert.equal(listed.riskCounts.compare,2);
 assert.equal(listed.riskCounts.identity,2);
 for(const slot of listed.slots){
  for(const item of slot.pendingImages){
   assert.deepEqual(item.knownIssue,findings[item.id]||null);
   assert.ok(item.minQualityScore>=8.5);
   assert.equal(item.qualityStatus,'requires-independent-review');
  }
 }
 for(const kind of ['preview','report']){
  const a=manifest.find(x=>x.id==='veldio75-sccambuur-'+kind);
  assert.equal(a.sourceNativeCropWidth,1672);
  assert.ok(!findings[a.id]);
 }
 assert.equal(listed.counts['approved-for-use']||0,0);
});
