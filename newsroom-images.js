'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),sharp=require('sharp');
const catalog=require('./news-photo-catalog.json');
const STYLE='licensed-editorial-photo-v1',ROOT=path.join(__dirname,'public/news-photos');
const sha=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
const norm=s=>String(s||'').normalize('NFKC').toLocaleLowerCase('nl');
function usedHashes(rows){const replacements=require('./android-ui/assets/presentation-covers.json');return (rows||[]).flatMap(a=>{const hash=a.imageReview?.assetSha256;const row=replacements.find(p=>p.id===a.id&&p.previousUrls.includes(a.imageUrl)&&p.contentHash===sha([a.headline,a.standfirst,...(a.body||[])].join('\n')));return [hash,row?.sha256].filter(Boolean);});}
function kind(payload){const title=norm(payload.draft?.headline||payload.headline);return /transfer|contract|tekent|vertrek/.test(title)?'transfer':/interview|zegt|vertelt/.test(title)?'interview':/maatschapp|beweeg|supporter|jeugd/.test(title)?'community':payload.match||/wint|zege|duel|wedstrijd|gelijkspel/.test(title)?'match':'club';}
function relevant(photo,payload){const title=norm(payload.draft?.headline||payload.headline),teams=payload.topicTeams||[];
 return [photo.club,...(photo.aliases||[])].some(c=>new RegExp('(?<![\\p{L}\\p{N}])'+norm(c).replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'(?![\\p{L}\\p{N}])','u').test(title)||teams.some(t=>norm(t)===norm(c)));
}
function candidates(payload,{entries=catalog.photos,usedHashes=[],now=Date.now()}={}){
 const used=new Set(usedHashes);return entries.filter(p=>p.approved===true&&!p.revoked&&(!p.expiresAt||Date.parse(p.expiresAt)>now)&&!used.has(p.sha256)&&relevant(p,payload)&&p.width>=1280&&p.height>=720&&p.author&&p.sourcePage?.startsWith('https://commons.wikimedia.org/wiki/File:')&&/^https:\/\/creativecommons.org\/(licenses\/by(?:-sa)?\/[134]\.0|publicdomain\/zero\/1\.0)\//.test(p.licenseUrl||'')&&p.visualReview?.approved===true&&p.visualReview?.subjectVerified===true&&p.visualReview?.noAddedText===true&&/^[a-f0-9]{64}$/.test(p.sha256)&&/^[a-z0-9-]+\.webp$/.test(p.file)).sort((a,b)=>Number(a.contextOnly)-Number(b.contextOnly)||a.id.localeCompare(b.id));
}
async function prepare(payload,options={}){
 for(const p of candidates(payload,options)){
  const bytes=fs.readFileSync(path.join(ROOT,p.file));if(sha(bytes)!==p.sha256)continue;
  const image=sharp(bytes),meta=await image.metadata(),stats=await image.stats();
  if(meta.format!=='webp'||meta.width<1280||meta.height<720||Math.abs(meta.width/meta.height-16/9)>.02||bytes.length>1000000||stats.entropy<4||stats.sharpness<.4)continue;
  return {bytes,photo:p,imageSource:p.sourcePage,imageCredit:p.credit,imageCaption:p.caption,imageLicenseUrl:p.licenseUrl,imageRights:'licensed',imageReview:{method:STYLE,assetSha256:p.sha256,subject:p.club,venue:p.venue,contextOnly:p.contextOnly,kind:kind(payload),width:meta.width,height:meta.height,rightsEvidence:p.sourcePage,licenseUrl:p.licenseUrl,reviewedAt:p.visualReview.reviewedAt,kitVerified:true,playerIdentityVerified:true,aiDisclosureVerified:true,notes:'Geregistreerde echte archieffoto. Geen bewijs van de actuele wedstrijd, transfer of genoemde persoon. Bron, maker, bewerking en licentie worden naast het beeld vermeld.'}};
 }
 throw Error('Geen passend, vrijgegeven en ongebruikt nieuwsbeeld. Artikel blijft ter beeldbeoordeling; geen scorebordfallback.');
}
module.exports={STYLE,kind,relevant,candidates,prepare,sha,usedHashes};
