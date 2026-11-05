'use strict';
/** Versioned presentation only: never mutates article storage or text approvals. */
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const sha=x=>crypto.createHash('sha256').update(x).digest('hex');
function apply(article,{origin='https://voetbalhub-redactie.onrender.com'}={}){
 const rows=require('./android-ui/assets/presentation-covers43.json');
 const copy=sha([article.headline,article.standfirst,...(article.body||[])].join('\n'));
 const row=rows.find(r=>r.id===article.id&&r.contentHash===copy&&(r.previousUrls.includes(article.imageUrl)||r.imageUrl===article.imageUrl||origin+'/news43/'+r.imageAsset.split('/').pop()===article.imageUrl));
 if(!row)return safeLegacy(article,origin);
 const file=row.imageAsset.split('/').pop(),proof=require('./editorial-images43.json').assets.find(p=>p.file===file&&p.review?.approved===true&&p.sha256===row.imageReview.assetSha256);
 if(!proof)return safeLegacy(article,origin);
 return {...article,...Object.fromEntries(Object.entries(row).filter(([k])=>k.startsWith('image'))),imageUrl:origin+'/news43/'+file};
}
function safeLegacy(article,origin){
 if(article.imageReview?.method!=='fixture-specific-stadium-and-logos-v4')return article;
 const hash=sha([article.headline,article.standfirst,...(article.body||[])].join('\n'));
 const proof=require('./legacy-media48.json').find(r=>r.id===article.id&&r.contentHash===hash);
 const imageUrl=proof?origin+'/article-covers/'+proof.file:origin+'/editorial/veldio-arena.webp';
 return {...article,imageUrl,imageAsset:undefined,imageSource:'Veldio · eigen illustratie',imageCredit:'Veldio · eigen abstracte illustratie, geen foto van de beschreven wedstrijd',imageRights:'cleared',imageReview:{method:'self-authored-safe48',noOfficialLogos:true,noRecognizablePeople:true,noDocumentaryClaim:true,...(proof?{assetSha256:proof.assetSha256,clubs:proof.clubs}:{})}};
}
const buffers=new Map();
let catalogue=null,loading=null,lastRefresh=0;
async function refresh(){if(loading)return loading;loading=require('./youtube-catalog43').collect({key:process.env.YOUTUBE_API_KEY,previous:catalogue}).then(data=>{catalogue=data;lastRefresh=Date.now();}).catch(()=>{}).finally(()=>{loading=null;});return loading;}
function serve(req,res,pathname){
 if(!['GET','HEAD'].includes(req.method))return false;
 if(pathname==='/integrations/videos43'){
  if(!catalogue)catalogue=require('./videos/catalog43.json');
  if(Date.now()-lastRefresh>6*3600000)void refresh();
  const data=Date.parse(catalogue.expiresAt)>Date.now()?catalogue:{schemaVersion:43,videos:[],playlistStatus:'temporarily-unavailable',expiresAt:new Date(Date.now()+60000).toISOString()};
  const body=JSON.stringify(data);res.writeHead(200,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'public,max-age=300','Content-Length':Buffer.byteLength(body),'X-Content-Type-Options':'nosniff'});res.end(req.method==='HEAD'?undefined:body);return true;
 }
 if(!/^\/news43\/[a-z0-9-]+\.webp$/.test(pathname))return false;
 const file=pathname.split('/').pop(),entry=require('./editorial-images43.json').assets.find(p=>p.file===file&&p.review?.approved===true);
 if(!entry)return false;
 let bytes=buffers.get(file);if(!bytes){bytes=fs.readFileSync(path.join(__dirname,'public/news43',file));if(sha(bytes)!==entry.sha256){res.writeHead(503);res.end();return true;}buffers.set(file,bytes);}
 res.writeHead(200,{'Content-Type':'image/webp','Content-Length':bytes.length,'Cache-Control':'public,max-age=86400','X-Content-Type-Options':'nosniff'});res.end(req.method==='HEAD'?undefined:bytes);return true;
}
module.exports={apply,serve};
