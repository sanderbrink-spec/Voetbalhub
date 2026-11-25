'use strict';
// Read-only audit of stored editorial artwork retries. Never decrypts
// editorial checkpoints or changes approved images, queue state or articles.
const fs=require('node:fs');
const path=require('node:path');
const rotation=require('../image-rotation65');
const {norm}=require('../stadium-venue74');
const library=require('../image-library49');
const historicalFindings=require('../stadium-review-findings79.json').findings;
const withheld=new Map(require('../stadium-visual-prescreen106d.json').withheld.map(item=>[item.id,item]));
const screenings=new Map(require('../stadium-screening84.json').candidates.map(item=>[item.id,item]));
const COMPETITION_LABELS=Object.freeze({eredivisie:'Eredivisie',kkd:'Keuken Kampioen Divisie',premierleague:'Premier League',knvbbeker:'KNVB Beker'});


function dateMs(value){
 const ms=typeof value==='number'?value:Date.parse(value||'');
 return Number.isFinite(ms)&&ms>0?ms:null;
}
function verifiedFixture(row,matchId){
 if(!row||typeof row!=='object'||row.id!==matchId||
   !/^(?:sm|uefa)-\d+$/.test(matchId)||!row.homeTeam||!row.awayTeam||
   norm(row.homeTeam)===norm(row.awayTeam)||!row.competition||
   !['Sportmonks','Official','Football-Data.org'].includes(row.evidenceSource)||
   !dateMs(row.verifiedAt)||!dateMs(row.playedAt))return null;
 return {
  id:matchId,homeTeam:String(row.homeTeam),awayTeam:String(row.awayTeam),
  playedAt:new Date(dateMs(row.playedAt)).toISOString(),competition:String(row.competition),
  venueName:row.venueName||'',venueId:row.venueId||undefined,
  ...(row.venue&&Number.isFinite(row.venue.latitude)&&Number.isFinite(row.venue.longitude)
    ?{venue:{latitude:row.venue.latitude,longitude:row.venue.longitude,name:row.venueName||''}}:{}),
  source:row.evidenceSource,verifiedAt:row.verifiedAt
 };
}
// Convert only the verified final results returned by Veldio's protected
// first-party Sportmonks endpoint; publisher headlines are not fixture proof.
// No endpoint secret, statistics, source text, or draft body is persisted.
// Keep only provider-verified coordinates bound to the same fixture venue ID.
// A generic home-club name is not evidence of the exact venue or sun position.
function sportmonksVenue(fixture){
 const venue=fixture?.venue;
 if(!venue||!Number.isSafeInteger(fixture.venueId)||fixture.venueId<=0||
    !Number.isSafeInteger(venue.id)||venue.id!==fixture.venueId||
    typeof fixture.venueName!=='string'||fixture.venueName!==venue.name||
    venue.name.trim().length<2||venue.name.length>120||
    !Number.isFinite(venue.latitude)||Math.abs(venue.latitude)>90||
    !Number.isFinite(venue.longitude)||Math.abs(venue.longitude)>180||
    (venue.latitude===0&&venue.longitude===0))return null;
 return {venueId:venue.id,venueName:venue.name,
  venue:{id:venue.id,name:venue.name,latitude:venue.latitude,longitude:venue.longitude}};
}
function sportmonksEvidence(response){
 const competition=response?.competition;
 if(response?.source!=='Sportmonks Football API'||response?.status!=='available'||
   !Object.hasOwn(COMPETITION_LABELS,competition)||!Array.isArray(response.fixtures)||
   response.fixtures.length>500)return [];
 return response.fixtures.filter(f=>f?.competition===competition&&f?.status==='FT'&&
   f?.resultSource==='Sportmonks Football API'&&typeof f.id==='string'&&
   /^sm-\d+$/.test(f.id)&&typeof f.home?.name==='string'&&
   typeof f.away?.name==='string'&&dateMs(f.date)&&dateMs(f.checkedAt))
 .map(f=>({id:f.id,homeTeam:f.home.name,awayTeam:f.away.name,
  competition:COMPETITION_LABELS[competition],playedAt:f.date,verifiedAt:f.checkedAt,
  evidenceSource:'Sportmonks',
  ...(sportmonksVenue(f)||{})}));
}
function sportmonksEvidenceBatch(snapshots){
 const responses=Array.isArray(snapshots)?snapshots:[snapshots];
 if(responses.length>4)throw Error('Maximaal vier competities in een audit.');
 return responses.flatMap(sportmonksEvidence);
}
function auditQueue(queue,assets,fixtureEvidence=[],now=Date.now()){
 const records=Array.isArray(queue)?queue:queue?.records;
 if(!Array.isArray(records)||!Array.isArray(assets)||!Array.isArray(fixtureEvidence))throw Error('Ongeldige auditinvoer.');
 const evidence=new Map();
 const conflictingIds=new Set();
 for(const row of fixtureEvidence){
  if(!row||typeof row.id!=='string')continue;
  const prior=evidence.get(row.id);
  if(prior&&['homeTeam','awayTeam','competition','playedAt','venueId','venueName'].some(key=>
     String(prior[key]??'')!==String(row[key]??'')))conflictingIds.add(row.id);
  else if(!prior)evidence.set(row.id,row);
 }
 for(const id of conflictingIds)evidence.delete(id);
 const blocked=records.filter(j=>j?.status==='retry'&&j?.reason==='awaiting_approved_artwork'&&
   j?.failureStage==='artwork'&&/^(?:sm|uefa)-\d+$/.test(j?.matchId||''));
 // One image per verified fixture. Several retry records may refer to the same
 // still-unapproved artwork. Keep only the newest for the read-only planning
 // snapshot; never mutate, acknowledge or delete the underlying job records.
 const sortedBlocked=[...blocked].sort((a,b)=>
   (dateMs(b.createdAt)||0)-(dateMs(a.createdAt)||0)||
   (dateMs(b.nextAttemptAt)||0)-(dateMs(a.nextAttemptAt)||0)||
   String(a.id||'').localeCompare(String(b.id||'')));
 const seenMatchIds=new Set();
 const uniqueBlocked=sortedBlocked.filter(job=>{
  if(seenMatchIds.has(job.matchId))return false;
  seenMatchIds.add(job.matchId);return true;
 });
 const rows=uniqueBlocked.map(job=>{
  const base={matchId:job.matchId,status:job.status,reason:job.reason,
   createdAt:dateMs(job.createdAt)?new Date(dateMs(job.createdAt)).toISOString():null,
   nextAttemptAt:dateMs(job.nextAttemptAt)?new Date(dateMs(job.nextAttemptAt)).toISOString():null,
   ageHours:dateMs(job.createdAt)?Math.round(Math.max(0,now-dateMs(job.createdAt))/360000)/10:null};
  const match=verifiedFixture(evidence.get(job.matchId),job.matchId);
  if(!match)return {...base,classification:'requires_verified_fixture',
   why:'Geen geverifieerde wedstrijdidentiteit (clubs, datum, competitie en bron) in aangeleverde snapshot.',
   approvedAssetIds:[],pendingHomeCandidates:[]};
  const article={articleKind:'match_report',imageCategory:'report',
   category:match.competition,matchId:job.matchId,match};
  const context=rotation.context(article);
  const approved=rotation.eligible(article,assets,context).map(x=>x.id);
  const pending=assets.filter(x=>x.approval==='pending'&&x.homeClubReusable===true&&
   x.imageKind==='report'&&x.stadiumOccupancy==='full'&&x.clubs?.length===2&&
   norm(x.clubs[0])===norm(match.homeTeam)&&x.clubs[1]==='*')
   .map(x=>{
    const historical=historicalFindings[x.id];
    const held=withheld.get(x.id);
    const screened=screenings.get(x.id);
    const rejectedScore=screened?.sha256===x.sha256&&
      Number.isFinite(screened.fullResolutionAssessment?.score)&&
      screened.fullResolutionAssessment.score<8.5;
    const reasons=[
     ...(historical?[historical.reason]:[]),
     ...(held?[held.reason]:[]),
     ...(rejectedScore?['Eerdere beoordeling van exact bestand onder 8,5.']:[])
    ];
    return {id:x.id,sha256:x.sha256,sceneDaypart:x.sceneDaypart||x.daypart,
     reviewRequired:true,contextMatchesDaypart:library.daypartMatches(x,context.daypart),
     requiresRework:reasons.length>0,
     ...(reasons.length?{reviewBlockReasons:[...new Set(reasons)]}:{})};
   }).sort((a,b)=>a.id.localeCompare(b.id));
  // Fixture-specific originals are distinct from reusable home-stadium scenes.
  // A validated on-repository pending image is a review task, not a reason to
  // generate another image. It can NEVER bypass the approved-only selection.
  const pendingExact=assets.filter(x=>x.approval==='pending'&&
    x.fixtureId===job.matchId&&x.imageKind==='report'&&
    x.categories?.includes('report')&&x.stadiumOccupancy==='full'&&
    Array.isArray(x.clubs)&&x.clubs.length===2&&
    norm(x.clubs[0])===norm(match.homeTeam)&&
    norm(x.clubs[1])===norm(match.awayTeam)&&
    x.competitions?.includes(match.competition)&&
    x.stadiumIdentity==='home:'+norm(match.homeTeam)&&
    typeof x.sha256==='string'&&/^[a-f0-9]{64}$/.test(x.sha256))
   .map(x=>{
    const prior=screenings.get(x.id);
    const failed=prior?.sha256===x.sha256&&
      Number.isFinite(prior.fullResolutionAssessment?.score)&&
      prior.fullResolutionAssessment.score<8.5;
    const reasons=[
      ...(historicalFindings[x.id]?[historicalFindings[x.id].reason]:[]),
      ...(withheld.get(x.id)?[withheld.get(x.id).reason]:[]),
      ...(failed?['Exact bestand had eerdere beoordeling onder 8,5.']:[])
    ];
    return {id:x.id,sha256:x.sha256,reviewRequired:true,
     contextMatchesDaypart:library.daypartMatches(x,context.daypart),
     requiresRework:reasons.length>0,
     ...(reasons.length?{reviewBlockReasons:[...new Set(reasons)]}:{})};
   }).sort((a,b)=>a.id.localeCompare(b.id));
  const exactCompatible=pendingExact.filter(x=>x.contextMatchesDaypart);
  const exactReviewable=exactCompatible.filter(x=>!x.requiresRework);
  const compatible=pending.filter(x=>x.contextMatchesDaypart);
  const reviewable=compatible.filter(x=>!x.requiresRework);
  const hasAnyPending=pendingExact.length+pending.length>0;
  const classification=approved.length?'approved_match_available':
   !hasAnyPending?'requires_new_original_artwork':
   context.daypart==='neutral'?'requires_verified_daypart':
   exactReviewable.length?'pending_exact_fixture_review':
   reviewable.length?'pending_home_image_review':
   exactCompatible.length||compatible.length?'requires_image_rework':
   'requires_matching_scene_artwork';
  return {...base,classification,homeTeam:match.homeTeam,awayTeam:match.awayTeam,
   playedAt:match.playedAt,competition:match.competition,
   fixtureSource:match.source,fixtureVerifiedAt:match.verifiedAt,
   daypart:context.daypart,daypartEvidence:context.daypart==='neutral'?'insufficient_venue_coordinates':'solar_venue_coordinates',
   approvedAssetIds:approved,pendingHomeCandidates:pending,
   pendingExactCandidates:pendingExact,
   why:approved.length?'Passend reeds goedgekeurd beeld gevonden; controleer alsnog actuele factcheck en publicatiepoort.':
    classification==='pending_exact_fixture_review'?'Originele afbeelding bestaat voor exact deze wedstrijd, maar is NOG NIET onafhankelijk goedgekeurd.':
    classification==='requires_verified_daypart'?'Er bestaan pending beelden, maar verifieer eerst stadionlocatie en zonstand; neutraal dagdeel is geen vrijbrief.':
    classification==='requires_matching_scene_artwork'?'Bestaande pending afbeeldingen hebben een afwijkend werkelijk dagdeel.':
    classification==='requires_image_rework'?'Bestaande pending afbeeldingen hebben vastgestelde kwaliteits- of rechtenrisico’s.':
    hasAnyPending?'Passend dagdeel en wedstrijdcontext, maar definitieve individuele beeld- en rechtencontrole ontbreekt.':
    'Geen bestaand goedgekeurd of pending wedstrijdbeeld in de gecontroleerde catalogus.'
  };
 }).sort((a,b)=>(dateMs(b.createdAt)||0)-(dateMs(a.createdAt)||0)||a.matchId.localeCompare(b.matchId));
 const counts=rows.reduce((o,x)=>(o[x.classification]=(o[x.classification]||0)+1,o),{});
 return {schemaVersion:109,generatedAt:new Date(now).toISOString(),
  queueRecords:records.length,artworkRetries:rows.length,
  artworkRetryRecords:blocked.length,duplicateArtworkRetryRecords:blocked.length-rows.length,
  classified:counts,
  blockedWithoutVerifiedFixture:counts.requires_verified_fixture||0,
  verifiedFixtureCount:evidence.size,fixtureConflicts:conflictingIds.size,
  verifiedCoverageByCompetition:[...evidence.values()].reduce((out,fixture)=>{
   out[fixture.competition]=(out[fixture.competition]||0)+1;return out;
  },{}),
  safety:{readOnly:true,unlocksPublications:false,qualityThresholdUnchanged:true,
   approvedAssetsOnlyFromExistingCatalog:true,checkpointNeverEmitted:true,
   warning:'Onbekende wedstrijdcontext betekent NOOIT veilig hergebruik of toestemming tot publicatie.'},rows};
}
function main(argv=process.argv.slice(2)){
 const opts={};
 for(let i=0;i<argv.length;i+=2){
  if(!['--queue','--fixtures','--sportmonks','--out'].includes(argv[i])||!argv[i+1]||opts[argv[i]])throw Error('Gebruik --queue PATH [--fixtures PATH | --sportmonks PATH] [--out PATH]');
  opts[argv[i].slice(2)]=argv[i+1];
 }
 if(!opts.queue)throw Error('--queue vereist');
 const read=p=>JSON.parse(fs.readFileSync(path.resolve(p),'utf8'));
 if(opts.fixtures&&opts.sportmonks)throw Error('Eén bewijsbron per auditaanroep');
 const evidence=opts.fixtures?read(opts.fixtures):opts.sportmonks?sportmonksEvidenceBatch(read(opts.sportmonks)):[];
 const assets=[...require('../image-library49.json').assets,...require('../stadium-catalog116.json').assets];
 const r=auditQueue(read(opts.queue),assets,evidence);
 if(opts.out)fs.writeFileSync(path.resolve(opts.out),JSON.stringify(r,null,2)+'\n');
 process.stdout.write(JSON.stringify({artworkRetries:r.artworkRetries,classified:r.classified,
  output:opts.out||'stdout_only'})+'\n');
 return r;
}
if(require.main===module){try{main();}catch(e){console.error(e.message);process.exitCode=1;}}
module.exports={auditQueue,verifiedFixture,sportmonksVenue,sportmonksEvidence,sportmonksEvidenceBatch,COMPETITION_LABELS,main};
