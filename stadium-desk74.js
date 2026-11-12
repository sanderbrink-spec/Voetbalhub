'use strict';
// Editorial REVIEW INVENTORY, not a production image publication list.
// Source files from a ChatGPT conversation cannot be served by Render.
const list=require('./stadium-review74.json');
const rows=require('./image-library49.json').assets;
const findings=require('./stadium-review-findings79.json').findings;
const screenings=new Map(require('./stadium-screening84.json').candidates.map(x=>[x.id,x]));
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
   approvedImages:available.map(a=>({id:a.id,sha256:a.sha256,publicImageUrl:'/'+a.file.slice(7),
    visualScore:a.visualReview?.score??null,reviewer:a.reviewer})),
   pendingImages:staged.map(a=>({id:a.id,sha256:a.sha256,
    reviewUrl:'/editorial/stadium-review74/'+a.id+'/image',
    originalSourceWidth:a.sourceNativeCropWidth||null,
    qualityStatus:'requires-independent-review',rightsStatus:'requires-independent-review',
    minQualityScore:8.5,knownIssue:findings[a.id]||null,
    reviewPriority:findings[a.id]?'repair-first':'first-review',
    canRequestApproval:!findings[a.id],
    preliminaryScreening:screenings.get(a.id)?{
     note:screenings.get(a.id).preliminaryVisualNote,
     fullResolutionReviewDone:screenings.get(a.id).hasExactRasterPersonalReview,
     independentScore:screenings.get(a.id).qualityScore,
     rightsReleased:screenings.get(a.id).rightsReleased}:null})),
   ...(declared.source?{conversationFile:declared.source}:{})};
 }));
 slots.sort((a,b)=>{const tier=s=>s.state==='approved-for-use'?2:s.pendingImages.some(x=>x.knownIssue)?1:0;
  return tier(a)-tier(b) || a.club.localeCompare(b.club,'nl') || (a.kind==='preview'?-1:1);
 });
 const counts=slots.reduce((out,slot)=>(out[slot.state]=(out[slot.state]||0)+1,out),{});
 const riskCounts=slots.flatMap(s=>s.pendingImages||[]).reduce((out,item)=>{
  if(item.knownIssue)out[item.knownIssue.level]=(out[item.knownIssue.level]||0)+1;
  return out;
 },{});
 return {version:74,season:list.season,slotsTotal:slots.length,clubsTotal:list.clubs.length,
  releasePolicy:'pending does not mean approved; quality >= 8.5 and rights review are mandatory',
  counts,riskCounts,reviewPlan:{firstReview:slots.filter(s=>s.pendingImages.some(a=>a.reviewPriority==='first-review')).length,
  repairFirst:slots.filter(s=>s.pendingImages.some(a=>a.reviewPriority==='repair-first')).length,
  approved:slots.filter(s=>s.state==='approved-for-use').length,
  rule:'Geen groepsvrijgave: individuele beoordeling en minimaal 8,5, bewijs van beeldrechten en expliciete goedkeuring verplicht.'},
  issuesForExtraReview:Object.values(riskCounts).reduce((n,x)=>n+x,0),slots};
}
module.exports={overview};
