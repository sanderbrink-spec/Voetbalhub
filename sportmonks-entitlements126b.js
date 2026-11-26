'use strict';
// Read-only subscription capability inventory. Never publish or log provider records.
const probes=[
 ['liveScores','football/livescores',{},'All Livescores'],
 ['transfers','football/transfers/latest',{per_page:1,order:'desc'},'Latest Transfers'],
 ['players','football/players',{per_page:1},'All Players'],
 ['teams','football/teams',{per_page:1},'All Teams'],
 ['standings','football/standings',{per_page:1},'All Standings'],
 ['seasons','football/seasons',{per_page:1},'All Seasons'],
 ['historicalFixtures','football/fixtures',{per_page:1},'All Fixtures'],
 ['coaches','football/coaches',{per_page:1},'All Coaches'],
 ['referees','football/referees',{per_page:1},'All Referees'],
 ['venues','football/venues',{per_page:1},'All Venues'],
 ['transferRumours','football/transfer-rumours',{per_page:1},'All Transfer Rumours']
];
const clean=s=>typeof s==='string'?s.replace(/[\x00-\x1f]/g,'').slice(0,160):'';
async function inspect({token,fetcher=fetch,sourceBody=async r=>r.text(),maxCalls=16}={}){
 if(!token)return {status:'not_configured',requests:0};
 let requests=0,stop=null;
 const start=Date.now(),budget=Math.min(20,Math.max(3,Number.isInteger(maxCalls)?maxCalls:16)),quotas={};
 async function read(path,params={}){
  if(Date.now()-start>=40000)stop='time_budget';
  if(stop||requests>=budget)return {status:'not_tested',reason:stop||'request_budget'};
  const url=new URL('https://api.sportmonks.com/v3/'+path);
  for(const [k,v] of Object.entries(params))url.searchParams.set(k,String(v));
  requests++;
  try{
   const response=await fetcher(url.href,{headers:{Authorization:token,Accept:'application/json'},redirect:'error',signal:AbortSignal.timeout(6000)});
   if(!response.ok){
    try{await response.body?.cancel();}catch{}
    if([401,429].includes(response.status))stop='http_'+response.status;
    return {status:response.status===403?'access_denied':'http_'+response.status};
   }
   const body=JSON.parse(await sourceBody(response)),r=body.rate_limit;
   if(r&&typeof r.requested_entity==='string'&&Number.isFinite(r.remaining)){
    quotas[clean(r.requested_entity)]={remaining:r.remaining,resetSeconds:Number.isFinite(r.resets_in_seconds)?r.resets_in_seconds:null};
    if(r.remaining<=25)stop='quota_reserve';
   }
   if(!Array.isArray(body.data))return {status:'invalid_response'};
   return {status:body.data.length?'available':'empty',data:body.data,hasMore:body.pagination?.has_more===true};
  }catch{return {status:'unavailable'};}
 }
 const features=await read('my/enrichments'),resources=await read('my/resources'),usage=await read('my/usage');
 const featureNames=[...new Set((features.data||[]).map(x=>clean(x.name)).filter(Boolean))];
 const resourceNames=[...new Set((resources.data||[]).map(x=>clean(x.description||x.name)).filter(Boolean))];
 const use=(usage.data||[]).slice(0,200).map(x=>({entity:clean(x.entity),count:Number.isFinite(x.count)?x.count:null,remaining:Number.isFinite(x.remaining_requests)?x.remaining_requests:null})).filter(x=>x.entity);
 const capabilities={};
 for(const [key,path,params,label] of probes){
  const r=await read(path,params);
  capabilities[key]={status:r.status,records:r.data?.length??null,hasMore:r.hasMore??null,listed:resourceNames.some(n=>n.toLowerCase()===label.toLowerCase())};
 }
 const inventoryComplete=features.status==='available'&&resources.status==='available'&&!features.hasMore&&!resources.hasMore;
 return {status:inventoryComplete&&Object.values(capabilities).every(c=>c.status!=='not_tested')?'complete':'partial',inventoryComplete,requests,stop,quotas,featureStatus:features.status,resourceStatus:resources.status,usageStatus:usage.status,featureNames,resourceNames,usage:use,capabilities};
}
let cache=null,pending=null;
async function cachedInspect(options){
 if(!options?.token)return {status:'not_configured',requests:0};
 if(cache&&Date.now()<cache.expires)return cache.report;
 if(pending)return pending;
 pending=inspect(options).then(report=>{cache={report,expires:Date.now()+30*60000};return report;}).finally(()=>{pending=null;});
 return pending;
}
module.exports={inspect,cachedInspect};
