'use strict';
const crypto=require('node:crypto');
function reject(message,status=400){const e=Error(message);e.status=status;throw e;}
function parseManuscript(manuscript){
 if(typeof manuscript!=='string'||manuscript.length>60000||manuscript.length<500)reject('Een volledige column van 500 tot 60000 tekens is vereist.');
 const normalized=manuscript.replace(/\r\n?/g,'\n').trim(),lines=normalized.split('\n'),first=lines.shift();
 if(!/^# [^#]/.test(first))reject('De column begint met één hoofdkop.');
 const headline=first.slice(2).trim();if(headline.length<15||headline.length>200)reject('De columnkop moet 15 tot 200 tekens bevatten.');
 const plain=s=>s.replace(/\*\*([^*]+)\*\*/g,'$1').replace(/\*([^*]+)\*/g,'$1');
 const blocks=lines.join('\n').trim().split(/\n\s*\n/).filter(Boolean).map(raw=>{
  const heading=raw.match(/^(#{2,4})\s+([^\n]+)$/);return heading?{type:'heading',level:heading[1].length,text:plain(heading[2].trim())}:{type:'paragraph',text:plain(raw.trim())};
 });
 if(blocks.length<3||blocks.length>180||blocks.some(b=>!b.text||b.text.length>6000))reject('De column bevat een ongeldig aantal of formaat tekstblokken.');
 return {headline,body:blocks.map(b=>b.text),blocks,manuscript:normalized};
}
function prepareColumn(request,now=new Date().toISOString()){
 if(request.approved!==true||request.authorApproved!==true||request.intent!=='publish_author_column')reject('Persoonlijke goedkeuring en de expliciete opdracht om deze auteurscolumn te publiceren zijn vereist.');
 const author=String(request.author||'').trim();if(author.length<3||author.length>80||/[\r\n<>]/.test(author))reject('Een geldige auteursnaam is vereist.');
 const parsed=parseManuscript(request.manuscript),contentHash=crypto.createHash('sha256').update(author+'\n'+parsed.manuscript).digest('hex');
 if(request.expectedContentHash!==contentHash)reject('De goedgekeurde tekst is gewijzigd. Publicatie geblokkeerd.',409);
 const id=contentHash.slice(0,8)+'-'+contentHash.slice(8,12)+'-5'+contentHash.slice(13,16)+'-8'+contentHash.slice(17,20)+'-'+contentHash.slice(20,32);
 return {id,status:'published',type:'column',category:'De Derde Helft',author,headline:parsed.headline,standfirst:'',body:parsed.body,blocks:parsed.blocks,manuscript:parsed.manuscript,contentHash,publishedAt:now,imageRights:'not_needed',autoPublish:false,
  authorApproval:{explicit:true,method:'author_supplied_manuscript',approvedAt:now,contentHash},verificationStatus:'author_supplied_not_independently_audited'};
}
async function publishColumn(client,request,now){
 const article=prepareColumn(request,now),key='article:'+article.id,existing=await client.get(key);
 if(existing){const previous=JSON.parse(existing);if(previous.contentHash!==article.contentHash)reject('Opgeslagen column komt niet overeen met het manuscript.',409);return {status:'published',article:previous,alreadyPublished:true};}
 const normalize=s=>String(s||'').normalize('NFKC').toLocaleLowerCase('nl').replace(/\s+/g,' ').trim();
 for(const k of await client.keys('article:*')){const raw=await client.get(k);if(!raw)continue;let previous;try{previous=JSON.parse(raw);}catch{continue;}if(previous.status==='published'&&normalize(previous.headline)===normalize(article.headline))reject('Deze columnkop is al gepubliceerd. Gebruik een afzonderlijke bewerking om de bestaande column te wijzigen.',409);}
 const result=await client.set(key,JSON.stringify(article),{NX:true});if(result===null){const old=await client.get(key);if(!old)reject('Opslaan niet bevestigd.',503);return {status:'published',article:JSON.parse(old),alreadyPublished:true};}
 return {status:'published',article,alreadyPublished:false};
}
module.exports={parseManuscript,prepareColumn,publishColumn};
