'use strict';
const {uploadCover}=require('./automatic-publication');
const API='https://voetbalhub-redactie.onrender.com';
async function run({secret,token,fetcher=fetch}={}){
 if(!secret||!token)throw Error('Publicatie-instellingen ontbreken.');
 const feed=await fetcher(API+'/articles',{signal:AbortSignal.timeout(25000)});
 if(!feed.ok)throw Error('Nieuwsfeed niet beschikbaar.');
 const before=(await feed.json()).articles;
 if(!Array.isArray(before))throw Error('Ongeldige nieuwsfeed.');
 const changed=[];
 for(const a of before){
  // Only migrate the old automatically generated covers. Preserve selected match artwork.
  if(a.status!=='published'||!String(a.imageUrl).startsWith('https://raw.githubusercontent.com/sanderbrink-spec/Voetbalhub/')||!String(a.imageUrl).includes('/automatic-covers/'))continue;
  const image=await uploadCover({draft:{headline:a.headline,standfirst:a.standfirst,body:a.body},category:a.category},{token,fetcher});
  if(image.imageUrl===a.imageUrl)continue;
  const response=await fetcher(API+'/article-image',{method:'POST',headers:{Authorization:'Bearer '+secret,'Content-Type':'application/json'},body:JSON.stringify({approved:true,articleId:a.id,...image}),signal:AbortSignal.timeout(25000)});
  const result=await response.json();
  if(!response.ok||result.updated!==true||result.article?.imageUrl!==image.imageUrl)throw Error('Afbeeldingsupdate niet bevestigd.');
  changed.push({id:a.id,imageUrl:image.imageUrl});
 }
 const check=await fetcher(API+'/articles',{signal:AbortSignal.timeout(25000)});
 if(!check.ok)throw Error('Controle nieuwsfeed mislukt.');
 const after=(await check.json()).articles;
 for(const update of changed){
  const old=before.find(a=>a.id===update.id),current=after.find(a=>a.id===update.id);
  if(current?.imageUrl!==update.imageUrl)throw Error('Afbeelding ontbreekt in app-feed.');
  for(const key of ['headline','standfirst','body','publishedAt'])if(JSON.stringify(old[key])!==JSON.stringify(current[key]))throw Error('Artikelinhoud onverwacht gewijzigd.');
 }
 return {updated:changed.length};
}
if(require.main===module)run({secret:process.env.HUB_API_SECRET,token:process.env.GITHUB_TOKEN}).then(console.log).catch(e=>{console.error(e.message);process.exitCode=1;});
module.exports={run};
