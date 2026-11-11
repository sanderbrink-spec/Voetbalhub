'use strict';
// Objective preflight only; this cannot assign an artistic score or replace
// an explicit human approval. Runs before any NEW premium match image is listed.
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const sharp=require('sharp');

function imagePath(file,root=path.resolve(__dirname,'..')){
 const abs=path.resolve(root,file||'');
 if(!abs.startsWith(path.resolve(root)+path.sep)||
    !/^public\/[a-zA-Z0-9_/-]+\.(?:webp|png|jpg|jpeg)$/i.test(file||''))throw Error('Ongeldig lokaal rasterpad.');
 return abs;
}
async function inspect(file,{root=path.resolve(__dirname,'..')}={}){
 const abs=imagePath(file,root);
 const stat=fs.statSync(abs),bytes=fs.readFileSync(abs);
 const problems=[];
 if(stat.size<20_000||stat.size>2_000_000)problems.push('Bestand moet tussen 20 KB en 2 MB zijn.');
 let meta,stats,distinct=0;
 try{
  meta=await sharp(bytes,{failOn:'error',limitInputPixels:12_000_000}).metadata();
  const ratio=meta.width/meta.height;
  if(meta.width<1280||meta.height<720||Math.abs(ratio-16/9)>0.065)
   problems.push('Wedstrijdbeeld vereist minimaal 1280x720 met 16:9-verhouding.');
  if(!['webp','png','jpeg'].includes(meta.format))
   problems.push('Geen ondersteund rasterformaat.');
  stats=await sharp(bytes).stats();
  if(!Number.isFinite(stats.entropy)||stats.entropy<5.1)
   problems.push('Te weinig beeldvariatie; vlakke of eenvoudige illustratie vermoed.');
  const sample=await sharp(bytes).resize(96,54,{fit:'fill'}).removeAlpha().raw().toBuffer();
  const palette=new Set();
  for(let i=0;i+2<sample.length;i+=3)
   palette.add(((sample[i]>>4)<<8)|((sample[i+1]>>4)<<4)|(sample[i+2]>>4));
  distinct=palette.size;
  if(distinct<180)problems.push('Te weinig natuurlijke kleur- en textuurvariatie.');
 }catch(err){problems.push('Raster kan niet veilig worden gelezen: '+err.message);}
 return {accepted:problems.length===0,sha256:crypto.createHash('sha256').update(bytes).digest('hex'),
  bytes:stat.size,width:meta?.width||0,height:meta?.height||0,
  entropy:Number((stats?.entropy||0).toFixed(2)),colorBuckets:distinct,problems};
}
module.exports={inspect,imagePath};
