'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),sharp=require('sharp'),legacy=require('./newsroom-images');
const hash=x=>crypto.createHash('sha256').update(x).digest('hex');
const norm=x=>String(x||'').normalize('NFKC').toLowerCase();
function analyze(payload){
 const d=payload.draft||payload,text=norm(d.headline),copy=norm([d.headline,d.standfirst,...(d.body||[])].join(' '));
 const directory=require('./android-ui/assets/club-directory.json').clubs;
 const clubs=directory.filter(c=>new RegExp('(?<![\\p{L}\\p{N}])'+c.name.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'(?![\\p{L}\\p{N}])','u').test(text)).map(c=>c.name);
 for(const [word,name]of [['fortuna','Fortuna Sittard'],['groningen','FC Groningen'],['sparta','Sparta Rotterdam'],['heerenveen','sc Heerenveen'],['emmen','FC Emmen'],['den bosch','FC Den Bosch'],['midtjylland','FC Midtjylland']])if(text.includes(word)&&!clubs.includes(name))clubs.push(name);
 const kind=/maatschapp|beweeg|jeugdproject/.test(text)?'community':/column|opinie/i.test(payload.type||payload.category||'')?'opinion':/transfer|contract|tekent|vertrek/.test(text)?'transfer':/interview|zegt|vertelt/.test(text)?'interview':/stadion|tribune/.test(text)?'stadium':/ontvangt|voorbeschouw|speelt.+(?:tegen|uitduel)|vooruitblik/.test(text)?'preview':/wint|zege|duel|wedstrijd|gelijkspel|voorsprong|overwinning/.test(text)?'report':'club';
 return {clubs,kind,homeClub:payload.match?.homeTeam||null,competition:payload.competition||(/eredivisie/.test(copy)?'Eredivisie':/conference league/.test(copy)?'Conference League':null),cacheKey:hash(JSON.stringify(['editorial43',d.headline,d.standfirst,d.body])),prompt:'Editorial '+kind+' illustration, club context '+clubs.join(' / ')+'. No fake match action, people, logos or false documentary claims. Disclose generated imagery.'};
}
async function perceptual(bytes){const data=await sharp(bytes).rotate().resize(9,8,{fit:'fill'}).greyscale().raw().toBuffer();let n=0n;for(let y=0;y<8;y++)for(let x=0;x<8;x++)n=(n<<1n)|BigInt(data[y*9+x]>data[y*9+x+1]);return n.toString(16).padStart(16,'0');}
function distance(a,b){if(!/^[a-f0-9]{16}$/.test(a||'')||!/^[a-f0-9]{16}$/.test(b||''))return 64;let n=BigInt('0x'+a)^BigInt('0x'+b),count=0;while(n){count++;n&=n-1n;}return count;}
function displayed(rows){const manifest=require('./android-ui/assets/presentation-covers43.json');return (rows||[]).flatMap(a=>{const copy=hash([a.headline,a.standfirst,...(a.body||[])].join('\n'));const row=manifest.find(r=>r.id===a.id&&r.contentHash===copy&&(r.previousUrls.includes(a.imageUrl)||r.imageUrl===a.imageUrl));return row?[row]:[];});}
function usedHashes(rows){return [...new Set([...legacy.usedHashes(rows),...displayed(rows).map(r=>r.imageReview.assetSha256)])];}
function usedPerceptual(rows){return [...(rows||[]),...displayed(rows)].map(a=>a.imageReview?.perceptualHash).filter(Boolean);}
async function validate(bytes,options={}){const meta=await sharp(bytes).metadata();if(!['webp','jpeg','png'].includes(meta.format)||meta.width<1280||meta.height<720||Math.abs(meta.width/meta.height-16/9)>.03||bytes.length>1000000)throw Error('Beeldformaat of bestandsgrootte niet goedgekeurd.');const sha=hash(bytes),ph=await perceptual(bytes);if((options.usedHashes||[]).includes(sha)||(options.usedPerceptualHashes||[]).some(p=>distance(ph,p)<=6))throw Error('Dubbele of vrijwel identieke afbeelding; redactionele beeldcontrole nodig.');return {sha256:sha,perceptualHash:ph,width:meta.width,height:meta.height};}
async function prepare(payload,options={}){
 const context=analyze(payload),manifest=require('./editorial-images43.json');
 const rows=manifest.assets.filter(p=>p.review?.approved===true&&p.topics.includes(context.kind)&&p.clubs.length&&p.clubs.every(c=>context.clubs.includes(c))&&p.clubs.length===context.clubs.length);
 for(const p of rows){if((options.usedHashes||[]).includes(p.sha256))continue;const bytes=fs.readFileSync(path.join(__dirname,'public/news43',p.file));if(hash(bytes)!==p.sha256)throw Error('Beeldhash komt niet overeen met vrijgave.');let fingerprint;try{fingerprint=await validate(bytes,options);}catch(e){if(/Dubbele/.test(e.message))continue;throw e;}
  return {bytes,photo:p,imageRights:'cleared',imageCredit:'Veldio · AI-illustratie',imageCaption:p.caption,imageSource:'https://github.com/sanderbrink-spec/Voetbalhub/blob/work/veldio-43/editorial-images43.json',imageLicenseUrl:manifest.terms,imageReview:{...fingerprint,assetSha256:p.sha256,method:'approved-editorial43',publicationGate43:true,generated:true,contextOnly:true,cacheKey:context.cacheKey,kind:context.kind,subject:context.clubs.join(' – '),semanticReviewApproved:true,rightsEvidence:p.id,kitVerified:true,playerIdentityVerified:true,aiDisclosureVerified:true}};
 }
 // Registered documentary archive photos apply to club/stadium/match topics only.
 if(['club','stadium','report','preview'].includes(context.kind)){
  for(const p of legacy.candidates(payload,options))try{const media=await legacy.prepare(payload,{...options,entries:[p]});const fingerprint=await validate(media.bytes,options);return {...media,imageReview:{...media.imageReview,...fingerprint,publicationGate43:true,semanticReviewApproved:true,kind:context.kind,cacheKey:context.cacheKey}};}catch(e){if(!/Dubbele/.test(e.message))throw e;}
 }
 const e=Error('Geen passend, vrijgegeven en ongebruikt beeld. Artikel blijft needs_review; geen generieke stadionfallback.');e.code='IMAGE_REVIEW_REQUIRED';e.generationRequest=context;throw e;
}
module.exports={analyze,prepare,validate,perceptual,distance,usedHashes,usedPerceptual};
