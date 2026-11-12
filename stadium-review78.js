'use strict';
// Review-only raster access. The public image catalogue never serves pending assets.
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const rows=require('./image-library49.json').assets;
const normalize=require('./stadium-venue74').norm;
function readCandidate(id,{root=__dirname}={}){
 if(!/^[a-z0-9-]{1,80}$/.test(String(id||'')))return {status:404,error:'Niet gevonden.'};
 const a=rows.find(x=>x.id===id && x.homeClubReusable===true && x.approval==='pending' &&
  x.clubs?.length===2 && x.clubs[1]==='*' && x.stadiumIdentity==='home:'+normalize(x.clubs[0]) &&
  ['preview','report'].includes(x.imageKind) && x.file?.endsWith('.webp'));
 if(!a)return {status:404,error:'Niet gevonden.'};
 const abs=path.resolve(root,a.file||''),base=path.resolve(root);
 if(!abs.startsWith(base+path.sep))return {status:404,error:'Niet gevonden.'};
 try{
  const bytes=fs.readFileSync(abs);
  if(bytes.length<20_000 || bytes.length>2_000_000 ||
    crypto.createHash('sha256').update(bytes).digest('hex')!==a.sha256)
   return {status:503,error:'Beeldintegriteit mislukt.'};
  return {status:200,bytes,mime:'image/webp',id:a.id};
 }catch{return {status:503,error:'Beeld niet beschikbaar.'};}
}
module.exports={readCandidate};
