'use strict';
const crypto=require('node:crypto');
const {withArticleCover}=require('../article-covers');
const API='https://voetbalhub-redactie.onrender.com';
async function run({secret,fetcher=fetch}) {
 if(!secret)throw Error('Redactiesleutel ontbreekt.');
 async function articles(){
  const response=await fetcher(API+'/articles',{signal:AbortSignal.timeout(25000)});
  if(!response.ok)throw Error('Openbare feed onbereikbaar: HTTP '+response.status);
  const data=await response.json();
  if(!Array.isArray(data.articles))throw Error('Openbare feed heeft een ongeldig formaat.');
  return data.articles;
 }
 const before=await articles();
 const updates=[];
 for(const article of before){
  if(article.status!=='published'||article.imageUrl)continue;
  const linked=withArticleCover(article);
  if(!linked.imageUrl)continue;
  if(!/^[0-9a-f-]{36}$/i.test(article.id))throw Error('Ongeldig gepubliceerd artikel-ID.');
  // Verify the immutable hosted asset before publishing a URL to Android clients.
  const image=await fetcher(linked.imageUrl,{redirect:'error',signal:AbortSignal.timeout(25000)});
  if(!image.ok||!/^image\/webp(?:;|$)/i.test(image.headers.get('content-type')||''))throw Error('Afbeelding niet direct als WebP beschikbaar.');
  const bytes=Buffer.from(await image.arrayBuffer());
  if(crypto.createHash('sha256').update(bytes).digest('hex')!==linked.imageReview.assetSha256)throw Error('Gehoste afbeelding wijkt af van het gecontroleerde beeld.');
  const response=await fetcher(API+'/article-image',{
   method:'POST',headers:{Authorization:'Bearer '+secret,'Content-Type':'application/json'},
   signal:AbortSignal.timeout(25000),body:JSON.stringify({
    approved:true,articleId:article.id,imageUrl:linked.imageUrl,imageSource:linked.imageSource,
    imageCredit:linked.imageCredit,imageRights:linked.imageRights,imageReview:linked.imageReview
   })
  });
  const result=await response.json();
  if(!response.ok||result.updated!==true||result.article?.imageUrl!==linked.imageUrl)throw Error('Afbeeldingskoppeling niet bevestigd: HTTP '+response.status);
  updates.push({id:article.id,imageUrl:linked.imageUrl});
 }
 if(updates.length){
  const after=await articles();
  for(const update of updates){
   const visible=after.find(a=>a.id===update.id);
   const original=before.find(a=>a.id===update.id);
   if(visible?.imageUrl!==update.imageUrl||visible.imageRights!=='cleared')throw Error('Afbeelding ontbreekt in de openbare feed.');
   if(JSON.stringify([visible.headline,visible.standfirst,visible.body,visible.publishedAt])!==JSON.stringify([original.headline,original.standfirst,original.body,original.publishedAt]))throw Error('Artikeltekst of publicatiedatum is onverwacht gewijzigd.');
  }
 }
 return {updated:updates.length,articles:updates.map(x=>x.id)};
}
if(require.main===module)run({secret:process.env.HUB_API_SECRET}).then(result=>console.log(JSON.stringify(result))).catch(error=>{console.error(error.message);process.exitCode=1;});
module.exports={run};
