'use strict';
/** Read the bounded archive in batches. Never cache a partial result or swallow storage errors. */
async function readPublished(client,keys){
 if(keys.length>2000)throw Error('ARTICLE_ARCHIVE_REVIEW_REQUIRED');
 const candidates=[];
 for(let offset=0;offset<keys.length;offset+=64){
  const batch=keys.slice(offset,offset+64);let values=[];
  if(typeof client.mGet==='function')values=await client.mGet(batch);
  else for(let i=0;i<batch.length;i+=8)values.push(...await Promise.all(batch.slice(i,i+8).map(key=>client.get(key))));
  if(!Array.isArray(values)||values.length!==batch.length)throw Error('ARTICLE_STORAGE_INCOMPLETE');
  for(const raw of values){if(!raw)continue;try{const article=JSON.parse(raw);if(article?.status==='published')candidates.push(article);}catch{}}
 }
 return candidates;
}
module.exports={readPublished};
