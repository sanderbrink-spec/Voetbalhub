'use strict';
const crypto=require('node:crypto');
const sha=x=>crypto.createHash('sha256').update(x).digest('hex');
const bodyHash=a=>sha(a.sections.map(s=>s.heading+'\n'+s.text+'\n').join(''));
function validateArticle(a,catalog){
 if(!a||!/^[-a-z0-9]{1,80}$/.test(a.id||'')||a.venueId!==a.id||a.status!=='published')throw Error('Invalid stadium identity');
 if(!Array.isArray(a.sections)||a.sections.length<6||!Array.isArray(a.sources)||a.sources.length<3||!Array.isArray(a.trivia)||a.trivia.length<5)throw Error('Incomplete editorial feature');
 const words=(a.standfirst+' '+a.sections.map(s=>s.heading+' '+s.text).join(' ')).trim().split(/\s+/).length;
 if(words<800||words>1200||a.wordCount!==words)throw Error('Feature must have 800–1200 words');
 const ids=new Set(a.sources.map(s=>s.id));if(ids.size!==a.sources.length||a.sources.some(s=>!/^https:\/\//.test(s.url)))throw Error('Invalid sources');
 for(const item of [...a.sections,...a.trivia])if(typeof item.text!=='string'||!item.text.trim()||!Array.isArray(item.sources)||!item.sources.length||item.sources.some(id=>!ids.has(id)))throw Error('Unsupported section or fact');
 if(!a.review?.approved||a.review.bodyHash!==bodyHash(a))throw Error('Text changed after review');
 const {review,...sealed}=a;
 if(a.contentHash!==sha(JSON.stringify(sort({...sealed,contentHash:undefined}))))throw Error('Editorial metadata changed after review');
 for(const p of [a.image,...(a.gallery||[])]){
  const original=catalog.photos.find(x=>x.id===p?.id);
  if(!original||!original.approved||p.width<1280||p.height<720||!p.visualReview?.approved)throw Error('Unapproved photograph');
  for(const key of ['sha256','file','venue','sourcePage','credit','license','licenseUrl','imageUrl'])if(p[key]!==original[key])throw Error('Photo provenance changed');
  if(p.venue!==a.venue)throw Error('Wrong stadium photograph');
 }
 return true;
}
function sort(x){if(Array.isArray(x))return x.map(sort);if(x&&typeof x==='object')return Object.fromEntries(Object.keys(x).sort().filter(k=>x[k]!==undefined).map(k=>[k,sort(x[k])]));return x;}
function seal(a){a.wordCount=(a.standfirst+' '+a.sections.map(s=>s.heading+' '+s.text).join(' ')).trim().split(/\s+/).length;const {review,...sealed}=a;delete sealed.contentHash;a.contentHash=sha(JSON.stringify(sort(sealed)));a.review={...review,contentHash:a.contentHash,bodyHash:bodyHash(a)};return a;}
function slot(now){const parts=Object.fromEntries(new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Amsterdam',year:'numeric',month:'2-digit',day:'2-digit',weekday:'short',hour:'2-digit',hourCycle:'h23'}).formatToParts(new Date(now)).map(p=>[p.type,p.value]));return {due:parts.weekday==='Mon'&&Number(parts.hour)>=9&&Number(parts.hour)<12,key:parts.year+'-'+parts.month+'-'+parts.day};}
function nextVenue(registry,published){const used=new Set(published.map(a=>a.venueId));return [...registry.venues].sort((a,b)=>a.priority-b.priority).find(a=>!used.has(a.venueId))||null;}
function advance(previous,candidate,registry,catalog,now){
 const tick=slot(now);if(!tick.due||previous.lastPublishedWeek===tick.key)return {state:previous,reason:'not_due_or_already_published',published:false};
 const next=nextVenue(registry,previous.articles);if(!next)return {state:previous,reason:'queue_complete',published:false};
 if(!candidate||candidate.venueId!==next.venueId)return {state:previous,reason:'awaiting_checked_portrait:'+next.venueId,published:false};
 if(candidate.club!==next.club||candidate.venue!==next.name)throw Error("Candidate does not match selected club and venue");
 validateArticle(candidate,catalog);
 const published=seal({...candidate,publishedAt:new Date(now).toISOString()});
 return {state:{...previous,current:candidate.id,updatedAt:new Date(now).toISOString(),lastPublishedWeek:tick.key,articles:[published,...previous.articles]},reason:'published',published:true};
}
module.exports={sha,sort,seal,validateArticle,slot,nextVenue,advance};
