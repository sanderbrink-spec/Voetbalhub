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
  match:value.match?{homeTeam:String(value.match.homeTeam||'').trim().slice(0,100),awayTeam:String(value.match.awayTeam||'').trim().slice(0,100),homeScore:Number.isInteger(value.match.homeScore)?value.match.homeScore:null,awayScore:Number.isInteger(value.match.awayScore)?value.match.awayScore:null,playedAt:String(value.match.playedAt||'').slice(0,10)}:null,
  factChecks:Object.fromEntries(['resultVerified','namesVerified','dateVerified','timelineVerified'].map(k=>[k,value.factChecks?.[k]===true])),
  reviewNotes:String(value.reviewNotes||'').trim().slice(0,3000),
  category:String(value.category||'Voetbal').slice(0,80),
  verifiedFacts:Array.isArray(value.verifiedFacts)?value.verifiedFacts.filter(x=>typeof x==='string').map(x=>x.trim().slice(0,5000)).filter(Boolean).slice(0,20):[],
  sources:Array.isArray(value.sources)?value.sources.filter(x=>x&&typeof x.url==='string').map(x=>({url:x.url.trim().slice(0,1500)})).slice(0,10):[],
  editorialChecks:Object.fromEntries(['originalSourceReviewed','claimsIndependentlyChecked','duplicateChecked','languageChecked'].map(k=>[k,value.editorialChecks?.[k]===true])),
  imageUrl:String(value.imageUrl||'').slice(0,1000),imageSource:String(value.imageSource||'').slice(0,300),imageCredit:String(value.imageCredit||'').slice(0,200),imageRights:String(value.imageRights||'not_needed'),imageCaption:String(value.imageCaption||'').slice(0,500),imageLicenseUrl:String(value.imageLicenseUrl||'').slice(0,300),
  imageReview:{...Object.fromEntries(['kitVerified','playerIdentityVerified','aiDisclosureVerified'].map(k=>[k,value.imageReview?.[k]===true])),...Object.fromEntries(['method','assetSha256','subject','venue','kind','rightsEvidence','licenseUrl','reviewedAt','width','height','contextOnly','generated','notes'].filter(k=>value.imageReview?.[k]!==undefined).map(k=>[k,typeof value.imageReview[k]==='string'?value.imageReview[k].slice(0,1000):value.imageReview[k]]))}
 };
}
const fingerprint=value=>crypto.createHash('sha256').update(JSON.stringify(cleanPayload(value))).digest('hex');
async function getDraft(client,id){if(!validId(id))throw problem(400,'Ongeldig concept-ID.');const raw=await client.get(PREFIX+id);if(!raw)throw problem(404,'Concept niet gevonden.');return JSON.parse(raw);}
async function saveDraft(client,{id,expectedRevision,payload,approve=false,state='draft',issues=[],verification=null}){
 if(!['draft','needs_review','rejected','publication_failed'].includes(state))throw problem(400,'Ongeldige conceptstatus.');
 const p=cleanPayload(payload);
 if(!p.draft.headline)throw problem(400,'Vul eerst een kop of onderwerp in.');
 let previous=null;
 if(id){previous=await getDraft(client,id);if(previous.status==='published')throw problem(409,'Dit artikel is al gepubliceerd. Maak een nieuw concept voor een nieuwe versie.');if(expectedRevision!==previous.revision)throw problem(409,'Dit concept is elders gewijzigd. Laad de nieuwste versie voordat je opslaat of goedkeurt.');}
 if(approve){
  const issues=publicationIssues(p);if(headlineContradictions(p.draft))issues.push('Controleer de tegenstrijdige uitslag in de kop.');
  if(issues.length)throw problem(400,'Goedkeuren geblokkeerd: '+issues.join(' '));
 }
 const now=new Date().toISOString();
 const record={id:id||Date.now()+'-'+crypto.randomUUID(),revision:(previous?.revision||0)+1,status:approve?'approved':state,createdAt:previous?.createdAt||now,updatedAt:now,payload:p,contentHash:fingerprint(p),...(previous?.automation?{automation:previous.automation}:{}),...(approve?{approvedAt:now}:{}),issues:Array.isArray(issues)?issues.filter(x=>typeof x==='string').map(x=>x.slice(0,1000)).slice(0,20):[],verification:cleanVerification(verification||previous?.verification),autoPublish:false};
 if(record.verification)record.verification.current=record.verification.contentHash===record.contentHash;
 const stored=await client.eval(CAS,{keys:[PREFIX+record.id],arguments:[String(previous?.revision||0),JSON.stringify(record)]});
 if(Number(stored)!==1)throw problem(409,'Dit concept is ondertussen gewijzigd. Laad de nieuwste versie.');
 return record;
}
function cleanVerification(value){
 if(!value||typeof value!=='object')return null;
 return {contentHash:String(value.contentHash||'').slice(0,64),method:String(value.method||'').slice(0,100),checkedAt:String(value.checkedAt||'').slice(0,40),
  sources:(Array.isArray(value.sources)?value.sources:[]).slice(0,10).map(s=>({url:String(s.url||'').slice(0,1500),sha256:String(s.sha256||'').slice(0,64),publishedAt:String(s.publishedAt||'').slice(0,40)})),
  checks:(Array.isArray(value.checks)?value.checks:[]).filter(x=>typeof x==='string').slice(0,20).map(x=>x.slice(0,1000)),
  claims:(Array.isArray(value.claims)?value.claims:[]).slice(0,10).map(f=>({text:String(f.text||'').slice(0,1000),evidence:(Array.isArray(f.evidence)?f.evidence:[]).slice(0,4).map(e=>({source:e.source,quote:String(e.quote||'').slice(0,800)}))}))};
}
// Reservation and budget are one Redis operation. A crash leaves a visible needs_review record.
async function reserveAutomatic(client,{key,payload},now=Date.now()){
 if(!/^[0-9a-f]{64}$/.test(key||''))throw problem(400,'Ongeldige automatische onderwerpidentiteit.');
 const p=cleanPayload(payload);if(!p.draft.headline)throw problem(400,'Onderwerp ontbreekt.');
 const day=new Intl.DateTimeFormat('sv-SE',{timeZone:'Europe/Amsterdam'}).format(new Date(now));
 const record={id:now+'-'+crypto.randomUUID(),revision:1,status:'needs_review',createdAt:new Date(now).toISOString(),updatedAt:new Date(now).toISOString(),payload:p,contentHash:fingerprint(p),automation:{key,day},issues:['Automatische verwerking gestart; bij onderbreking handmatig controleren.'],autoPublish:false};
 const result=await client.eval(`local prior=redis.call('GET',KEYS[1]); if prior then return prior end
 if tonumber(redis.call('GET',KEYS[2]) or '0')>=tonumber(ARGV[3]) then return 'daily_limit' end
 redis.call('INCR',KEYS[2]); redis.call('EXPIRE',KEYS[2],259200)
 redis.call('SET',KEYS[1],ARGV[1]); redis.call('SET',KEYS[3],ARGV[2]); return 'reserved'`,{keys:['editorial:auto-topic:'+key,'editorial:auto-budget:'+day,PREFIX+record.id],arguments:[record.id,JSON.stringify(record),String(Math.max(0,Math.min(20,Number(require('./automatic-editorial.json').maxPerDay)||0)))]});
 if(result==='reserved')return {reserved:true,record};
 return {reserved:false,reason:result==='daily_limit'?'daily_limit':'already_processed'};
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
module.exports={getDraft,saveDraft,listDrafts,markPublished,fingerprint,cleanPayload,reserveAutomatic};
