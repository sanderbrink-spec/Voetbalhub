'use strict';
const fs=require('node:fs'),path=require('node:path');
const {prepareColumn}=require('../column-publication');
const API='https://voetbalhub-redactie.onrender.com';
async function publish({packet,secret,fetcher=fetch,wait=ms=>new Promise(r=>setTimeout(r,ms)),attempts=36}){
 if(!secret)throw Error('Redactiesleutel ontbreekt.');
 const expected=prepareColumn(packet);let ready=false;
 for(let i=0;i<attempts;i++){
  try{const r=await fetcher(API+'/health',{signal:AbortSignal.timeout(15000)});if(r.ok){const h=await r.json();if(h.manualAuthorColumns===true&&h.storage==='connected'){ready=true;break;}}}catch{}
  if(i<attempts-1)await wait(15000);
 }
 if(!ready)throw Error('Nieuwe columnfunctie is nog niet beschikbaar; er is niets gepubliceerd.');
 const response=await fetcher(API+'/publish-column',{method:'POST',headers:{Authorization:'Bearer '+secret,'Content-Type':'application/json'},body:JSON.stringify(packet),signal:AbortSignal.timeout(40000)}),result=await response.json();
 if(!response.ok||result.status!=='published'||result.article?.id!==expected.id||result.article?.contentHash!==expected.contentHash)throw Error('Publicatie niet bevestigd: '+(result.error||response.status));
 const r=await fetcher(API+'/articles',{signal:AbortSignal.timeout(30000)});if(!r.ok)throw Error('Openbare leescontrole mislukt.');const feed=await r.json(),article=feed.articles?.find(a=>a.id===expected.id);
 if(!article||article.type!=='column'||article.author!==expected.author||article.manuscript!==expected.manuscript||JSON.stringify(article.body)!==JSON.stringify(expected.body))throw Error('De openbare column komt niet volledig overeen met het goedgekeurde manuscript.');
 return {status:'published',id:article.id,headline:article.headline,author:article.author,paragraphs:article.body.length,contentHash:article.contentHash,alreadyPublished:result.alreadyPublished,publishedAt:article.publishedAt};
}
if(require.main===module){
 const config=JSON.parse(fs.readFileSync('redactie/columns/publish.json','utf8'));
 if(!/^redactie\/columns\/[a-z0-9-]+\.md$/.test(config.manuscriptPath))throw Error('Ongeldig manuscriptpad.');
 const packet={...config,manuscript:fs.readFileSync(path.resolve(config.manuscriptPath),'utf8')};delete packet.manuscriptPath;
 publish({packet,secret:process.env.HUB_API_SECRET}).then(r=>console.log(JSON.stringify(r))).catch(e=>{console.error(e.message);process.exitCode=1;});
}
module.exports={publish};
