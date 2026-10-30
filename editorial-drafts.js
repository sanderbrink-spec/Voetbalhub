'use strict';
const crypto=require('node:crypto');
const {publicationIssues}=require('./editorial-desk-model');
const {headlineContradictions}=require('./editorial-quality');
const PREFIX='editorial-draft:';
const validId=id=>/^\d{13}-[0-9a-f-]{36}$/.test(String(id||''));
const CAS=`local current = redis.call('GET', KEYS[1])
local expected = tonumber(ARGV[1])
if current then
  local record = cjson.decode(current)
  if tonumber(record.revision) ~= expected then return 0 end
elseif expected ~= 0 then return 0 end
redis.call('SET', KEYS[1], ARGV[2])
return 1`;
function problem(status,message){const e=new Error(message);e.status=status;return e;}
function cleanPayload(value={}){
 const d=value.draft||{};
 return {
  draft:{headline:String(d.headline||'').trim().slice(0,200),standfirst:String(d.standfirst||'').trim().slice(0,700),body:Array.isArray(d.body)?d.body.filter(x=>typeof x==='string').map(x=>x.trim().slice(0,6000)).filter(Boolean).slice(0,5):[],why_it_matters:String(d.why_it_matters||'').slice(0,1000)},
  category:String(value.category||'Voetbal').slice(0,80),
  verifiedFacts:Array.isArray(value.verifiedFacts)?value.verifiedFacts.filter(x=>typeof x==='string').map(x=>x.trim().slice(0,5000)).filter(Boolean).slice(0,20):[],
  sources:Array.isArray(value.sources)?value.sources.filter(x=>x&&typeof x.url==='string').map(x=>({url:x.url.trim().slice(0,1500)})).slice(0,10):[],
  editorialChecks:Object.fromEntries(['originalSourceReviewed','claimsIndependentlyChecked','duplicateChecked','languageChecked'].map(k=>[k,value.editorialChecks?.[k]===true])),
  imageUrl:String(value.imageUrl||'').slice(0,1000),imageSource:String(value.imageSource||'').slice(0,300),imageCredit:String(value.imageCredit||'').slice(0,200),imageRights:String(value.imageRights||'not_needed'),
  imageReview:Object.fromEntries(['kitVerified','playerIdentityVerified','aiDisclosureVerified'].map(k=>[k,value.imageReview?.[k]===true]))
 };
}
const fingerprint=value=>crypto.createHash('sha256').update(JSON.stringify(cleanPayload(value))).digest('hex');
async function getDraft(client,id){if(!validId(id))throw problem(400,'Ongeldig concept-ID.');const raw=await client.get(PREFIX+id);if(!raw)throw problem(404,'Concept niet gevonden.');return JSON.parse(raw);}
async function saveDraft(client,{id,expectedRevision,payload,approve=false}){
 const p=cleanPayload(payload);
 if(!p.draft.headline)throw problem(400,'Vul eerst een kop of onderwerp in.');
 let previous=null;
 if(id){previous=await getDraft(client,id);if(previous.status==='published')throw problem(409,'Dit artikel is al gepubliceerd. Maak een nieuw concept voor een nieuwe versie.');if(expectedRevision!==previous.revision)throw problem(409,'Dit concept is elders gewijzigd. Laad de nieuwste versie voordat je opslaat of goedkeurt.');}
 if(approve){
  const issues=publicationIssues(p);if(headlineContradictions(p.draft))issues.push('Controleer de tegenstrijdige uitslag in de kop.');
  if(issues.length)throw problem(400,'Goedkeuren geblokkeerd: '+issues.join(' '));
 }
 const now=new Date().toISOString();
 const record={id:id||Date.now()+'-'+crypto.randomUUID(),revision:(previous?.revision||0)+1,status:approve?'approved':'draft',createdAt:previous?.createdAt||now,updatedAt:now,payload:p,contentHash:fingerprint(p),...(approve?{approvedAt:now}:{}),autoPublish:false};
 const stored=await client.eval(CAS,{keys:[PREFIX+record.id],arguments:[String(previous?.revision||0),JSON.stringify(record)]});
 if(Number(stored)!==1)throw problem(409,'Dit concept is ondertussen gewijzigd. Laad de nieuwste versie.');
 return record;
}
async function listDrafts(client){
 const keys=(await client.keys(PREFIX+'*')).sort().reverse().slice(0,200);
 const rows=[];
 for(const key of keys){try{const raw=await client.get(key);if(raw)rows.push(JSON.parse(raw));}catch(error){if(error instanceof SyntaxError)continue;throw error;}}
 return rows.sort((a,b)=>String(b.updatedAt).localeCompare(String(a.updatedAt)));
}
async function markPublished(client,record,articleId){
 const next={...record,revision:record.revision+1,status:'published',articleId,publishedAt:new Date().toISOString()};
 await client.eval(CAS,{keys:[PREFIX+record.id],arguments:[String(record.revision),JSON.stringify(next)]});
}
module.exports={getDraft,saveDraft,listDrafts,markPublished,fingerprint,cleanPayload};
