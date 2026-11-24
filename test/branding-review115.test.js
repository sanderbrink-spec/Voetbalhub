'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {brandingAllowed,accepted}=require('../premium-match-images72');
const legacy=require('../branding-review-baseline115.json');
const sha='a'.repeat(64);
const base={id:'new-stadium-115',sha256:sha,caption:'Veldio · AI-illustratie, geen echte wedstrijdfoto.'};
const audit={status:'passed',assetSha256:sha,veldioOnly:true,noOtherText:true,noThirdPartyLogos:true,disclosureOutsideImage:true,reviewer:'Visual QA',reviewedAt:'2026-11-24'};
test('new raster requires explicit hash-bound Veldio-only approval',()=>{
 assert.equal(brandingAllowed(base),false);
 assert.equal(brandingAllowed({...base,brandingAudit115:audit}),true);
 for(const field of ['veldioOnly','noOtherText','noThirdPartyLogos','disclosureOutsideImage'])assert.equal(brandingAllowed({...base,brandingAudit115:{...audit,[field]:false}}),false);
 assert.equal(brandingAllowed({...base,sha256:'b'.repeat(64),brandingAudit115:audit}),false);
 assert.equal(brandingAllowed({...base,caption:'Veldio',brandingAudit115:audit}),false);
});
test('old approved bytes can remain during re-audit but a known defect blocks them',()=>{
 const [id,sha256]=Object.entries(legacy)[0];
 assert.equal(brandingAllowed({id,sha256}),true);
 assert.equal(brandingAllowed({id,sha256,brandingAudit115:{status:'needs-correction',assetSha256:sha256}}),false);
 assert.equal(brandingAllowed({id,sha256:'b'.repeat(64)}),false);
});

test('known defects or stale review hashes cannot be bypassed by changing file bytes, including non-match assets',()=>{
 const original={id:'news-115',sha256:sha,approval:'approved',reviewer:'Visual QA',rightsEvidence:'Documented',categories:['news'],brandingAudit115:{status:'needs-correction',assetSha256:sha}};
 assert.equal(accepted(original),false);
 assert.equal(accepted({...original,sha256:'b'.repeat(64)}),false);
 assert.equal(accepted({...original,brandingAudit115:{status:'text-screen-pass',assetSha256:'b'.repeat(64)}}),false);
 assert.equal(accepted({...original,brandingAudit115:{status:'already-rejected',assetSha256:sha}}),false);
 assert.equal(accepted({...original,brandingAudit115:audit}),true);
});

test('known defective catalogue bytes stay blocked even after removal or relabelling of the audit',()=>{
 const queue=require('../branding-correction-queue115.json').items;
 for(const id of ['match64-sm-19714595','groningen43']){
  const item=queue.find(x=>x.id===id);
  assert.ok(item);
  const old={id,sha256:item.originalSha256,approval:'approved',reviewer:'Visual QA',rightsEvidence:'Documented',categories:['news'],caption:base.caption};
  assert.equal(brandingAllowed(old),false);
  assert.equal(accepted(old),false);
  assert.equal(accepted({...old,brandingAudit115:{...audit,assetSha256:old.sha256}}),false);
  const replacement={...old,sha256:sha};
  assert.equal(accepted(replacement),false);
  assert.equal(accepted({...replacement,brandingAudit115:{status:'text-screen-pass-only',assetSha256:sha}}),false);
  assert.equal(accepted({...replacement,brandingAudit115:audit}),true);
 }
});

test('installed corrected candidates are still pending and hash-bound to staging',()=>{
 const queue=require('../branding-correction-queue115.json').items;
 const catalog=require('../image-library49.json').assets;
 const manifest=require('../artwork-staging115/manifest.json').assets;
 const fs=require('node:fs'),crypto=require('node:crypto'),path=require('node:path');
 const digest=file=>crypto.createHash('sha256').update(fs.readFileSync(path.resolve(__dirname,'..',file))).digest('hex');
 for(const item of queue.filter(x=>x.status==='pixels-corrected-pending-review')){
  const asset=catalog.find(x=>x.id===item.id),row=manifest.find(x=>x.id===item.id);
  assert.equal(asset.approval,'pending');
  assert.equal(asset.sha256,item.correctedSha256);
  assert.equal(row.sha256,asset.sha256);
  assert.equal(digest(asset.file),asset.sha256);
  assert.equal(digest(row.file),asset.sha256);
  assert.equal(accepted(asset),false);
  assert.equal(asset.correction115.publicationApproved,false);
 }
});

test('final reviewed corrected candidates remain hash-bound and satisfy existing publication gate',()=>{
 const queue=require('../branding-correction-queue115.json').items;
 const catalog=require('../image-library49.json').assets;
 const fs=require('node:fs'),crypto=require('node:crypto'),path=require('node:path');
 for(const item of queue.filter(x=>x.status==='pixels-corrected-approved')){
  const asset=catalog.find(x=>x.id===item.id);
  assert.equal(asset.sha256,item.correctedSha256);
  assert.equal(crypto.createHash('sha256').update(fs.readFileSync(path.resolve(__dirname,'..',asset.file))).digest('hex'),asset.sha256);
  assert.equal(item.finalReview115.assetSha256,asset.sha256);
  assert.equal(accepted(asset),true);
  assert.equal(accepted({...asset,sha256:item.originalSha256}),false);
 }
});

test('later individual review overrides legacy acceptance and cannot be reused for different bytes',()=>{
 const original={id:'editorial-manual-review-115',sha256:sha,approval:'approved',reviewer:'Visual QA',rightsEvidence:'Documented',categories:['news']};
 const manual={status:'passed',assetSha256:sha,brandingVerified:true,contextVerified:true};
 assert.equal(accepted({...original,manualReview115:manual}),true);
 for(const status of ['requires-context-or-replacement','requires-correction','requires-further-context-or-replacement']) {
  assert.equal(accepted({...original,manualReview115:{...manual,status}}),false);
 }
 assert.equal(accepted({...original,manualReview115:{...manual,assetSha256:'b'.repeat(64)}}),false);
 assert.equal(accepted({...original,manualReview115:{...manual,contextVerified:false}}),false);
 assert.equal(accepted({...original,manualReview115:{...manual,brandingVerified:false}}),false);
 const catalog=require('../image-library49.json').assets;
 for(const asset of catalog.filter(x=>x.manualReview115 && x.manualReview115.status!=='passed')) {
  assert.equal(accepted(asset),false,asset.id);
 }
});


test('115D: known undersized corrected match rasters cannot be approved with metadata alone',async()=>{
 const q=require('../branding-correction-queue115.json').items;
 const rows=require('../image-library49.json').assets;
 const sharp=require('sharp'),fs=require('node:fs');
 const holds=q.filter(x=>x.technicalReview115?.status==='requires-native-resolution-repair');
 assert.ok(holds.length>0);
 for(const item of holds){
  const row=rows.find(x=>x.id===item.id),h=item.technicalReview115;
  assert.equal(row.sha256,h.assetSha256);
  const actual=await sharp(fs.readFileSync(row.file)).metadata();
  assert.equal(actual.width,h.width);assert.equal(actual.height,h.height);
  assert.ok(actual.width<1280||actual.height<720);
  assert.equal(row.approval,'pending');
  assert.equal(accepted({...row,approval:'approved',reviewer:'Synthetic QA',brandingAudit115:{...audit,assetSha256:row.sha256}}),false);
  assert.equal((await require('../scripts/premium-raster-preflight72').inspect(row.file)).accepted,false);
 }
});
