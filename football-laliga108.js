'use strict';
// Strict, independent La Liga fallback. No club badges or copied articles.
// Uses the existing Football-Data.org credential; no new paid service.
const SOURCE={
 name:'Football-Data.org',url:'https://www.football-data.org/',
 license:'API data, attribution required; commercial reuse subject to provider terms',
 commercial:null,cost:0,refreshMinutes:15,databaseDownload:null,
 credit:'Data provided by football-data.org'
};
const idOk=id=>Number.isSafeInteger(id)&&id>0;
const scoreOk=x=>Number.isInteger(x)&&x>=0&&x<=30;
function parseSeason(payload,season,now){
 if(payload?.competition?.code!=='PD'||
   !String(payload?.season?.startDate||'').startsWith(String(season)+'-')||
   !Array.isArray(payload.matches)||payload.matches.length!==380)
  throw Error('La Liga: onvolledige of verkeerde seizoensdataset');
 const seenIds=new Set(),teams=new Map(),homeCounts=new Map(),awayCounts=new Map();
 const fixtures=[];
 for(const row of payload.matches){
  const mid=row?.id,home=row?.homeTeam,away=row?.awayTeam;
  const kickoff=Date.parse(row?.utcDate||'');
  if(!idOk(mid)||seenIds.has(mid)||row?.competition?.code&&row.competition.code!=='PD'||
   !idOk(home?.id)||!idOk(away?.id)||home.id===away.id||
   ![home?.name,away?.name].every(n=>typeof n==='string'&&n.trim().length>=2&&n.length<=100)||
   !Number.isFinite(kickoff)||
   !Number.isInteger(row.matchday)||row.matchday<1||row.matchday>38)
    throw Error('La Liga: ongeldige wedstrijdregistratie');
  seenIds.add(mid);
  for(const team of [home,away]){
   if(teams.has(team.id)&&teams.get(team.id)!==team.name)
    throw Error('La Liga: inconsistente teamidentiteit');
   teams.set(team.id,team.name);
  }
  homeCounts.set(home.id,(homeCounts.get(home.id)||0)+1);
  awayCounts.set(away.id,(awayCounts.get(away.id)||0)+1);
  let status;
  if(row.status==='FINISHED'){
   if(row.score?.duration!=='REGULAR'||kickoff>now||
     !scoreOk(row.score?.fullTime?.home)||!scoreOk(row.score?.fullTime?.away))
    throw Error('La Liga: niet-gecontroleerde eindstand');
   status='FT';
  }else if(['CANCELLED','SUSPENDED'].includes(row.status)){status='CANC';}
  else if(row.status==='POSTPONED'){status='PST';}
  else if(['SCHEDULED','TIMED'].includes(row.status)&&kickoff>now){status='NS';}
  else if(['SCHEDULED','TIMED','IN_PLAY','PAUSED','AWARDED'].includes(row.status)){status='AWAITING';}
  else throw Error('La Liga: onbekende wedstrijdstatus');
  const goals=status==='FT'?
   {home:row.score.fullTime.home,away:row.score.fullTime.away}:{home:null,away:null};
  const ht=row.score?.halfTime;
  const halfTime=status==='FT'&&scoreOk(ht?.home)&&scoreOk(ht?.away)&&
   ht.home<=goals.home&&ht.away<=goals.away?{home:ht.home,away:ht.away}:null;
  fixtures.push({id:'fd-pd-'+mid,competition:'laliga',date:new Date(kickoff).toISOString(),
   round:'Speelronde '+row.matchday,status,home:{id:'fd-'+home.id,name:home.name},
   away:{id:'fd-'+away.id,name:away.name},goals,
   ...(halfTime?{halfTime}:{}),checkedAt:new Date(now).toISOString(),
   ...(status==='FT'?{resultSource:'Football-Data.org',
     resultExpiresAt:now+36*3600000}:{})});
 }
 if(teams.size!==20||[...teams.keys()].some(id=>homeCounts.get(id)!==19||awayCounts.get(id)!==19))
  throw Error('La Liga: niet alle 20 clubs en thuis-/uitduels bevestigd');
 return fixtures.sort((a,b)=>a.date.localeCompare(b.date));
}
async function load({token,fetcher=fetch,now=Date.now(),sourceBody}={}){
 if(!token||typeof sourceBody!=='function')throw Error('La Liga: gratis token niet geconfigureerd');
 const year=new Date(now).getUTCMonth()<6?new Date(now).getUTCFullYear()-1:new Date(now).getUTCFullYear();
 const url='https://api.football-data.org/v4/competitions/PD/matches?season='+year;
 const r=await fetcher(url,{redirect:'error',headers:{'X-Auth-Token':token},
  signal:AbortSignal.timeout(9000)});
 if(!r.ok){await r.body?.cancel();throw Error('La Liga reservebron HTTP '+r.status);}
 let payload;
 try{payload=JSON.parse(await sourceBody(r));}
 catch{throw Error('La Liga reservebron antwoord ongeldig');}
 return {fixtures:parseSeason(payload,year,now),source:SOURCE};
}
module.exports={SOURCE,parseSeason,load};
