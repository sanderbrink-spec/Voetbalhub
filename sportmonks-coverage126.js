'use strict';
// Internal subscription audit: never return raw provider payloads, credentials,
// or claim that an empty data window means a league is not subscribed.
const {EDITORIAL_LEAGUES}=require('./sportmonks-football');
const fields=['scores','events','statistics','lineups','formations','coaches','referees','venue','sidelined'];
const include=['participants','scores','events','statistics','lineups','formations','coaches','referees','venue','sidelined'].join(';');
const day=t=>new Date(t).toISOString().slice(0,10);
async function audit({token,fetcher=fetch,sourceBody=async r=>r.text(),now=Date.now(),maxCalls=20}={}){
 if(!token||!Number.isFinite(now))return {status:'not_configured',requests:0};
 const limit=Math.min(30,Math.max(2,Number.isInteger(maxCalls)?maxCalls:20));
 let requests=0,stop=null;
 const deadline=Date.now()+40000;
 const errors=[], quotas={};
 async function request(path,params={}){
  if(Date.now()>=deadline)stop=stop||'time_budget';
  if(stop||requests>=limit){stop=stop||'request_budget';return null;}
  const url=new URL('https://api.sportmonks.com/v3/'+path);
  for(const [key,value] of Object.entries(params))url.searchParams.set(key,String(value));
  url.searchParams.set('api_token',token);
  requests++;
  try{
   const response=await fetcher(url.href,{redirect:'error',signal:AbortSignal.timeout(8000)});
   if(!response.ok){try{await response.body?.cancel();}catch{}
    if([401,429].includes(response.status))stop='http_'+response.status;
    return {error:'http_'+response.status};
   }
   const payload=JSON.parse(await sourceBody(response));
   const r=payload.rate_limit;
   if(r&&typeof r.requested_entity==='string'&&Number.isFinite(r.remaining)){
    quotas[r.requested_entity]={remaining:r.remaining,resetSeconds:Number.isFinite(r.resets_in_seconds)?r.resets_in_seconds:null};
    if(r.remaining<=25)stop='quota_reserve';
   }
   if(!Array.isArray(payload.data))return {error:'invalid_data'};
   return payload;
  }catch{return {error:'unavailable'};}
 }
 const cat=await request('my/leagues');
 if(!cat||cat.error)return {status:'catalogue_unavailable',reason:cat?.error||stop,requests,quotas};
 const catalogue=new Map();
 for(const row of cat.data){
  if(!Number.isSafeInteger(row?.id)||row.id<=0||typeof row.name!=='string'||!row.name.trim())continue;
  if(row.sport_id!=null&&row.sport_id!==1)continue;
  catalogue.set(row.id,{id:row.id,name:row.name.trim().slice(0,120),configured:Object.values(EDITORIAL_LEAGUES).includes(row.id),fixtures:0,finals:0,coverage:Object.fromEntries(fields.map(f=>[f,0])),windowComplete:false});
 }
 const ids=[...catalogue.keys()];
 const seen=new Set();
 const from=day(now-3*86400000),to=day(now+2*86400000);
 for(let offset=0;offset<ids.length&&!stop;offset+=10){
  const group=ids.slice(offset,offset+10);
  let complete=false;
  for(let page=1;page<=10&&!stop;page++){
   const path='football/fixtures/between/'+from+'/'+to;
   const params={filters:'fixtureLeagues:'+group.join(','),include,per_page:50,page};
   let result=await request(path,params);
   if(!stop&&['http_400','http_403','http_422'].includes(result?.error)){
    errors.push({leagueIds:group,reason:'extended_includes_'+result.error});
    result=await request(path,{...params,include:'participants;scores;events;statistics;venue'});
    if(!stop&&['http_400','http_403','http_422'].includes(result?.error)){
     errors.push({leagueIds:group,reason:'standard_includes_'+result.error});
     result=await request(path,{...params,include:'participants;scores'});
    }
   }
   if(!result||result.error){errors.push({leagueIds:group,reason:result?.error||stop});break;}
   if(result.data.length>50||result.data.some(row=>!Number.isSafeInteger(row?.id)||!group.includes(row.league_id)||seen.has(row.id))||new Set(result.data.map(row=>row.id)).size!==result.data.length){
    errors.push({leagueIds:group,reason:'invalid_fixture_page'});break;
   }
   for(const row of result.data){
    seen.add(row.id);
    const league=catalogue.get(row.league_id);
    league.fixtures++;
    if([5,7,8].includes(Number(row.state_id)))league.finals++;
    for(const f of fields){
     const value=row[f];
     if(Array.isArray(value)?value.length>0:value&&typeof value==='object'&&Object.keys(value).length>0)league.coverage[f]++;
    }
   }
   if(result.pagination?.has_more===false){complete=true;break;}
   if(result.pagination?.has_more!==true){errors.push({leagueIds:group,reason:'unknown_pagination'});break;}
   if(page===10)errors.push({leagueIds:group,reason:'pagination_limit'});
  }
  if(complete)for(const id of group)catalogue.get(id).windowComplete=true;
 }
 const leagues=[...catalogue.values()];
 return {status:!stop&&!errors.length&&leagues.every(l=>l.windowComplete)?'complete':'partial',from,to,requests,stop,quotas,errors,subscribed:leagues.length,configured:leagues.filter(l=>l.configured).length,fixtures:seen.size,leagues};
}
let cached=null,pending=null;
async function cachedAudit(options){
 if(!options?.token)return {status:'not_configured',requests:0};
 if(cached&&Date.now()<cached.expires)return cached.report;
 if(pending)return pending;
 pending=audit(options).then(report=>{cached={report,expires:Date.now()+15*60000};return report;}).finally(()=>{pending=null;});
 return pending;
}
module.exports={audit,cachedAudit};
