'use strict';
// Rights-safe production checklist, NOT an image publisher or generator.
// Consumes the sanitized 109 audit. No provider tokens or sealed drafts needed.
const fs=require('node:fs');
const path=require('node:path');
const AUDIT_STATES=new Set([
 'requires_new_original_artwork','requires_matching_scene_artwork',
 'requires_image_rework','pending_home_image_review','requires_verified_daypart',
 'requires_verified_fixture','pending_exact_fixture_review','approved_match_available'
]);
const DAYS=new Set(['day','twilight','night']);
function safeTeam(s){
 if(typeof s!=='string'||s.length<2||s.length>80||
  !/^[\p{L}\p{N} &.'’(),/-]+$/u.test(s))return null;
 return s.trim();
}
function verified(item){
 return /^sm-\d+$/.test(item?.matchId||'') &&
  ['Sportmonks','Official','Football-Data.org'].includes(item?.fixtureSource) &&
  !!safeTeam(item.homeTeam) && !!safeTeam(item.awayTeam) &&
  item.homeTeam!==item.awayTeam &&
  typeof item.competition==='string'&&item.competition.length<75&&
  Number.isFinite(Date.parse(item.playedAt))&&
  Number.isFinite(Date.parse(item.fixtureVerifiedAt));
}
function brief(item){
 return {
  fixtureId:item.matchId,
  homeTeam:item.homeTeam,
  awayTeam:item.awayTeam,
  competition:item.competition,
  playedAt:item.playedAt,
  verifiedDaypart:item.daypart,
  homeScene:true,
  occupancy:'full',
  articleImageKind:'report',
  caption:'Originele AI-illustratie bij '+item.homeTeam+' – '+item.awayTeam+'. Geen echte wedstrijdfoto.',
  assetPath:'public/match-covers110/'+item.matchId+'.webp',
  visualPrompt:'Maak één originele, fotorealistische voetbalstadionillustratie in breed 16:9 (1280×720) bij een wedstrijdverslag van '+
   item.homeTeam+' tegen '+item.awayTeam+'. Het is een fictieve redactionele impressie, geen documentair beeld van de echte wedstrijd of het echte stadion. '+
   (item.daypart==='day'?'Duidelijk daglicht.':item.daypart==='night'?'Volledige avondduisternis, stadionverlichting aan.':'Duidelijke schemersfeer, stadionlichten aan.')+
   ' Volle, drukbezochte tribunes en geloofwaardig veld. Geen echte clubemblemen, sponsorlogo’s, bedrijfsnamen, portretten van echte spelers of nagebootste officiële clubuitingen. '+
   'Gebruik alleen Veldio-reclame op de boarding. Vermeld discreet leesbaar: "AI-illustratie, geen echte wedstrijdfoto". '+
   'Controleer vooraf afzonderlijk de echte stadionarchitectuur en clubkleuren; verzin geen identiteitsbewijzen. Geen bestaande foto of invoerbeeld overnemen.',
  verifyBeforeApproval:[
   'Exacte bron en gegenereerd basisbestand met SHA256 bewaren',
   'Herkomst en commerciële gebruiksrechten afzonderlijk aantonen',
   'Minimumscore 8,5/10 onafhankelijk beoordelen',
   'Geen officiële clublogo’s, sponsorreclame of beschermde fotografie',
   'Juist dagdeel, thuisclub, volle tribunes en duidelijk AI-onderschrift',
   'Beeld eerst pending in catalogus; nooit automatisch goedkeuren'
  ]
 };
}
function plan(audit,now=Date.now()){
 if(!audit||audit.safety?.readOnly!==true||
  audit.safety?.unlocksPublications!==false||
  !Array.isArray(audit.rows)||audit.rows.length!==audit.artworkRetries||
  audit.rows.length>1000||!Number.isFinite(now))throw Error('Niet-verifieerbaar of onveilig auditrapport.');
 const ids=new Set();
 const tasks=audit.rows.map(row=>{
  if(!AUDIT_STATES.has(row.classification)||typeof row.matchId!=='string'||ids.has(row.matchId))
   throw Error('Onbekende of dubbele beeldblokkade.');
  ids.add(row.matchId);
  const age=(now-Date.parse(row.playedAt))/3600000;
  const fresh=Number.isFinite(age)&&age>=0&&age<=36;
  const sourceVerified=verified(row);
  const sceneVerified=DAYS.has(row.daypart)&&row.daypartEvidence==='solar_venue_coordinates';
  let action;
  if(!sourceVerified)action='verify_fixture';
  else if(row.classification==='approved_match_available')action='recheck_existing_approval';
  else if(['pending_home_image_review','pending_exact_fixture_review'].includes(row.classification))action='independent_rights_review';
  else if(row.classification==='requires_verified_daypart'||!sceneVerified)action='verify_venue_first';
  else if(row.classification==='requires_image_rework')action='replace_failed_image';
  else if(row.classification==='requires_matching_scene_artwork')action='generate_matching_daypart';
  else if(row.classification==='requires_new_original_artwork')action='generate_new_original';
  else action='verify_fixture';
  const canBrief=['replace_failed_image','generate_matching_daypart','generate_new_original'].includes(action);
  const ready=canBrief&&fresh;
  return {
   matchId:row.matchId,homeTeam:sourceVerified?row.homeTeam:null,
   awayTeam:sourceVerified?row.awayTeam:null,
   competition:sourceVerified?row.competition:null,
   playedAt:sourceVerified?row.playedAt:null,daypart:sceneVerified?row.daypart:null,
   classification:row.classification,action,
   hoursSinceMatch:Number.isFinite(age)?Math.round(age*10)/10:null,
   freshForEditorial: fresh,
   readyToPrepareOriginal:ready,
   ...(canBrief&&sourceVerified&&sceneVerified?{imageBrief:brief(row)}:{}),
   ...(row.pendingExactCandidates?.length?{existingExactCandidates:row.pendingExactCandidates
     .map(c=>({id:c.id,requiresRework:c.requiresRework,
       contextMatchesDaypart:c.contextMatchesDaypart,reviewRequired:true}))}:{}),
   ...(row.pendingHomeCandidates?.length?{existingCandidates:row.pendingHomeCandidates
     .map(c=>({id:c.id,requiresRework:c.requiresRework,
       contextMatchesDaypart:c.contextMatchesDaypart,reviewRequired:true}))}:{})
  };
 });
 const score=x=> (x.readyToPrepareOriginal?0: x.action==='independent_rights_review'?1:2)*10000+
  (['Eredivisie','Keuken Kampioen Divisie'].includes(x.competition)?0:200)+
  (x.hoursSinceMatch??1000);
 tasks.sort((a,b)=>score(a)-score(b)||a.matchId.localeCompare(b.matchId));
 const counts=tasks.reduce((o,t)=>(o[t.action]=(o[t.action]||0)+1,o),{});
 const ready=tasks.filter(t=>t.readyToPrepareOriginal);
 return {
  schemaVersion:110,generatedAt:new Date(now).toISOString(),sourceAuditAt:audit.generatedAt,
  artworkRetries:tasks.length,counts,
  readyNow:ready.length,
  firstBatch:ready.slice(0,3).map(t=>t.matchId),
  safety:{createsImage:false,approvesImage:false,publishesArticle:false,
   commercialRightsStillRequired:true,editorialFreshnessHours:36,
   warning:'Beelden pas aanmaken bij geverifieerde context; onafhankelijke mensencontrole vereist voor gebruik.'},
  tasks
 };
}
function main(args=process.argv.slice(2)){
 let auditFile,outFile;
 for(let i=0;i<args.length;i+=2){
  if(args[i]==='--audit')auditFile=args[i+1];
  else if(args[i]==='--out')outFile=args[i+1];
  else throw Error('Gebruik: --audit PATH [--out PATH]');
 }
 if(!auditFile)throw Error('--audit verplicht.');
 const data=JSON.parse(fs.readFileSync(path.resolve(auditFile),'utf8'));
 const result=plan(data);
 if(outFile)fs.writeFileSync(path.resolve(outFile),JSON.stringify(result,null,2)+'\n');
 process.stdout.write(JSON.stringify({artworkRetries:result.artworkRetries,
  readyNow:result.readyNow,counts:result.counts,firstBatch:result.firstBatch})+'\n');
 return result;
}
if(require.main===module){try{main();}catch(e){console.error(e.message);process.exitCode=1;}}
module.exports={safeTeam,verified,brief,plan,main};
