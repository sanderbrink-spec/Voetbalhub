'use strict';
// Veldio 110C: exact-binary provenance gate for staged match artwork.
// Never invents a reviewer, approves commercial rights, or publishes articles.
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const auditStates=new Set(['requires_new_original_artwork','requires_matching_scene_artwork','requires_image_rework']);
function sha256(buf){return crypto.createHash('sha256').update(buf).digest('hex');}
function validate(batch,audit,assets=[],root=path.resolve(__dirname,'..')){
 if(!batch||batch.schemaVersion!==1103||!Array.isArray(batch.artworks)||
    !batch.policy?.noAutomaticApproval||!batch.policy?.noAutomaticPublication||
    !batch.policy?.commercialRightsRequiresSeparateReview||
    !audit?.safety?.readOnly||audit?.safety?.unlocksPublications!==false||
    !Array.isArray(audit.rows)||!Array.isArray(assets)||batch.artworks.length>100)
  throw Error('Ongeldige of onveilige beeldinvoer.');
 const seen=new Set(),records=[];
 for(const entry of batch.artworks){
  if(!/^sm-\d+$/.test(entry?.fixtureId||'')||seen.has(entry.fixtureId)||
     !/^[a-f0-9]{64}$/.test(entry.webpSha256||'')||
     !/^[a-f0-9]{64}$/.test(entry.sourceSha256||'')||
     !Number.isSafeInteger(entry.webpDimensions?.[0])||
     !Number.isSafeInteger(entry.webpDimensions?.[1])||
     entry.webpDimensions[0]!==1280||entry.webpDimensions[1]!==720||
     entry.approval!=='pending'||entry.status!=='source_generated_not_in_repository'||
     entry.sourceInputImagesUsed!==false)
    throw Error('Ongeldig of dubbel beeldgegeven.');
  seen.add(entry.fixtureId);
  const normalizedFile=entry.webpFilename?.replace(/^veldio-/,'');
  const expectedPath='public/match-covers110/'+normalizedFile;
  if(!normalizedFile?.startsWith(entry.fixtureId+'-')||
     entry.suggestedRepoPath!==expectedPath||!/^[a-z0-9-]+\.webp$/.test(normalizedFile)||
     entry.kind!=='report'||entry.stadiumOccupancy!=='full')
    throw Error('Onveilige doelpad- of beeldtypegegevens.');
  const known=audit.rows.find(x=>x.matchId===entry.fixtureId);
  if(!known||!auditStates.has(known.classification)||known.homeTeam!==entry.homeTeam||
     known.awayTeam!==entry.awayTeam||known.competition!==entry.competition||
     known.playedAt!==entry.playedAt||known.daypart!==entry.daypart||
     known.fixtureSource!==entry.fixtureSource||
     known.daypartEvidence!=='solar_venue_coordinates')
    throw Error('Afbeelding wijkt af van geverifieerde wedstrijd en dagdeel.');
  const matched=assets.filter(x=>x.fixtureId===entry.fixtureId);
  if(matched.some(x=>x.approval==='approved'))
    throw Error('Bestaand goedgekeurd fixturebeeld; geen duplicaat importeren.');
  if(matched.some(x=>x.sha256!==entry.webpSha256))
    throw Error('Bestaande afbeelding met ander bestand voor hetzelfde fixture-ID.');
  const file=path.resolve(root,entry.suggestedRepoPath);
  if(!file.startsWith(root+path.sep))throw Error('Onveilig bronpad.');
  let status='awaiting_exact_binary_import';
  if(fs.existsSync(file)){
   const actual=sha256(fs.readFileSync(file));
   if(actual!==entry.webpSha256)throw Error('Bestandshash wijkt af van de bronvermelding.');
   status=matched.some(x=>x.sha256===actual&&x.approval==='pending')?
     'ready_for_independent_review':'awaiting_pending_catalog_registration';
  }
  records.push({
   fixtureId:entry.fixtureId,homeTeam:entry.homeTeam,awayTeam:entry.awayTeam,
   playedAt:entry.playedAt,daypart:entry.daypart,classification:known.classification,
   status,sha256:entry.webpSha256,path:entry.suggestedRepoPath,
   nextAction:status==='awaiting_exact_binary_import'?
    'Importeer exacte WEBP en controleer SHA256; niets vrijgeven.':
    status==='awaiting_pending_catalog_registration'?
    'Registreer uitsluitend approval=pending en exact dezelfde SHA256.':
    'Laat originele bron, commerciële rechten, kwaliteit en stadioncontext afzonderlijk beoordelen.'
  });
 }
 return {
  schemaVersion:1103,generatedAt:new Date().toISOString(),
  auditedAt:audit.generatedAt,artworks:records,
  summary:records.reduce((a,r)=>(a[r.status]=(a[r.status]||0)+1,a),{}),
  safety:{approvesImages:false,publishesArticles:false,
   approvalThreshold:8.5,rightsEvidenceRequired:true}
 };
}
function main(argv=process.argv.slice(2)){
 const opts={};
 for(let i=0;i<argv.length;i+=2){
  if(!['--audit','--intake','--out'].includes(argv[i])||!argv[i+1]||opts[argv[i]])
   throw Error('Gebruik --audit PATH --intake PATH [--out PATH]');
  opts[argv[i]]=argv[i+1];
 }
 if(!opts['--audit']||!opts['--intake'])throw Error('Audit en intake zijn verplicht.');
 const read=x=>JSON.parse(fs.readFileSync(path.resolve(x),'utf8'));
 const res=validate(read(opts['--intake']),read(opts['--audit']),read('image-library49.json').assets);
 if(opts['--out'])fs.writeFileSync(path.resolve(opts['--out']),JSON.stringify(res,null,2)+'\n');
 process.stdout.write(JSON.stringify({summary:res.summary,fixtureIds:res.artworks.map(x=>x.fixtureId)})+'\n');
 return res;
}
if(require.main===module){try{main();}catch(err){console.error(err.message);process.exitCode=1;}}
module.exports={sha256,validate,main};
