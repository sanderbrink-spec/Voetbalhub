'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {occupancyFor}=require('./match-image-context');
const premium=require('./premium-match-images72');
const stadium74=require('./stadium-venue74');
const ROOT=__dirname,ORIGIN='https://voetbalhub-redactie.onrender.com';
const categories=['preview','report','transfer','rumour','contract','club','injury','tactics','competition','championship','analysis','interview','youth','supporters','suspension','international','history','quiz','neutral'];
const norm=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]/g,'');
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
function validate(rows,{root=ROOT}={}){
 if(!Array.isArray(rows)||rows.length>2000)throw Error('Maximaal 2000 afbeeldingen.');const ids=new Set();
 for(const a of rows){if(!/^[a-z0-9-]{1,80}$/.test(a.id||'')||ids.has(a.id))throw Error('Ongeldige of dubbele beeld-ID.');ids.add(a.id);
 if(!/^(public\/[a-zA-Z0-9_/-]+\.(webp|png|jpg|svg))$/.test(a.file||'')||a.file.includes('..'))throw Error('Ongeldig bestand.');
 if(!Array.isArray(a.categories)||!a.categories.length||a.categories.some(c=>typeof c!=='string'||!/^[a-z-]{1,40}$/.test(c)))throw Error('Categorie ontbreekt.');
 for(const k of ['clubs','competitions','keywords','questionIds'])if(!Array.isArray(a[k])||a[k].some(s=>typeof s!=='string'||s.length>150))throw Error('Ongeldige metadata: '+k);
 if(!['day','twilight','night','neutral'].includes(a.daypart)||!['approved','pending','rejected'].includes(a.approval)||!a.subject||!a.variant||!a.origin||!a.rights||!a.caption||!(a.lastUsed===null||Number.isFinite(Date.parse(a.lastUsed))))throw Error('Onvolledige metadata.');
 if((a.imageKind || a.stadiumOccupancy || a.stadiumIdentity) &&
   (!['preview','report'].includes(a.imageKind) || a.stadiumOccupancy!==occupancyFor(a.imageKind) ||
    !a.categories.includes(a.imageKind) || a.clubs.length!==2 ||
    !/^(home|venue):[a-z0-9]+$/.test(a.stadiumIdentity||'')))throw Error('Ongeldige stadionbezetting: '+a.id);
 if(a.fixtureId&&(!/^sm-\d+$/.test(a.fixtureId)||a.clubs.length!==2||!a.categories.some(c=>c==='report'||c==='preview')))throw Error('Ongeldig wedstrijdbestand.');
 if(a.homeClubReusable && (a.clubs?.length!==2 || a.clubs[1]!=='*' || a.fixtureId ||
    !a.stadiumIdentity || a.stadiumIdentity!=='home:'+norm(a.clubs[0]) ||
    !Array.isArray(a.homeVenueAliases) || a.homeVenueAliases.some(s=>typeof s!=='string'||s.length>100)))
    throw Error('Ongeldige generieke thuisstadion-asset: '+a.id);
 if(a.approval==='approved'&&(!a.reviewer||!['original-ai','original-vector','licensed'].includes(a.rights)||!a.rightsEvidence))throw Error('Goedkeuring en rechtenbewijs vereist.');
 const full=path.resolve(root,a.file);if(!full.startsWith(path.resolve(root)+path.sep)||!fs.existsSync(full)||fs.statSync(full).size>2000000||sha(fs.readFileSync(full))!==a.sha256)throw Error('Bestand ontbreekt, te groot of hash ongeldig: '+a.id);
 if(a.file.endsWith('.svg')){
  const source=fs.readFileSync(full,'utf8');
  // Reviewable, local-only vector sources. Never fetch an external SVG resource.
  if(a.rights!=='original-vector'||!/^<svg\s[^>]*xmlns="http:\/\/www\.w3\.org\/2000\/svg"/.test(source)||
     /<\s*(?:script|foreignObject|iframe|image|use|object|embed|a)\b|\b(?:href|src)\s*=|<!ENTITY|url\(\s*(?!#)/i.test(source))
    throw Error('Onveilig of niet-goedgekeurd vectorbestand: '+a.id);
 }
 }return rows;
}
let checked=null;
function catalog(){if(!checked)checked=validate(require('./image-library49.json').assets).filter(premium.accepted);return checked;}
function context(payload){const I=require('./editorial-image44'),p=I.classify(payload),d=payload.draft||payload,text=[d.headline,d.standfirst].join(' ').toLowerCase();let category=payload.imageCategory||payload.articleKind;
 if(['match_report','score_update'].includes(category))category='report';
 if(!categories.includes(category))category=p.category==='match'?'preview':p.category==='transfer'?(/gerucht|mogelijk|interesse/.test(text)?'rumour':'transfer'):'club';
 for(const [re,c] of [[/contractverleng|verlengt/, 'contract'],[/blessur|revalid|geblesseerd/,'injury'],[/trainer|tactiek|formatie/,'tactics'],[/schorsing|geschorst/,'suspension'],[/interview|persconferentie/,'interview'],[/jeugd|talent/,'youth'],[/kampioen|titel/,'championship'],[/statistiek|analyse/,'analysis'],[/supporter|stadion/,'supporters']])if(!['preview','report'].includes(category)&&re.test(text)){category=c;break;}
 const f=payload.fixture||payload.match||{};return {category,fixtureId:payload.matchId,clubs:p.clubs.map(c=>c.name),competition:f.competition||payload.competition||payload.category||'',daypart:daypart(f),
  stadiumIdentity:require('./match-image-context').stadiumFor(f,p.clubs[0]?.name),
  venueName:f.venue?.name||f.venueName||'',articleId:payload.id||d.id||p.identity};
}
// Solar elevation uses verified venue coordinates and an absolute kickoff; otherwise neutral.
function daypart(f){const stamp=f.date||f.playedAt,lat=f.venue?.latitude,lon=f.venue?.longitude;if(!/(Z|[+-]\d\d:\d\d)$/.test(stamp||'')||!Number.isFinite(Date.parse(stamp))||!Number.isFinite(lat)||!Number.isFinite(lon)||Math.abs(lat)>90||Math.abs(lon)>180)return 'neutral';const t=new Date(stamp),n=Math.floor((Date.UTC(t.getUTCFullYear(),t.getUTCMonth(),t.getUTCDate())-Date.UTC(t.getUTCFullYear(),0,0))/86400000),g=2*Math.PI/365*(n-1+(t.getUTCHours()-12)/24),eq=229.18*(.000075+.001868*Math.cos(g)-.032077*Math.sin(g)-.014615*Math.cos(2*g)-.040849*Math.sin(2*g)),dec=.006918-.399912*Math.cos(g)+.070257*Math.sin(g)-.006758*Math.cos(2*g)+.000907*Math.sin(2*g)-.002697*Math.cos(3*g)+.00148*Math.sin(3*g),ha=((t.getUTCHours()*60+t.getUTCMinutes()+eq+4*lon)/4-180)*Math.PI/180,phi=lat*Math.PI/180,elevation=Math.asin(Math.sin(phi)*Math.sin(dec)+Math.cos(phi)*Math.cos(dec)*Math.cos(ha))*180/Math.PI;return elevation>6?'day':elevation>=-6?'twilight':'night';}
function choose(ctx,rows=catalog(),usage={}){let candidates=rows.filter(a=>premium.accepted(a)&&a.categories.includes(ctx.category)&&(!a.fixtureId||a.fixtureId===ctx.fixtureId)&&(!a.competitions.length||a.competitions.includes(ctx.competition))&&(!a.clubs.length||a.clubs.length===(ctx.clubs||[]).length&&(a.homeClubReusable ? a.clubs[1]==='*' && norm(a.clubs[0])===norm(ctx.clubs[0]) : a.clubs.every((c,i)=>norm(c)===norm(ctx.clubs[i]))))&&(a.daypart==='neutral'||a.daypart===ctx.daypart));
 if(['preview','report','match-analysis','recap'].includes(ctx.category)){
  candidates=candidates.filter(a=>stadium74.allowedForMatch(a,{...ctx,category:ctx.category==='preview'?'preview':'report'}));
 }
 if(ctx.category==='quiz')candidates=candidates.filter(a=>a.questionIds.includes(ctx.questionId)&&a.answerSafe===true);if(!candidates.length&&!['quiz','preview','report','match-analysis','recap'].includes(ctx.category))candidates=rows.filter(a=>premium.accepted(a)&&a.categories.includes('neutral')&&!a.clubs.length&&a.daypart==='neutral');return candidates.sort((a,b)=>Number(Boolean(b.fixtureId))-Number(Boolean(a.fixtureId))||Number(Boolean(b.clubs.length))-Number(Boolean(a.clubs.length))||Number(b.daypart===ctx.daypart)-Number(a.daypart===ctx.daypart)||(Date.parse(usage[a.id]||a.lastUsed)||0)-(Date.parse(usage[b.id]||b.lastUsed)||0)||sha(ctx.articleId+':'+a.id).localeCompare(sha(ctx.articleId+':'+b.id)))[0]||null;}
function fields(a, context){
 return {
  imageUrl:ORIGIN+'/'+a.file.slice(7).replace(/\.svg$/,'.webp'), imageAssetId:a.id, imageRights:'cleared',
  imageSource:'Veldio · illustratie', imageCredit:a.caption,
  ...(a.rights==='original-ai'?{imageLicenseUrl:a.rightsEvidence.startsWith('https://')?a.rightsEvidence:undefined}:{}),
  imageReview:{method:'approved-library49',mode:'approved-library',pipelineVersion:49,
   assetSha256:a.sha256,kitVerified:true,playerIdentityVerified:true,aiDisclosureVerified:true,clubs:a.clubs,
   ...(a.imageKind?{imageKind:a.imageKind,stadiumOccupancy:a.stadiumOccupancy,stadiumIdentity:a.stadiumIdentity,
     ...(a.homeClubReusable?{homeClubReusable:true}:{}),
     ...(context?.imageIdentity?{imageIdentity:context.imageIdentity}:{})}:{}),
   generated:a.rights==='original-ai',qualityTier:a.fixtureId?'reviewed-fixture':'contextual-illustration',
   ...(premium.isMatch(a)?a.visualReview?{visualQualityScore:a.visualReview.score,visualQualityStatus:'premium-reviewed'}:{visualQualityStatus:'legacy-raster-awaiting-rescore'}:{}),
   ...(a.fixtureId?{fixtureId:a.fixtureId,noOfficialLogos:true,noRecognizablePeople:true,noDocumentaryClaim:true}:{})}
 };
}
function applyFixtureCover(article,rows=catalog()){
 const match=article.match;
 if(!match||!article.matchId||article.status!=='published'||!['match_report','score_update'].includes(article.articleKind))return article;
 // Existing individually reviewed artwork takes precedence over a generic upgrade.
 const retired=premium.isRetiredReference(article,require('./image-library49.json').assets);
 if(!retired&&article.imageUrl&&!article.imageUrl.endsWith('/veldio-arena.webp')&&article.imageReview?.qualityTier!=='contextual-illustration')return article;
 const asset=rows.filter(a=>a.fixtureId===article.matchId&&premium.accepted(a)&&
  a.imageKind==='report'&&a.stadiumOccupancy==='full'&&
  a.competitions.includes(article.category)&&norm(a.clubs[0])===norm(match.homeTeam)&&norm(a.clubs[1])===norm(match.awayTeam))
  .sort((a,b)=>(Date.parse(b.approvedAt)||0)-(Date.parse(a.approvedAt)||0))[0];
 if(!asset){
  if(!retired)return article;
  const cleared={...article,imageQualityStatus:'awaiting-premium-replacement'};
  for(const key of ['imageUrl','imageAssetId','imageReview','imageCaption','imageVariants','imageRotation','imageSource','imageCredit'])delete cleared[key];
  return cleared;
 }
 return {...article,...fields(asset),imageAsset:undefined,imageCaption:asset.caption};
}
async function select(payload,{client,now=Date.now()}={}){const ctx=context(payload);let usage={};if(client?.isReady){const fixtureCover=choose(ctx,catalog().filter(a=>a.fixtureId===ctx.fixtureId&&a.fixtureId));if(fixtureCover)return fixtureCover;const fixed=await client.get('images49:article:'+ctx.articleId);const prior=catalog().find(a=>a.id===fixed);if(prior&&choose(ctx,[prior]))return prior;usage=await client.hGetAll('images49:usage');}const a=choose(ctx,undefined,usage);if(a&&client?.isReady){await client.set('images49:article:'+ctx.articleId,a.id,{EX:90*86400});await client.hSet('images49:usage',a.id,new Date(now).toISOString());}return a;}
const vectorRenderCache=new Map();
function serve(req,res,pathname){
 if(!['GET','HEAD'].includes(req.method))return false;
 const asset=catalog().find(a=>'/'+a.file.slice(7).replace(/\.svg$/,'.webp')===pathname);
 if(!asset)return false;
 const answer=bytes=>{
  if(res.writableEnded)return;
  res.writeHead(200,{'Content-Type':asset.file.endsWith('.svg')||asset.file.endsWith('.webp')?'image/webp':asset.file.endsWith('.png')?'image/png':'image/jpeg',
   'Content-Length':bytes.length,'Cache-Control':'public,max-age=86400','X-Content-Type-Options':'nosniff'});
  res.end(req.method==='HEAD'?undefined:bytes);
 };
 if(asset.file.endsWith('.svg')){
  // Cached, rasterized WEBP serves Android; no SVG execution or external image URL.
  if(!vectorRenderCache.has(asset.sha256)){
   const file=fs.readFileSync(path.join(ROOT,asset.file));
   const rendering=require('sharp')(file,{limitInputPixels:1280*720}).resize(1280,720,{fit:'fill'})
    .webp({quality:82}).toBuffer().then(bytes=>{
     if(bytes.length>2_000_000)throw Error('Vectorbeeld te groot.');
     return bytes;
    }).catch(error=>{vectorRenderCache.delete(asset.sha256);throw error;});
   vectorRenderCache.set(asset.sha256,rendering);
  }
  vectorRenderCache.get(asset.sha256).then(answer).catch(()=>{
   if(res.writableEnded)return;
   res.writeHead(503,{'Content-Type':'text/plain; charset=utf-8','Cache-Control':'no-store'});
   res.end('Beeld tijdelijk niet beschikbaar.');
  });
  return true;
 }
 answer(fs.readFileSync(path.join(ROOT,asset.file)));
 return true;
}
module.exports={categories,validate,catalog,context,daypart,choose,fields,applyFixtureCover,select,serve};
