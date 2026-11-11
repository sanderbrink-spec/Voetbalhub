'use strict';
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
// Editorial REVIEW INVENTORY, not a production image publication list.
// Source files from a ChatGPT conversation cannot be served by Render.
const list=require('./stadium-review74.json');
const rows=require('./image-library49.json').assets;
const {norm}=require('./stadium-venue74');
function overview(){
 const slots=list.clubs.flatMap(club=>['preview','report'].map(kind=>{
  const declared=club.slots[kind];
  const available=rows.filter(a=>a.approval==='approved'&&a.homeClubReusable===true &&
   a.imageKind===kind&&a.stadiumIdentity==='home:'+norm(club.name)&&
   a.clubs?.[1]==='*'&&a.clubs?.[0]&&norm(a.clubs[0])===norm(club.name) &&
   require('./premium-match-images72').accepted(a));
  const staged=rows.filter(a=>a.imageKind===kind&&a.homeClubReusable===true&&
   a.stadiumIdentity==='home:'+norm(club.name)&&a.approval==='pending');
  const state=available.length?'approved-for-use':staged.length?'stored-awaiting-review':
    declared.state==='requires-binary-import'?'chat-file-not-uploaded':'missing-full-resolution-image';
  return {club:club.name,kind,occupancy:declared.occupancy,state,
   assetIds:available.map(x=>x.id),pendingAssetIds:staged.map(x=>x.id),
   reviewUrls:staged.map(x=>'/editorial/stadium-preview74/'+x.id),
   ...(declared.source?{conversationFile:declared.source}:{})};
 }));
 const counts=slots.reduce((out,slot)=>(out[slot.state]=(out[slot.state]||0)+1,out),{});
 return {version:74,season:list.season,slotsTotal:slots.length,clubsTotal:list.clubs.length,
  releasePolicy:'pending does not mean approved; quality >= 8.5 and rights review are mandatory',
  counts,slots};
}
// This is NOT the public image library. The server must authorize before calling it.
function servePreview(req,res,pathname){
 const prefix='/editorial/stadium-preview74/';
 if(!pathname.startsWith(prefix))return false;
 const id=pathname.slice(prefix.length);
 if(!/^[a-z0-9-]{1,80}$/.test(id))return false;
 const asset=rows.find(a=>a.id===id&&a.approval==='pending'&&a.homeClubReusable===true&&
   a.clubs?.[1]==='*'&&['preview','report'].includes(a.imageKind)&&
   a.stadiumIdentity==='home:'+norm(a.clubs[0])&&
   /^public\\\/(?:stadium74|stadium75|club-stadiums73)\\\/[a-z0-9-]+\\.webp$/.test(a.file||''));
 if(!asset)return false;
 const root=path.resolve(__dirname,'public');
 const full=path.resolve(__dirname,asset.file);
 if(!full.startsWith(root+path.sep))return false;
 let bytes;
 try{bytes=fs.readFileSync(full);}catch{return false;}
 if(bytes.length<20000||bytes.length>2000000||
   crypto.createHash('sha256').update(bytes).digest('hex')!==asset.sha256)return false;
 res.writeHead(200,{'Content-Type':'image/webp','Content-Length':bytes.length,
   'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff',
   'X-Robots-Tag':'noindex, nofollow',
   'Content-Security-Policy':"default-src 'none'; img-src 'self'"});
 res.end(req.method==='HEAD'?undefined:bytes);
 return true;
}
module.exports={overview,servePreview};
