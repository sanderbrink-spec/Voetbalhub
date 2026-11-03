'use strict';
const {createHash}=require('node:crypto');
const canonical=value=>String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
// Revalidate approval and write article, identity and draft state atomically.
async function publishOnce(client,article,record,expectedVersion=null){
 const textIdentity=createHash('sha256').update(canonical((article.body||[]).join(' '))).digest('hex');
 const identity=createHash('sha256').update(canonical(article.headline)).digest('hex');
 const result=await client.eval(`
 local existing=redis.call('GET',KEYS[1]); if existing then return {'existing',existing} end
 local prior=redis.call('GET',KEYS[2]) or redis.call('GET',KEYS[4]); if prior then return {'duplicate',prior} end
 if ARGV[6]~='' and tostring(redis.call('GET',KEYS[5]) or '0')~=ARGV[6] then return {'busy',''} end
 local draft=nil
 if ARGV[2]~='' then
  local raw=redis.call('GET',KEYS[3]); if not raw then return {'stale',''} end
  draft=cjson.decode(raw)
  if draft.status~='approved' or tonumber(draft.revision)~=tonumber(ARGV[2]) or draft.contentHash~=ARGV[3] then return {'stale',''} end
 end
 if ARGV[7]~='' then
  local owner=redis.call('HGET',KEYS[6],ARGV[7]);if owner and owner~=ARGV[4] then return {'image_duplicate',''} end
  if redis.call('HLEN',KEYS[6])>=2000 then return {'image_capacity',''} end
  if ARGV[8]~='' then
   local hashes=redis.call('HKEYS',KEYS[7]);for _,old in ipairs(hashes) do
    local distance=0;for i=1,16,2 do local n=bit.bxor(tonumber(string.sub(old,i,i+1),16),tonumber(string.sub(ARGV[8],i,i+1),16));while n>0 do distance=distance+bit.band(n,1);n=bit.rshift(n,1) end end
    if distance<=6 then return {'image_duplicate',''} end
   end
  end
  redis.call('HSET',KEYS[6],ARGV[7],ARGV[4]);if ARGV[8]~='' then redis.call('HSET',KEYS[7],ARGV[8],ARGV[4]) end
 end
 redis.call('INCR',KEYS[5]); redis.call('SET',KEYS[1],ARGV[1]); redis.call('SET',KEYS[2],ARGV[4]); redis.call('SET',KEYS[4],ARGV[4])
 if draft then draft.status='published'; draft.revision=draft.revision+1; draft.articleId=ARGV[4]; draft.publishedAt=ARGV[5]; draft.updatedAt=ARGV[5]; redis.call('SET',KEYS[3],cjson.encode(draft)) end
 return {'published',ARGV[1]}`,{keys:['article:'+article.id,'editorial:published-title:'+identity,record?'editorial-draft:'+record.id:'editorial:unused','editorial:published-body:'+textIdentity,'editorial:publication-version','editorial:published-image43','editorial:published-perceptual43'],arguments:[JSON.stringify(article),record?String(record.revision):'',record?.contentHash||'',article.id,article.publishedAt,expectedVersion===null?'':String(expectedVersion),article.imageReview?.method==='approved-editorial43'?article.imageReview.assetSha256||'':'',article.imageReview?.method==='approved-editorial43'&&/^[a-f0-9]{16}$/.test(article.imageReview.perceptualHash||'')?article.imageReview.perceptualHash:'']});
 if(['duplicate','stale','busy','image_duplicate','image_capacity'].includes(result[0])){
  const error=Error(result[0].startsWith('image_')?'Beeldduplicaat of beeldarchiefgrens: redactionele controle vereist.':result[0]==='busy'?'Een andere publicatie is zojuist opgeslagen. Probeer dezelfde goedgekeurde versie opnieuw.':result[0]==='duplicate'?'Dubbele publicatie geblokkeerd.':'De goedgekeurde conceptversie is ondertussen gewijzigd.');error.status=result[0]==='busy'?503:409;throw error;
 }
 return JSON.parse(result[1]);
}
module.exports={publishOnce};
