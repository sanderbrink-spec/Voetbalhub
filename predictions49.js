'use strict';
const crypto=require('node:crypto');
const fail=(message,status=400)=>Object.assign(Error(message),{status});
function outcome(f,now=Date.now()){if(f?.status!=='FT'||!Number.isFinite(Date.parse(f.date))||Date.parse(f.date)>now||![f.goals?.home,f.goals?.away].every(v=>Number.isInteger(v)&&v>=0))return null;return f.goals.home>f.goals.away?'1':f.goals.home===f.goals.away?'X':'2';}
function rank(rows){const sorted=rows.sort((a,b)=>b.points-a.points||a.playerId.localeCompare(b.playerId));return sorted.map((r,i)=>({...r,position:i&&r.points===sorted[i-1].points?sorted.findIndex(p=>p.points===r.points)+1:i+1}));}
const SAVE=`local t=redis.call('TIME');local now=tonumber(t[1])*1000+math.floor(tonumber(t[2])/1000);if now>=tonumber(ARGV[3]) then return 0 end;local raw=redis.call('HGET',KEYS[1],ARGV[1]);local rows=raw and cjson.decode(raw) or {};local v=cjson.decode(ARGV[2]);v.savedAt=now;rows[v.fixtureId]=v;redis.call('HSET',KEYS[1],ARGV[1],cjson.encode(rows));return 1`;
function create({redis,football,prefix='q39:',now=Date.now,profile,safeProfile}){
 const bucket=(c,s)=>prefix+'pred49:'+c+':'+s;
 async function handle(req,url,p,body){
 const d=req.method==='POST'?await body(req,['competition','fixtureId','choice']):Object.fromEntries(url.searchParams);
 const competition=d.competition||'eredivisie';if(!Object.hasOwn(require('./football-data47').CATALOG,competition))throw fail('Onbekende competitie.');
 const snap=await (football.getSelected||football.get)(competition),current=Number(snap.rightsExpiresAt)>now(),season=String(d.season||snap.league?.season||'');if(!/^20\d\d$/.test(season))throw fail('Ongeldig seizoen.');
 const key=bucket(competition,season),fixtureMap=new Map(current&&String(snap.league?.season)===season?(snap.fixtures||[]).map(f=>[String(f.id),f]):[]);
 if(req.method==='POST'){
  if(url.pathname!=='/quiz/v1/predictions/save'||!['1','X','2'].includes(d.choice)||typeof d.fixtureId!=='string'||d.fixtureId.length>100)throw fail('Ongeldige keuze.');
  const f=fixtureMap.get(d.fixtureId);if(!f||f.status!=='NS'||Date.parse(f.date)<=now())throw fail('Deze voorspelling is gesloten.',409);
  const record={fixtureId:String(f.id),choice:d.choice,competition,season,round:String(f.round||'Speelronde'),kickoff:f.date,label:f.home.name+' – '+f.away.name};
  if(Number(await redis.eval(SAVE,{keys:[key],arguments:[p.id,JSON.stringify(record),String(Date.parse(f.date))]}))!==1)throw fail('De aftrap is verstreken.',409);
  await redis.sAdd(prefix+'predictionKeys:'+p.id,key);
 }else if(req.method!=='GET'||url.pathname!=='/quiz/v1/predictions')throw fail('Route niet gevonden.',404);
 // Keep verified finals if a later feed omits older fixtures. Recalculate corrections.
 const resultsKey=key+':results';for(const f of fixtureMap.values()){const value=outcome(f,now());if(value!==null)await redis.hSet(resultsKey,String(f.id),JSON.stringify({choice:value,goals:f.goals,source:snap.source,checkedAt:snap.updatedAt}));else if(['PST','CANC','TBD','NS','AWAITING','FT'].includes(f.status))await redis.hDel(resultsKey,String(f.id));}
 const finals=await redis.hGetAll(resultsKey),all=await redis.hGetAll(key);if(Object.keys(all).length>500)throw fail('Ranglijst tijdelijk niet beschikbaar.',503);
 const assess=raw=>Object.values(JSON.parse(raw||'{}')).map(r=>{const f=fixtureMap.get(r.fixtureId),final=finals[r.fixtureId]?JSON.parse(finals[r.fixtureId]):null,points=final?(final.choice===r.choice?1:0):null;return {...r,points,result:final?.choice||null,goals:final?.goals||null,status:final?'beoordeeld':f?.status==='CANC'?'afgelast':f?.status==='PST'?'uitgesteld':f?.status==='NS'&&Date.parse(f.date)>now()?'open':'gesloten'};});
 const mine=assess(all[p.id]),rounds=[...new Set([...fixtureMap.values()].map(f=>String(f.round||'Speelronde')).concat(mine.map(r=>r.round)))],round=d.round||rounds.find(r=>[...fixtureMap.values()].some(f=>f.round===r&&f.status==='NS'&&Date.parse(f.date)>now()))||rounds.at(-1)||'',scope=d.scope||'season';if(!['round','season'].includes(scope))throw fail('Ongeldige ranglijst.');
 const boards=[];for(const [playerId,raw] of Object.entries(all)){const who=await profile(playerId);if(!who||who.blocked)continue;const records=assess(raw).filter(r=>scope==='season'||r.round===round);if(!records.length)continue;boards.push({playerId,name:safeProfile(who).name,points:records.reduce((a,r)=>a+(r.points||0),0),assessed:records.filter(r=>r.points!==null).length});}
 const ranked=rank(boards),years=await redis.sMembers(prefix+'predictionKeys:'+p.id);return {competition,season,serverNow:now(),profile:safeProfile(p),fixtures:[...fixtureMap.values()],source:snap.source,message:current?snap.message||'': 'Wedstrijdgegevens verlopen.',rounds,round,scope,points:mine.reduce((a,r)=>a+(r.points||0),0),predictions:mine,board:{top:ranked.slice(0,50),mine:ranked.find(r=>r.playerId===p.id)||null,players:ranked.length},seasons:[...new Set([season,...years.filter(k=>k.startsWith(prefix+'pred49:'+competition+':')).map(k=>k.split(':').at(-1))])].sort().reverse(),rules:'1 punt voor een juiste 1-X-2-uitkomst. Alleen gecontroleerde definitieve uitslagen tellen.'};
 }
 async function remove(id){const keys=await redis.sMembers(prefix+'predictionKeys:'+id);for(const key of keys)if(key.startsWith(prefix+'pred49:'))await redis.hDel(key,id);await redis.del(prefix+'predictionKeys:'+id);}
 return {handle,remove};
}
module.exports={create,outcome,rank,SAVE};
