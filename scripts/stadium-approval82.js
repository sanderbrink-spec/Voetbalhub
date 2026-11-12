'use strict';
// Individuele, SHA256-gebonden stadionbeeldvrijgave. Geen automatische scores of toestemming.
// Voorbeeld: node scripts/stadium-approval82.js --template veldio74-ajax-preview
//            node scripts/stadium-approval82.js --review review.json
//            node scripts/stadium-approval82.js --review review.json --apply
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const root=path.resolve(__dirname,'..');
const manifestPath=path.join(root,'image-library49.json');
const findings=require('../stadium-review-findings79.json').findings;
const gate=require('../premium-match-images72');
const library=require('../image-library49');
const norm=require('../stadium-venue74').norm;
const checks=['photorealism','clubNames','stadiumContext','rights','aiNotDocumentary'];
function assetById(id,assets=require(manifestPath).assets){
 const a=assets.find(x=>x.id===id&&x.homeClubReusable===true);
 if(!a)throw Error('Onbekend stadionbeeld: '+String(id));
 return a;
}
function template(id,assets=require(manifestPath).assets){
 const a=assetById(id,assets);
 return {assetId:a.id,assetSha256:a.sha256,club:a.clubs[0],kind:a.imageKind,
  score:null,reviewer:'',reviewedAt:'',notes:'',
  rightsEvidence:'',humanConfirmation:'',
  checked:Object.fromEntries(checks.map(k=>[k,false]))};
}
function verify(review,{assets=require(manifestPath).assets,base=root}={}){
 if(!review||typeof review!=='object'||Array.isArray(review))throw Error('Beoordeling ontbreekt.');
 const a=assetById(review.assetId,assets);
 if(a.approval!=='pending')throw Error('Beeld is niet in afwachting van beoordeling.');
 if(findings[a.id])throw Error('Bekend herstelprobleem: herstel eerst het beeld en voer de risicoherbeoordeling uit.');
 if(review.assetSha256!==a.sha256)throw Error('Beeld is gewijzigd: oude beoordeling niet geldig.');
 if(review.club!==a.clubs[0]||review.kind!==a.imageKind)throw Error('Club of beeldtype komt niet overeen.');
 if(!Number.isFinite(review.score)||review.score<8.5||review.score>10)throw Error('Kwaliteitsscore minimaal 8,5/10 vereist.');
 if(typeof review.reviewer!=='string'||review.reviewer.trim().length<3||review.reviewer.length>100)throw Error('Naam onafhankelijke reviewer ontbreekt.');
 if(!/^\d{4}-\d{2}-\d{2}$/.test(review.reviewedAt||'')||
  !Number.isFinite(Date.parse(review.reviewedAt))||new Date(review.reviewedAt).toISOString().slice(0,10)!==review.reviewedAt||
  Date.parse(review.reviewedAt)>Date.now()+86400_000)throw Error('Datum van de werkelijk uitgevoerde beoordeling ongeldig.');
 // Synthetic test dossiers and placeholders must never be accepted as real reviews.
 const syntheticMarker=/\\b(?:synthetisch(?:e)?|synthetic|qa[- ]?test|testdossier|dummy|placeholder|fictief|niet geschikt voor werkelijke|not for production)\\b/i;
 if(syntheticMarker.test([review.reviewer,review.notes,review.rightsEvidence].join(' ')))
  throw Error('Synthetische of testbeoordeling is geen geldige commerciële vrijgave.');
 if(typeof review.notes!=='string'||review.notes.trim().length<30||review.notes.length>4000)
  throw Error('Vul minimaal 30 tekens concrete, beeldspecifieke visuele bevindingen in.');
 if(typeof review.rightsEvidence!=='string'||review.rightsEvidence.trim().length<40||
  review.rightsEvidence.length>4000||/\b(pending|onbekend|nog controleren|review vereist|te onderzoeken)\b/i.test(review.rightsEvidence))
  throw Error('Concrete bewijsgrond voor commercieel beeldgebruik ontbreekt of is onbeslist.');
 if(review.humanConfirmation!=='Ik heb dit exacte beeld zelf gecontroleerd')
  throw Error('Bevestig expliciet dat dit exacte beeld persoonlijk is gecontroleerd.');
 for(const key of checks)if(review.checked?.[key]!==true)throw Error('Vereiste controle ontbreekt: '+key);
 const full=path.resolve(base,a.file||'');
 if(!full.startsWith(path.resolve(base)+path.sep))throw Error('Ongeldig afbeeldingspad.');
 const bytes=fs.readFileSync(full);
 if(crypto.createHash('sha256').update(bytes).digest('hex')!==a.sha256)throw Error('Afbeeldinghash komt niet overeen.');
 const reviewer=review.reviewer.trim();
 const updated={...a,approval:'approved',reviewer,
  rightsEvidence:review.rightsEvidence.trim(),approvedAt:new Date().toISOString(),
  visualReview:{score:review.score,style:'photorealistic',assetSha256:a.sha256,
   checked:Object.fromEntries(checks.map(k=>[k,true])),reviewer,reviewedAt:review.reviewedAt,
   clubScope:'home-only',scopeHome:norm(a.clubs[0]),reviewedStadiumIdentity:a.stadiumIdentity,
   notes:review.notes.trim()}};
 if(!gate.accepted(updated))throw Error('Publicatiepoort weigert deze beoordeling.');
 library.validate(assets.map(x=>x.id===a.id?updated:x),{root:base});
 return updated;
}
function apply(review,{manifest=manifestPath,base=root}={}){
 const data=JSON.parse(fs.readFileSync(manifest,'utf8'));
 const approved=verify(review,{assets:data.assets,base});
 data.assets=data.assets.map(x=>x.id===approved.id?approved:x);
 const tmp=manifest+'.review82-'+process.pid+'.tmp';
 try{fs.writeFileSync(tmp,JSON.stringify(data,null,2)+'\n',{flag:'wx'});fs.renameSync(tmp,manifest);}
 catch(err){try{fs.unlinkSync(tmp);}catch{}throw err;}
 return approved;
}
if(require.main===module){
 const args=process.argv.slice(2);
 try{
  if(args[0]==='--template'&&args.length===2){
   process.stdout.write(JSON.stringify(template(args[1]),null,2)+'\n');
  }else if(args[0]==='--review'&&[2,3].includes(args.length)&&
    (args.length===2||args[2]==='--apply')){
   const file=path.resolve(process.cwd(),args[1]);
   const review=JSON.parse(fs.readFileSync(file,'utf8'));
   const candidate=args.includes('--apply')?apply(review):verify(review);
   process.stdout.write((args.includes('--apply')?'VRIJGEGEVEN':'CONTROLE GESLAAGD (nog niet vrijgegeven)')+
    ': '+candidate.id+' sha256='+candidate.sha256+'\n');
  }else throw Error('Gebruik --template ID of --review BESTAND [--apply].');
 }catch(err){process.stderr.write('VRIJGAVE GEBLOKKEERD: '+err.message+'\n');process.exitCode=1;}
}
module.exports={template,verify,apply,checks};
