'use strict';
// Discovery only. This module cannot fetch publisher pages, grant authority,
// invoke a writer, or publish. Registry entries are candidates, not approvals.
const registry = require('../scout-registry125.json');
const GDELT = 'https://api.gdeltproject.org/api/v2/doc/doc';
const LIMIT = 512 * 1024;
const LANG = {nl:'Dutch',en:'English',de:'German',es:'Spanish',it:'Italian',fr:'French',pt:'Portuguese'};
const TOPICS = {
  'eredivisie':['voetbal Eredivisie','voetbal transfer'],
  'kkd-beker':['voetbal "Keuken Kampioen Divisie"','voetbal KNVB'],
  'nederlanders-buitenland':['voetbal Nederlander transfer','football Dutch players'],
  'engeland':['football "Premier League"','football transfer'],
  'duitsland':['Fußball Bundesliga','Fußball Transfer'],
  'spanje':['fútbol Liga','fútbol fichajes'],
  'italie':['calcio "Serie A"','calcio mercato'],
  'frankrijk-belgie-portugal':['football "Ligue 1"','voetbal België','futebol Portugal'],
  'uefa-fifa':['football UEFA','football FIFA'],
  'wereld-transfers':['football transfer','football manager','football injury']
};
const TOPIC_LANG = {
  'nederlanders-buitenland':['nl','en'],
  'frankrijk-belgie-portugal':['fr','nl','pt']
};
const host = u => u.hostname.toLowerCase().replace(/^www\./,'');
function validateRegistry(r) {
  const roles = new Set(r.scouts.map(s=>s.id));
  if(roles.size!==10 || r.scouts.length!==10) throw Error('expected ten unique scout roles');
  const seen=new Set();
  for(const s of r.sources){
    if(!/^(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,}$/.test(s.domain) ||
       seen.has(s.domain) || !roles.has(s.scout) || s.access!=='candidate' ||
       s.authority!=='none' || s.usage!=='discovery_metadata_only') throw Error('invalid candidate registry');
    seen.add(s.domain);
  }
  return seen;
}
const domains=validateRegistry(registry);
function queryFor(scout, rotation=0) {
  const role=registry.scouts.find(s=>s.id===scout), topics=TOPICS[scout];
  if(!role || !topics || !Number.isSafeInteger(rotation) || rotation<0) throw Error('invalid scout or rotation');
  const index=rotation%topics.length;
  const language=TOPIC_LANG[scout]?.[index] || role.language;
  const url=new URL(GDELT);
  url.search=new URLSearchParams({
    query:topics[index]+' sourcelang:'+LANG[language],
    mode:'artlist',format:'json',timespan:'24h',maxrecords:'75',sort:'datedesc'
  });
  return url.href;
}
function normalizeCandidate(raw) {
  if(typeof raw!=='string' || raw.length>2048) return null;
  try{
    const u=new URL(raw);
    if(u.protocol!=='https:' || u.username || u.password || u.port || !domains.has(host(u)) || u.pathname==='/') return null;
    u.hash='';
    // Preserve potentially identity-bearing query parameters, not tracking.
    for(const key of [...u.searchParams.keys()]){
      if(/^utm_/i.test(key) || /^(fbclid|gclid|mc_cid|mc_eid)$/i.test(key))u.searchParams.delete(key);
    }
    return u.href;
  }catch{return null;}
}
function parseSignals(data,scout) {
  if(!Array.isArray(data?.articles))throw Error('invalid GDELT response');
  const found=new Map();
  for(const entry of data.articles.slice(0,75)){
    const url=normalizeCandidate(entry?.url);
    if(!url || found.has(url))continue;
    found.set(url,{url,domain:host(new URL(url)),scout,authority:'none',status:'unverified_discovery'});
  }
  return [...found.values()];
}
async function limitedBody(response) {
  const length=Number(response.headers?.get('content-length'));
  if(length>LIMIT){await response.body?.cancel();throw Error('response too large');}
  if(!response.body?.getReader)throw Error('missing streaming body');
  const reader=response.body.getReader(), chunks=[];
  let size=0;
  try{
    while(true){
      const {value,done}=await reader.read();
      if(done)break;
      size+=value.byteLength;
      if(size>LIMIT)throw Error('response too large');
      chunks.push(Buffer.from(value));
    }
    return Buffer.concat(chunks).toString('utf8');
  }catch(e){await reader.cancel().catch(()=>{});throw e;}
  finally{reader.releaseLock();}
}
async function scan({scout,rotation=0,fetcher=fetch}={}) {
  // One bounded request per invocation. Never follow redirects, retry 429s,
  // or fetch candidate URLs. No credentials are sent.
  const query=queryFor(scout,rotation);
  const response=await fetcher(query,{redirect:'error',signal:AbortSignal.timeout(12000),headers:{Accept:'application/json'}});
  if(!response.ok){
    await response.body?.cancel();
    return {scout,status:'unavailable',httpStatus:response.status,retryAfter:response.headers?.get('retry-after')||null,signals:[]};
  }
  const signals=parseSignals(JSON.parse(await limitedBody(response)),scout);
  return {scout,status:'ok',signals,uniqueDomains:new Set(signals.map(x=>x.domain)).size};
}
if(require.main===module){
  // Explicit manual shadow command only, no scheduler or production hooks.
  const [scout,rotation='0']=process.argv.slice(2);
  scan({scout,rotation:Number(rotation)}).then(result=>console.log(JSON.stringify(result,null,2))).catch(e=>{console.error('Scout shadow failed:',e.message);process.exitCode=1;});
}
module.exports={validateRegistry,queryFor,normalizeCandidate,parseSignals,scan};
