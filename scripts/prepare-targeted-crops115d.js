'use strict';
// Actual candidate pixels only. No catalogue or publication approval changes.
const fs=require('node:fs'),crypto=require('node:crypto'),sharp=require('sharp');
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const plan=require('../artwork-crop-plan115d.json');
const catalog=require('../image-library49.json').assets;
(async()=>{
 const out='artwork-staging115d';fs.mkdirSync(out,{recursive:true});
 const rows=[];
 for(const p of plan){
  const a=catalog.find(x=>x.id===p.id);
  if(a?.correction115?.status==='pixels-corrected-approved'&&a.correction115.originalSha256===p.originalSha256){
   const existing=JSON.parse(fs.readFileSync(out+'/manifest.json','utf8')).assets.find(x=>x.id===p.id);
   if(!existing||existing.originalSha256!==p.originalSha256||existing.sha256!==a.sha256||sha(fs.readFileSync(existing.file))!==a.sha256||sha(fs.readFileSync(a.file))!==a.sha256)throw Error('Installed crop hash mismatch '+p.id);
   rows.push(existing);continue;
  }
  if(!a||a.file!==p.file||a.sha256!==p.originalSha256||a.brandingAudit115?.status!=='needs-correction')throw Error('Unexpected source binding '+p.id);
  const bytes=fs.readFileSync(p.file);
  if(sha(bytes)!==p.originalSha256)throw Error('Source hash mismatch '+p.id);
  const m=await sharp(bytes).metadata();
  const [x,y,w]=p.crop,width=Math.floor(m.width*w/1280/16)*16;
  const crop={left:Math.floor(m.width*x/1280),top:Math.floor(m.height*y/720),width,height:width*9/16};
  if(width<720||crop.left+width>m.width||crop.top+crop.height>m.height)throw Error('Unsafe crop '+p.id);
  const result=await sharp(bytes).extract(crop).webp({quality:94}).toBuffer();
  const file=out+'/'+p.id+'.webp';fs.writeFileSync(file,result);
  rows.push({id:p.id,file,originalFile:p.file,originalSha256:p.originalSha256,sha256:sha(result),crop,reason:p.reason,status:'candidate-pending-individual-review',publicationApproved:false,rightsVerified:false,contextVerified:false});
 }
 fs.writeFileSync(out+'/manifest.json',JSON.stringify({scope:'New candidates only; no release',assets:rows},null,2)+'\n');
 console.log('Created '+rows.length+' actual WebP candidates.');
})().catch(e=>{console.error(e);process.exitCode=1;});
