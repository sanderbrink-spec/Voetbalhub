'use strict';
const crypto=require('node:crypto');
const CATALOG={eredivisie:{id:88,name:'Eredivisie',file:'nl.1',zone:'Europe/Amsterdam'},bundesliga:{id:78,name:'Bundesliga',file:'de.1',zone:'Europe/Berlin'},premierleague:{id:39,name:'Premier League',file:'en.1',zone:'Europe/London'},laliga:{id:140,name:'La Liga',file:'es.1',zone:'Europe/Madrid'},seriea:{id:135,name:'Serie A',file:'it.1',zone:'Europe/Rome'},ligue1:{id:61,name:'Ligue 1',file:'fr.1',zone:'Europe/Paris'},kkd:{id:89,name:'Keuken Kampioen Divisie'},championsleague:{id:2,name:'Champions League'},europaleague:{id:3,name:'Europa League'},conferenceleague:{id:848,name:'Conference League'}};
const PROVIDERS={bundesliga:{shortcut:'bl1',min:250},laliga:{shortcut:'la1',min:300},premierleague:{shortcut:'pl',min:300},championsleague:{shortcut:'ucl',min:100},europaleague:{shortcut:'uel2026',min:100},conferenceleague:{shortcut:'uecl2026',min:100}};
const SOURCE={name:'OpenLigaDB',url:'https://www.openligadb.de/',license:'ODbL-1.0',licenseUrl:'https://www.openligadb.de/lizenz',commercial:true,cost:0,refreshMinutes:15,limits:'Geen SLA; gedeelde communitybron. Maximaal één centraal verzoek per 15 minuten.',databaseDownload:'/integrations/football?competition=bundesliga'};
const slug=s=>String(s).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-');
function table(fixtures){const teams=new Map();for(const f of fixtures)for(const t of [f.home,f.away])if(!teams.has(t.id))teams.set(t.id,{team:t,points:0,goalsDiff:0,all:{played:0,win:0,draw:0,lose:0,goals:{for:0,against:0}},home:{played:0,win:0,draw:0,lose:0,goals:{for:0,against:0}},away:{played:0,win:0,draw:0,lose:0,goals:{for:0,against:0}},form:''});
 for(const f of [...fixtures].sort((a,b)=>Date.parse(a.date)-Date.parse(b.date))){if(f.status!=='FT')continue;for(const side of ['home','away']){const r=teams.get(f[side].id),a=f.goals[side],b=f.goals[side==='home'?'away':'home'],result=a>b?'win':a===b?'draw':'lose';for(const key of ['all',side]){const x=r[key];x.played++;x[result]++;x.goals.for+=a;x.goals.against+=b;}r.points+=a>b?3:a===b?1:0;r.goalsDiff=r.all.goals.for-r.all.goals.against;r.form=(r.form+({win:'W',draw:'G',lose:'V'}[result])).slice(-5);}}
 // Equal sporting totals share a rank. No invented official tie-break order.
 const rows=[...teams.values()].sort((a,b)=>b.points-a.points||b.goalsDiff-a.goalsDiff||b.all.goals.for-a.all.goals.for||a.team.name.localeCompare(b.team.name));rows.forEach((r,i)=>{const prev=rows[i-1];r.rank=prev&&r.points===prev.points&&r.goalsDiff===prev.goalsDiff&&r.all.goals.for===prev.all.goals.for?prev.rank:i+1;});return rows;
}
function envelope(key,fixtures,now,source=SOURCE){const c=CATALOG[key];return {schemaVersion:1,rightsPolicyVersion:26,rightsExpiresAt:now+36*3600000,updatedAt:new Date(now).toISOString(),source:source.name,sourceDetails:source,league:{id:c.id,name:c.name,season:new Date(now).getUTCMonth()<6?new Date(now).getUTCFullYear()-1:new Date(now).getUTCFullYear()},fixtures,standings:table(fixtures),players:{},status:fixtures.length?'available':'unavailable',standingsNote:'Berekend uit beschikbare eindstanden; geen officiële ranglijst of puntenaftrek. Gelijke totalen delen een positie.'};}
function fromOpenLiga(rows,now=Date.now(),key='bundesliga'){
 if(!Array.isArray(rows)||rows.length<(PROVIDERS[key]?.min||100)||rows.length>500)throw Error('Onvolledig Bundesliga-schema');const ids=new Set();const fixtures=rows.map(r=>{if(!r.matchID||ids.has(r.matchID)||(r.leagueShortcut!==PROVIDERS[key]?.shortcut||r.leagueSeason!==(new Date(now).getUTCMonth()<6?new Date(now).getUTCFullYear()-1:new Date(now).getUTCFullYear()))||!r.team1?.teamName||!r.team2?.teamName||!Number.isFinite(Date.parse(r.matchDateTimeUTC)))throw Error('Ongeldig wedstrijdrecord');ids.add(r.matchID);const score=r.matchResults?.find(x=>x.resultTypeID===2),finished=r.matchIsFinished===true, date=new Date(r.matchDateTimeUTC).toISOString();if(finished&&(!score||![score.pointsTeam1,score.pointsTeam2].every(x=>Number.isInteger(x)&&x>=0)||Date.parse(date)>now))throw Error('Ongeldige eindstand');return {id:'oldb-'+r.matchID,competition:key,date,round:r.group?.groupName||'Speelronde',status:finished?'FT':Date.parse(date)>now?'NS':'AWAITING',home:{id:'oldb-'+r.team1.teamId,name:r.team1.teamName},away:{id:'oldb-'+r.team2.teamId,name:r.team2.teamName},goals:{home:finished?score.pointsTeam1:null,away:finished?score.pointsTeam2:null},checkedAt:new Date(now).toISOString()};});const value=envelope(key,fixtures,now,{...SOURCE,databaseDownload:'/integrations/football?competition='+key});value.sourceLastChanged=rows.reduce((last,r)=>r.lastUpdateDateTime>last?r.lastUpdateDateTime:last,'');const missing=fixtures.filter(f=>f.status==='AWAITING'&&now-Date.parse(f.date)>24*3600000).length;if(missing){value.standings=[];value.standingsNote='Geen competitiestand: '+missing+' verstreken duels hebben nog geen gecontroleerde eindstand.';}return value;
}
function manual(body,now=Date.now()){if(!Object.hasOwn(CATALOG,body.competition)||!Array.isArray(body.fixtures)||body.fixtures.length>500)throw Error('Ongeldige competitie of wedstrijden');const checks=body.checks||{};for(const k of ['independentlyVerified','commercialReuseAllowed','originalEntry','noProtectedDatabaseExtraction'])if(checks[k]!==true)throw Error('Alle vier redactionele controles zijn verplicht');if(typeof body.reviewer!=='string'||body.reviewer.trim().length<2||!/^https:\/\//.test(body.sourceUrl||'')||typeof body.rightsEvidence!=='string'||body.rightsEvidence.trim().length<20)throw Error('Controleur, bron en concreet rechtenbewijs zijn verplicht');const seen=new Set();const fixtures=body.fixtures.map(f=>{if(!/^[a-zA-Z0-9_-]{1,80}$/.test(String(f.id||''))||seen.has(String(f.id))||!f.home?.name||!f.away?.name||f.home.name===f.away.name||!Number.isFinite(Date.parse(f.date))||!['NS','TBD','FT','PST','CANC'].includes(f.status))throw Error('Ongeldige wedstrijd');seen.add(String(f.id));if(f.status==='FT'&&(![f.goals?.home,f.goals?.away].every(x=>Number.isInteger(x)&&x>=0)||Date.parse(f.date)>now))throw Error('Ongeldige eindstand');return {id:'manual-'+body.competition+'-'+f.id,competition:body.competition,date:new Date(f.date).toISOString(),round:String(f.round||'Redactioneel gecontroleerd').slice(0,80),status:f.status,home:{id:slug(f.home.name),name:String(f.home.name).slice(0,80)},away:{id:slug(f.away.name),name:String(f.away.name).slice(0,80)},goals:f.status==='FT'?f.goals:{home:null,away:null},checkedAt:new Date(now).toISOString()};});const s=envelope(body.competition,fixtures,now,{name:'Veldio · handmatig gecontroleerd',url:body.sourceUrl,license:'Redactioneel vastgelegde toestemming',commercial:true,cost:0,refreshMinutes:null});s.standings=[];s.standingsNote='Losse gecontroleerde duels leveren geen volledige competitiestand op.';s.review={reviewer:body.reviewer.trim(),rightsEvidence:body.rightsEvidence,checks};return s;}
// Expiration is checked per manual record: adding a new fixture cannot renew older checks.
function currentManual(value, now) {
 if (!value || value.sourceDetails?.name !== 'Veldio · handmatig gecontroleerd') return value;
 const fixtures=(value.fixtures||[]).filter(f=>Number.isFinite(Date.parse(f.checkedAt))&&Date.parse(f.checkedAt)<=now&&now-Date.parse(f.checkedAt)<36*3600000);
 return {...value,fixtures,standings:[],status:fixtures.length?'available':'unavailable'};
}
async function sourceBody(response, limit=2000000) {
 if(Number(response.headers?.get('content-length'))>limit){await response.body?.cancel();throw Error('Bronantwoord te groot');}
 if(!response.body){const text=await response.text();if(Buffer.byteLength(text)>limit)throw Error('Bronantwoord te groot');return text;}
 const chunks=[];let size=0;
 for await(const chunk of response.body){size+=chunk.byteLength;if(size>limit)throw Error('Bronantwoord te groot');chunks.push(Buffer.from(chunk));}
 return Buffer.concat(chunks,size).toString('utf8');
}
function create({fetcher=fetch,redis,clock=Date.now,resultsToken=process.env.FOOTBALL_DATA_API_KEY?.trim()||process.env.FOOTBALL_DATA_TOKEN?.trim()}={}){
 const cache=new Map(),pending=new Map();
 async function get(key){
  if(!Object.hasOwn(CATALOG,key))throw Error('Onbekende competitie');
  const now=clock(),hit=cache.get(key);
  if(hit&&hit.value.rightsExpiresAt>now&&now-hit.at<hit.ttl)return currentManual(hit.value,now);
  if(pending.has(key))return pending.get(key);
  const task=(async()=>{
   let storageFailed=false;
   try{
    if(redis?.isReady){
     try{
      const raw=await require('./runtime-health').withDeadline(()=>redis.get('football47:'+key),1500);
      if(raw){const value=JSON.parse(raw);if(value.rightsExpiresAt>now){cache.set(key,{at:now,value,ttl:15*60000});return currentManual(value,now);}}
     }catch{storageFailed=true;}
    }
    if(key==='eredivisie'){
     const season=new Date(now).getUTCMonth()<6?new Date(now).getUTCFullYear()-1:new Date(now).getUTCFullYear();
     const r=await fetcher('https://raw.githubusercontent.com/openfootball/football.json/master/'+season+'-'+String(season+1).slice(-2)+'/nl.1.json',{headers:{'User-Agent':'Veldio/50 (redactie.veldio@gmail.com)'},signal:AbortSignal.timeout(12000)});
     if(!r.ok)throw Error('Eredivisiebron HTTP '+r.status);
     const parsed=require('./football-source50').parse(JSON.parse(await sourceBody(r)),now);
     const supplemental=require('./football-results52');
     let fixtures=parsed.fixtures;
     if(resultsToken&&fixtures.some(f=>['AWAITING','TBD'].includes(f.status)&&Date.parse(f.date)<now)){
      try{
       const response=await fetcher('https://api.football-data.org/v4/competitions/DED/matches?season='+season+'&status=FINISHED',{
        redirect:'error',headers:{'X-Auth-Token':resultsToken},signal:AbortSignal.timeout(4000)
       });
       if(!response.ok){await response.body?.cancel();throw Error('HTTP '+response.status);}
       fixtures=supplemental.supplement(fixtures,JSON.parse(await sourceBody(response)),season,now);
       console.info('football47 Eredivisie aanvullende uitslagen:',fixtures.filter(f=>f.resultSource).length);
      }catch(error){console.warn('football47 Eredivisie aanvullende uitslagen:',error.message);}
     }
     const supplemented=fixtures.some(f=>f.resultSource);
     const source=supplemented?{...parsed.source,name:parsed.source.name+' · '+supplemental.CREDIT,
      license:'CC0-1.0 (speelschema) · Football-Data.org (aanvullende uitslagen)',databaseDownload:null}:parsed.source;
     const value=envelope(key,fixtures,now,source);
     if(value.fixtures.some(f=>f.status==='AWAITING')){value.standings=[];value.standingsNote='Uitslagen ontbreken. Stand volgt na bevestiging.';}
     cache.set(key,{at:now,value,ttl:15*60000});return value;
    }
    // A Redis failure must not disable the independent public data provider.
    if(!Object.hasOwn(PROVIDERS,key)){
     if(storageFailed)throw Error('Redactionele opslag niet bereikbaar');
     const value={...envelope(key,[],now),source:'Veldio',sourceDetails:null,status:'unavailable',message:'Geen actuele, vrijgegeven gegevensbron. Redactionele invoer beschikbaar.'};
     cache.set(key,{at:now,value,ttl:15*60000});return value;
    }
    const r=await fetcher('https://api.openligadb.de/getmatchdata/'+PROVIDERS[key].shortcut+'/'+(new Date(now).getUTCMonth()<6?new Date(now).getUTCFullYear()-1:new Date(now).getUTCFullYear()),{headers:{'User-Agent':'Veldio/48 (redactie.veldio@gmail.com)'},signal:AbortSignal.timeout(12000)});
    if(!r.ok)throw Error('Bron HTTP '+r.status);
    const value=fromOpenLiga(JSON.parse(await sourceBody(r)),now,key);
    cache.set(key,{at:now,value,ttl:15*60000});return value;
   }catch(e){
    console.error('football47',key,e.message);
    const value=hit&&hit.value.rightsExpiresAt>now&&hit.value.fixtures?.length?{...currentManual(hit.value,now),status:'cached',message:'Bron tijdelijk niet bereikbaar. Laatste gecontroleerde gegevens.'}:{...envelope(key,[],now),status:'source_unavailable',message:'Wedstrijdbron tijdelijk niet bereikbaar.'};
    // Bound repeated failures as well as successful refreshes; preserve the actual update date.
    cache.set(key,{at:now,value,ttl:60000});return value;
   }
  })();
  pending.set(key,task);
  try{return await task;}finally{pending.delete(key);}
 }

 async function publish(body){if(!redis?.isReady)throw Error('Permanente opslag niet beschikbaar');const value=manual(body,clock());const prior=await redis.get('football47:'+body.competition);if(prior){const old=JSON.parse(prior);if(old.rightsExpiresAt>clock()){const merged=new Map((old.fixtures||[]).map(f=>[String(f.id),f]));for(const f of value.fixtures)merged.set(String(f.id),f);if(merged.size>500)throw Error('Maximaal 500 handmatige wedstrijden per competitie');value.fixtures=[...merged.values()].filter(f=>clock()-Date.parse(f.checkedAt)<=36*3600000);}}const saved=await redis.eval("local old=redis.call('GET',KEYS[1]) or ''; if old~=ARGV[1] then return 0 end; redis.call('SET',KEYS[1],ARGV[2]); return 1",{keys:['football47:'+body.competition],arguments:[prior||'',JSON.stringify(value)]});if(Number(saved)!==1)throw Error('Invoer is ondertussen gewijzigd; controleer en probeer opnieuw');cache.delete(body.competition);return value;}
 async function getSelected(key){if(!require('./match-selection50').EUROPE.includes(key))return get(key);const snapshots=await Promise.all(require('./match-selection50').EUROPE.map(get)),selected=require('./match-selection50').select(snapshots.flatMap(s=>s.fixtures||[]),require('./match-selection50.json'));const snap=snapshots[require('./match-selection50').EUROPE.indexOf(key)];return {...snap,fixtures:selected.filter(f=>f.competition===key),selection:'Veldio topwedstrijden',selectionLimit:require('./match-selection50.json').maxPerWeek};}
 async function overview(){const snapshots=await Promise.all(['eredivisie',...require('./match-selection50').EUROPE].map(get));const europe=require('./match-selection50').select(snapshots.slice(1).filter(s=>s.rightsExpiresAt>clock()).flatMap(s=>s.fixtures||[]),require('./match-selection50.json'));return {...snapshots[0],europeanFixtures:europe};}
 return {get,getSelected,overview,publish,catalog:()=>Object.entries(CATALOG).map(([key,v])=>({key,...v}))};}
module.exports={CATALOG,SOURCE,table,envelope,fromOpenLiga,manual,currentManual,sourceBody,create};
