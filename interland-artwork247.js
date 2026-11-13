'use strict';
// Approved Veldio international-team graphics. No federation crests or claimed
// documentary stadium photographs. Never guess a country from article prose.
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const sharp=require('sharp');
const ROOT=path.join(__dirname,'public/editorial/interlands');
const ORIGIN='https://voetbalhub-redactie.onrender.com';
const ASSETS={NL:'veldio-nederland-premium.webp',WORLD:'veldio-interlands-universal.webp'};
const CACHE=new Map();
const COUNTRY=new Intl.DisplayNames(['nl'],{type:'region'});
const FILL={
 NL:['#ae1c28','#ffffff','#21468b'],DE:['#111111','#dd0000','#ffce00'],
 FR:['#0055a4','#ffffff','#ef4135'],BE:['#111111','#fdda24','#ef3340'],
 IT:['#009246','#ffffff','#ce2b37'],ES:['#aa151b','#f1bf00','#aa151b'],
 PT:['#006600','#ff0000'],IE:['#169b62','#ffffff','#ff883e'],
 AT:['#ed2939','#ffffff','#ed2939'],PL:['#ffffff','#dc143c'],
 UA:['#0057b7','#ffd700'],RU:['#ffffff','#0039a6','#d52b1e'],
 AR:['#74acdf','#ffffff','#74acdf'],CO:['#fcd116','#003893','#ce1126'],
 JP:['#ffffff'],BR:['#009c3b'],GB:['#012169']
};
const VERTICAL=new Set(['FR','BE','IT','IE','PT']);
const esc=x=>String(x).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));
const normalize=v=>String(v||'').trim().toUpperCase();
function countryCode(v){
 const c=normalize(v);
 if(!/^[A-Z]{2}$/.test(c))return '';
 try{const name=COUNTRY.of(c);return name&&name!==c?c:'';}catch{return '';}
}
function detect(article={}){
 const d=article.draft||article;
 const f=article.fixture||article.match||d.fixture||d.match||{};
 const national=article.isInternational===true||article.nationalTeams===true||
  f.isInternational===true||f.nationalTeams===true||f.teamType==='national';
 if(!national)return null;
 const home=countryCode(f.homeCountryCode||f.home?.countryCode);
 const away=countryCode(f.awayCountryCode||f.away?.countryCode);
 const explicit=countryCode(article.countryCode||d.countryCode||
  article.nationalTeamCode||d.nationalTeamCode);
 const code=explicit||(home==='NL'||away==='NL'?'NL':home||away);
 if(!code)return null;
 return {code,countryName:COUNTRY.of(code),variant:code==='NL'?'netherlands-premium':'universal'};
}
function verified(name){
 const full=path.join(ROOT,name);
 if(!fs.existsSync(full))return null;
 let review;
 try{review=JSON.parse(fs.readFileSync(path.join(ROOT,'approved.json'),'utf8'))[name];}
 catch{return null;}
 const bytes=fs.readFileSync(full);
 if(bytes.length<10000||bytes.length>2000000||!review)return null;
 const hash=crypto.createHash('sha256').update(bytes).digest('hex');
 if(review.sha256!==hash||review.rightsCleared!==true||
    review.qualityApproved!==true||review.logoVerified!==true||
    review.noFederationLogos!==true)return null;
 return {hash,bytes};
}
function flagSvg(code){
 const colors=FILL[code];
 if(!colors)return '<rect width="118" height="76" fill="#123022"/><circle cx="59" cy="38" r="25" fill="none" stroke="#aaff44" stroke-width="3"/><text x="59" y="45" font-size="23" font-family="sans-serif" font-weight="bold" fill="#ffffff" text-anchor="middle">'+esc(code)+'</text>';
 let shapes='';
 if(code==='JP')return '<rect width="118" height="76" fill="#ffffff"/><circle cx="59" cy="38" r="22" fill="#bc002d"/>';
 if(code==='BR')return '<rect width="118" height="76" fill="#009c3b"/><path d="M59 10 105 38 59 66 13 38Z" fill="#ffdf00"/><circle cx="59" cy="38" r="20" fill="#002776"/>';
 if(code==='GB')return '<rect width="118" height="76" fill="#012169"/><path stroke="#fff" stroke-width="16" d="M0 0 118 76M118 0 0 76"/><path stroke="#c8102e" stroke-width="7" d="M0 0 118 76M118 0 0 76"/><path stroke="#fff" stroke-width="22" d="M59 0V76M0 38H118"/><path stroke="#c8102e" stroke-width="12" d="M59 0V76M0 38H118"/>';
 const vertical=VERTICAL.has(code);
 colors.forEach((c,i)=>{
  const x=vertical?118*i/colors.length:0,y=vertical?0:76*i/colors.length;
  shapes+='<rect x="'+x+'" y="'+y+'" width="'+(vertical?118/colors.length:118)+'" height="'+(vertical?76:76/colors.length)+'" fill="'+c+'"/>';
 });
 return shapes;
}
function labelOverlay(info){
 const label=info.countryName.length>17?49:info.countryName.length>12?58:68;
 return Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="1672" height="941"><defs><linearGradient id="b" x2="1" y2="0"><stop stop-color="#04110a"/><stop offset="1" stop-color="#0f2c13"/></linearGradient></defs><rect x="42" y="482" width="917" height="180" rx="20" fill="url(#b)"/><rect x="42" y="482" width="917" height="7" fill="#aaff36"/><rect x="75" y="524" width="130" height="83" rx="9" fill="#ffffff"/><svg x="81" y="528" width="118" height="76" viewBox="0 0 118 76">'+flagSvg(info.code)+'</svg><text x="246" y="600" fill="#ffffff" font-family="DejaVu Sans,Arial,sans-serif" font-size="'+label+'" font-weight="bold">'+esc(info.countryName)+'</text></svg>');
}
function imageUrl(info){return ORIGIN+'/interland-artwork/'+info.code.toLowerCase()+'.webp';}
function select(article){
 const info=detect(article);
 if(!info)return null;
 const filename=info.code==='NL'?ASSETS.NL:ASSETS.WORLD;
 const asset=verified(filename);
 if(!asset)return null;
 return {imageUrl:imageUrl(info),imageAssetId:'interland-'+info.code.toLowerCase()+'-'+asset.hash.slice(0,12),
  imageRights:'cleared',imageSource:'Veldio · eigen AI-illustratie',
  imageCredit:'Veldio',imageReview:{method:'interland-artwork247',assetSha256:asset.hash,
   countryCode:info.code,variant:info.variant,kitVerified:true,
   playerIdentityVerified:true,aiDisclosureVerified:true,noFederationLogos:true}};
}
async function render(code){
 const c=countryCode(code);
 if(!c) return null;
 const info={code:c,countryName:COUNTRY.of(c),variant:c==='NL'?'netherlands-premium':'universal'};
 const base=verified(c==='NL'?ASSETS.NL:ASSETS.WORLD);
 if(!base)return null;
 const cacheKey=c+':'+base.hash;
 if(CACHE.has(cacheKey))return CACHE.get(cacheKey);
 const bytes=c==='NL'?base.bytes:await sharp(base.bytes).resize(1672,941,{fit:'fill'})
  .composite([{input:labelOverlay(info)}]).webp({quality:87}).toBuffer();
 if(CACHE.size>120)CACHE.clear();
 CACHE.set(cacheKey,bytes);
 return bytes;
}
async function serve(req,res,pathname){
 const match=/^\/interland-artwork\/([a-z]{2})\.webp$/.exec(pathname);
 if(!match)return false;
 if(!['GET','HEAD'].includes(req.method)){
  res.writeHead(405,{'Allow':'GET, HEAD'});res.end();return true;
 }
 try{
  const bytes=await render(match[1]);
  if(!bytes){res.writeHead(404);res.end();return true;}
  res.writeHead(200,{'Content-Type':'image/webp','Content-Length':bytes.length,
   'Cache-Control':'public,max-age=86400','X-Content-Type-Options':'nosniff'});
  res.end(req.method==='HEAD'?undefined:bytes);
 }catch{
  res.writeHead(503,{'Content-Type':'text/plain','Cache-Control':'no-store'});
  res.end('Interlandbeeld tijdelijk niet beschikbaar.');
 }
 return true;
}
module.exports={ASSETS,countryCode,detect,select,render,serve,flagSvg};
