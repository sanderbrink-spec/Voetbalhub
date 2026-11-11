'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const sharp=require('sharp');
const {inspect}=require('../scripts/premium-raster-preflight72');
const {importImages}=require('../scripts/import-images49');
const premium=require('../premium-match-images72');
const rows=require('../image-library49.json').assets;
const source=rows.find(a=>a.id==='veldio71-twente-ajax-report');
const checks={photorealism:true,clubNames:true,stadiumContext:true,rights:true,aiNotDocumentary:true};
const reviewed=(change={})=>({...source,id:'veldio72-test-raster-dryrun',
 visualReview:{score:9,style:'photorealistic',assetSha256:source.sha256,checked:checks,
 reviewer:'Independent visual reviewer',reviewedAt:'2026-11-11'},...change});
function incoming(asset){
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'veldio-photo-import-'));
 const file=path.join(dir,'incoming.json');
 fs.writeFileSync(file,JSON.stringify({assets:[asset]}));
 return {file,remove:()=>fs.rmSync(dir,{recursive:true,force:true})};
}
test('Fase 72B: existing original photo raster passes objective technical checks',async()=>{
 assert.ok(source);
 const r=await inspect(source.file);
 assert.equal(r.accepted,true,JSON.stringify(r));
 assert.equal(r.sha256,source.sha256);
 assert.ok(r.width>=1280&&r.height>=720);
 assert.ok(r.entropy>=5.1);
});
test('Fase 72B: flat raster remains blocked, even with faked high review score',async()=>{
 const rel='public/premium-qa-tmp72/flat-'+process.pid+'.webp',absolute=path.join(__dirname,'..',rel);
 fs.mkdirSync(path.dirname(absolute),{recursive:true});
 try{
  await sharp({create:{width:1280,height:720,channels:3,background:{r:60,g:80,b:90}}}).webp().toFile(absolute);
  const scan=await inspect(rel);
  assert.equal(scan.accepted,false,JSON.stringify(scan));
  assert.ok(scan.problems.some(p=>/illustratie|beeldvariatie|textuurvariatie|KB/.test(p)));
  const sha=require('node:crypto').createHash('sha256').update(fs.readFileSync(absolute)).digest('hex');
  const asset=reviewed({file:rel,sha256:sha,visualReview:{...reviewed().visualReview,assetSha256:sha}});
  assert.equal(premium.accepted(asset),true); // Human metadata alone is insufficient.
  const data=incoming(asset);
  try{await assert.rejects(importImages(data.file,{dryRun:true}),/Rastercontrole mislukt/);}
  finally{data.remove();}
 }finally{fs.rmSync(path.dirname(absolute),{recursive:true,force:true});}
});
test('Fase 72B: unsigned premium reviews fail before any disk mutation',async()=>{
 const file=incoming(reviewed({visualReview:{...reviewed().visualReview,assetSha256:'wrong'}}));
 try{await assert.rejects(importImages(file.file,{dryRun:true}),/SHA-gebonden controle/);}
 finally{file.remove();}
});
test('Fase 72B: high-quality assessed photo can be dry-run without modifying manifest',async()=>{
 const before=fs.readFileSync(path.join(__dirname,'../image-library49.json'));
 const data=incoming(reviewed());
 try{
  const report=await importImages(data.file,{dryRun:true});
  assert.deepEqual(report,{count:1,dryRun:true,reviewedPremium:1});
  assert.deepEqual(fs.readFileSync(path.join(__dirname,'../image-library49.json')),before);
 }finally{data.remove();}
});
