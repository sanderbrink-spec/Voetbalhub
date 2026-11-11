'use strict';
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
   ...(declared.source?{conversationFile:declared.source}:{})};
 }));
 const counts=slots.reduce((out,slot)=>(out[slot.state]=(out[slot.state]||0)+1,out),{});
 return {version:74,season:list.season,slotsTotal:slots.length,clubsTotal:list.clubs.length,
  releasePolicy:'pending does not mean approved; quality >= 8.5 and rights review are mandatory',
  counts,slots};
}
module.exports={overview};
