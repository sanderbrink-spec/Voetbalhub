'use strict';
// Read-only audit of stored editorial artwork retries. Never decrypts
// editorial checkpoints or changes approved images, queue state or articles.
const fs=require('node:fs');
const path=require('node:path');
const rotation=require('../image-rotation65');
const {norm}=require('../stadium-venue74');

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
function sportmonksEvidence(response){
 if(response?.source!=='Sportmonks Football API'||response?.status!=='available'||
   response?.competition!=='eredivisie'||!Array.isArray(response.fixtures)||
   response.fixtures.length>500)return [];
 return response.fixtures.filter(f=>f?.status==='FT'&&
   f?.resultSource==='Sportmonks Football API'&&typeof f.id==='string'&&
   /^sm-\d+$/.test(f.id)&&typeof f.home?.name==='string'&&
   typeof f.away?.name==='string'&&dateMs(f.date)&&dateMs(f.checkedAt))
 .map(f=>({id:f.id,homeTeam:f.home.name,awayTeam:f.away.name,
  competition:'Eredivisie',playedAt:f.date,verifiedAt:f.checkedAt,
  evidenceSource:'Sportmonks'}));
}
function auditQueue(queue,assets,fixtureEvidence=[],now=Date.now()){
 const records=Array.isArray(queue)?queue:queue?.records;
 if(!Array.isArray(records)||!Array.isArray(assets)||!Array.isArray(fixtureEvidence))throw Error('Ongeldige auditinvoer.');
 const evidence=new Map(fixtureEvidence.filter(x=>x&&typeof x.id==='string').map(x=>[x.id,x]));
 const blocked=records.filter(j=>j?.status==='retry'&&j?.reason==='awaiting_approved_artwork'&&
   j?.failureStage==='artwork'&&/^(?:sm|uefa)-\d+$/.test(j?.matchId||''));
 const rows=blocked.map(job=>{
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
   .map(x=>({id:x.id,sha256:x.sha256,sceneDaypart:x.sceneDaypart||x.daypart,
    reviewRequired:true,contextMatchesDaypart:(x.sceneDaypart||x.daypart)===context.daypart}))
   .sort((a,b)=>a.id.localeCompare(b.id));
  const classification=approved.length?'approved_match_available':
   pending.length?'pending_home_image_review':'requires_new_original_artwork';
  return {...base,classification,homeTeam:match.homeTeam,awayTeam:match.awayTeam,
   playedAt:match.playedAt,competition:match.competition,
   fixtureSource:match.source,fixtureVerifiedAt:match.verifiedAt,
   daypart:context.daypart,daypartEvidence:context.daypart==='neutral'?'insufficient_venue_coordinates':'solar_venue_coordinates',
   approvedAssetIds:approved,pendingHomeCandidates:pending,
   why:approved.length?'Passend reeds goedgekeurd beeld gevonden; controleer alsnog actuele factcheck en publicatiepoort.':
    pending.length?'Beeld bestaat voor dezelfde thuisclub, maar is NIET vrijgegeven en dagdeel kan afwijken.':
    'Geen bestaand goedgekeurd of pending thuisclubbeeld in de gecontroleerde catalogus.'
  };
 }).sort((a,b)=>(dateMs(b.createdAt)||0)-(dateMs(a.createdAt)||0)||a.matchId.localeCompare(b.matchId));
 const counts=rows.reduce((o,x)=>(o[x.classification]=(o[x.classification]||0)+1,o),{});
 return {schemaVersion:109,generatedAt:new Date(now).toISOString(),
  queueRecords:records.length,artworkRetries:rows.length,classified:counts,
  blockedWithoutVerifiedFixture:counts.requires_verified_fixture||0,
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
 const evidence=opts.fixtures?read(opts.fixtures):opts.sportmonks?sportmonksEvidence(read(opts.sportmonks)):[];
 const r=auditQueue(read(opts.queue),require('../image-library49.json').assets,evidence);
 if(opts.out)fs.writeFileSync(path.resolve(opts.out),JSON.stringify(r,null,2)+'\n');
 process.stdout.write(JSON.stringify({artworkRetries:r.artworkRetries,classified:r.classified,
  output:opts.out||'stdout_only'})+'\n');
 return r;
}
if(require.main===module){try{main();}catch(e){console.error(e.message);process.exitCode=1;}}
module.exports={auditQueue,verifiedFixture,sportmonksEvidence,main};
