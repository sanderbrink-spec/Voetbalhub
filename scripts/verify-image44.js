'use strict';
// One bounded live chain check. Existing article text and images are never written.
const fs=require('node:fs'),I=require('../editorial-image44');
const {uploadCover}=require('./automatic-publication');
async function run({secret=process.env.HUB_API_SECRET,token=process.env.GITHUB_TOKEN,fetcher=fetch}={}){
 if(!secret||!token)throw Error('Beeldcontrole vereist redactietoegang.');
 const response=await fetcher('https://voetbalhub-redactie.onrender.com/articles',{signal:AbortSignal.timeout(30000)});
 if(!response.ok)throw Error('Openbare feed ontbreekt.');
 const before=(await response.json()).articles;
 const article=before.find(a=>a.match?.homeTeam&&a.match?.awayTeam&&a.status==='published');
 if(!article)throw Error('Geen gecontroleerd wedstrijdartikel voor beeldketentest.');
 const payload={...article,articleKind:'report',draft:{headline:article.headline,standfirst:article.standfirst,body:article.body}};
 const image=await uploadCover(payload,{token,fetcher,imageOptions:{secret,budget:{remaining:2}}});
 const hosted=await fetcher(image.imageUrl,{redirect:'error',signal:AbortSignal.timeout(30000)});
 if(!hosted.ok)throw Error('Beeld niet bereikbaar.');const bytes=Buffer.from(await hosted.arrayBuffer());
 if(I.sha(bytes)!==image.imageReview.assetSha256)throw Error('Beeldbytes gewijzigd.');
 const meta=await require('sharp')(bytes).metadata();
 if(meta.format!=='webp'||meta.width!==1280||meta.height!==720)throw Error('Mobiel beeldformaat klopt niet.');
 const check=await fetcher('https://voetbalhub-redactie.onrender.com/articles',{signal:AbortSignal.timeout(30000)});
 const current=(await check.json()).articles.find(a=>a.id===article.id);
 for(const field of ['headline','standfirst','body','imageUrl','publishedAt'])if(JSON.stringify(current?.[field])!==JSON.stringify(article[field]))throw Error('Bestaand artikel onverwacht gewijzigd.');
 fs.mkdirSync('.automatic-output',{recursive:true});fs.writeFileSync('.automatic-output/image44-smoke.webp',bytes);
 const report={articleId:article.id,headline:article.headline,imageUrl:image.imageUrl,mode:image.imageReview.mode,category:image.imageReview.category,clubs:image.imageReview.clubs,review:image.imageReview.review,notes:image.imageReview.notes,assetSha256:I.sha(bytes),width:meta.width,height:meta.height,bytes:bytes.length,existingArticlePreserved:true};
 fs.writeFileSync('.automatic-output/image44-smoke.json',JSON.stringify(report,null,2));
 console.log(JSON.stringify(report));
 if(report.mode!=='ai-photographic')throw Error('Live AI-beeldcontrole eindigt met neutrale fallback; zie rapport.');
 return report;
}
if(require.main===module)run().catch(e=>{console.error(e.message);process.exitCode=1;});
module.exports={run};
