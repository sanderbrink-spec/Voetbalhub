'use strict';
const sportmonks = require('./sportmonks-football');
const crypto=require('node:crypto');
const {EUROPE,select}=require('./match-selection50');
const CATALOG={eredivisie:{id:88,name:'Eredivisie',file:'nl.1',zone:'Europe/Amsterdam'},bundesliga:{id:78,name:'Bundesliga',file:'de.1',zone:'Europe/Berlin'},premierleague:{id:39,name:'Premier League',file:'en.1',zone:'Europe/London'},laliga:{id:140,name:'La Liga',file:'es.1',zone:'Europe/Madrid'},seriea:{id:135,name:'Serie A',file:'it.1',zone:'Europe/Rome'},ligue1:{id:61,name:'Ligue 1',file:'fr.1',zone:'Europe/Paris'},kkd:{id:89,name:'Keuken Kampioen Divisie'},knvbbeker:{id:78,name:'KNVB Beker'},eredivisieplayoffs:{id:0,name:'Eredivisie Play-offs'},championsleague:{id:2,name:'Champions League'},europaleague:{id:3,name:'Europa League'},conferenceleague:{id:848,name:'Conference League'}};
const PROVIDERS={bundesliga:{shortcut:'bl1',min:250},laliga:{shortcut:'la1',min:300},premierleague:{shortcut:'pl',min:300},championsleague:{shortcut:'ucl',min:100},europaleague:{shortcut:'uel2026',min:100},conferenceleague:{shortcut:'uecl2026',min:100}};
const SOURCE={name:'OpenLigaDB',url:'https://www.openligadb.de/',license:'ODbL-1.0',licenseUrl:'https://www.openligadb.de/lizenz',commercial:true,cost:0,refreshMinutes:15,limits:'Geen SLA; gedeelde communitybron. Maximaal één centraal verzoek per 15 minuten.',databaseDownload:'/integrations/football?competition=bundesliga'};
const slug=s=>String(s).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-');
// Match complete source labels. Club identity remains the provider's ID.
const CLUB_DISPLAY_NAMES=new Map([
 ['feyenoord rotterdam','Feyenoord',true],
 ['inter mailand','Inter',true],['internazionale milano','Inter',true],['inter milan','Inter'],
 ['ac mailand','AC Milaan'],['ac milan','AC Milaan'],
 ['olympiakos piräus','Olympiakos Pireus'],['olympiakos piraus','Olympiakos Pireus'],
 ['olympiakos piraeus','Olympiakos Pireus'],['olympiacos piraeus','Olympiakos Pireus'],
 ['atletico madrid','Atlético Madrid',true],['atletico de madrid','Atlético Madrid',true],
 ['fc bayern münchen','Bayern München',true,true],['fc bayern munchen','Bayern München',true],['bayern munich','Bayern München'],
 ['fc brugge','Club Brugge',true],['fc brügge','Club Brugge'],['club brugge kv','Club Brugge',true],
 ['psv eindhoven','PSV',true],['fc porto','FC Porto',true],
 ['ajax amsterdam','Ajax'],['afc ajax','Ajax'],['fc twente enschede','FC Twente'],
 ['aek athen','AEK Athene'],['aek athens','AEK Athene'],
 ['as rom','AS Roma'],
 ['fc arsenal','Arsenal'],['fc liverpool','Liverpool'],['manchester united fc','Manchester United'],
 ['crystal palace fc','Crystal Palace'],['brighton & hove albion f.c.','Brighton & Hove Albion'],
 ['brentford f.c.','Brentford'],['chelsea fc','Chelsea'],['everton fc','Everton'],
 ['fulham fc','Fulham'],['newcastle united fc','Newcastle United'],['tottenham hotspur fc','Tottenham Hotspur'],
 ['paris st. germain','Paris Saint-Germain'],['paris saint germain','Paris Saint-Germain'],
 ['fk bodö/glimt','Bodø/Glimt'],['bodo/glimt','Bodø/Glimt'],
 ['slavia prag','Slavia Praag'],['slavia prague','Slavia Praag'],
 ['sparta prag','Sparta Praag'],['sparta prague','Sparta Praag'],
 ['viktoria pilsen','Viktoria Plzeň'],['viktoria plzen','Viktoria Plzeň'],
 ['benfica lissabon','Benfica'],['besiktas istanbul','Beşiktaş'],['besiktas','Beşiktaş'],
 ['celtic glasgow','Celtic'],['juventus turin','Juventus'],
 ['hapoel beer scheva','Hapoel Beer Sheva'],
 ['jagiellonia bialystok','Jagiellonia Białystok'],['lech poznan','Lech Poznań'],
 ['omonia nikosia','Omonia Nicosia'],
 ['fc getafe','Getafe CF'],['fc malaga','Málaga CF'],['deportivo alaves','Deportivo Alavés'],
 ['fc sevilla','Sevilla FC'],['fc valencia','Valencia CF'],['fc villareal','Villarreal CF'],
 ['fc iberia 1999 tiflis','Iberia Tbilisi'],['fc nordsjaelland','FC Nordsjælland'],
 ['paphos fc','Pafos FC'],['roter stern belgrad','Rode Ster Belgrado'],['zska sofia','CSKA Sofia']
].map(([variant,name,legacy=false,uefaOnly=false])=>[variant,{name,legacy,uefaOnly}]));
function displayClubName(name,key,{legacy=false}={}){
 if(typeof name!=='string'||!Object.hasOwn(CATALOG,key))return name;
 const label=name.trim();
 const lookup=(legacy?label:label.normalize('NFC')).toLowerCase();
 const display=CLUB_DISPLAY_NAMES.get(lookup);
 const european=EUROPE.includes(key);
 if(legacy)return european&&display?.legacy?display.name:name;
 if(display?.uefaOnly&&!european)return label;
 return display?.name??label;
}

function displayTeam(team,key,options){
 const name=displayClubName(team?.name,key,options);
 if(name===team?.name)return team;
 return options?.legacy?{...team,name}:{...team,name,kitName:displayClubName(team.name,key,{legacy:true})};
}
function displayFixture(fixture,key,options){
 const home=displayTeam(fixture.home,key,options),away=displayTeam(fixture.away,key,options);
 return home===fixture.home&&away===fixture.away?fixture:{...fixture,home,away};
}
function displaySnapshot(snapshot,key,options){
 const result={...snapshot};
 if(Array.isArray(snapshot.fixtures))result.fixtures=snapshot.fixtures.map(fixture=>displayFixture(fixture,key,options));
 if(Array.isArray(snapshot.standings))result.standings=snapshot.standings.map(row=>{
  const team=displayTeam(row.team,key,options);
  return team===row.team?row:{...row,team};
 });
 return result;
}

function table(fixtures){const teams=new Map();for(const f of fixtures)for(const t of [f.home,f.away])if(!teams.has(t.id))teams.set(t.id,{team:t,points:0,goalsDiff:0,all:{played:0,win:0,draw:0,lose:0,goals:{for:0,against:0}},home:{played:0,win:0,draw:0,lose:0,goals:{for:0,against:0}},away:{played:0,win:0,draw:0,lose:0,goals:{for:0,against:0}},form:''});
 for(const f of [...fixtures].sort((a,b)=>Date.parse(a.date)-Date.parse(b.date))){if(f.status!=='FT')continue;for(const side of ['home','away']){const r=teams.get(f[side].id),a=f.goals[side],b=f.goals[side==='home'?'away':'home'],result=a>b?'win':a===b?'draw':'lose';for(const key of ['all',side]){const x=r[key];x.played++;x[result]++;x.goals.for+=a;x.goals.against+=b;}r.points+=a>b?3:a===b?1:0;r.goalsDiff=r.all.goals.for-r.all.goals.against;r.form=(r.form+({win:'W',draw:'G',lose:'V'}[result])).slice(-5);}}
 // Equal sporting totals share a rank. No invented official tie-break order.
 const rows=[...teams.values()].sort((a,b)=>b.points-a.points||b.goalsDiff-a.goalsDiff||b.all.goals.for-a.all.goals.for||a.team.name.localeCompare(b.team.name));rows.forEach((r,i)=>{const prev=rows[i-1];r.rank=prev&&r.points===prev.points&&r.goalsDiff===prev.goalsDiff&&r.all.goals.for===prev.all.goals.for?prev.rank:i+1;});return rows;
}
function envelope(key,fixtures,now,source=SOURCE){const c=CATALOG[key];return {schemaVersion:1,rightsPolicyVersion:26,rightsExpiresAt:now+36*3600000,updatedAt:new Date(now).toISOString(),source:source.name,sourceDetails:source,league:{id:c.id,name:c.name,season:new Date(now).getUTCMonth()<6?new Date(now).getUTCFullYear()-1:new Date(now).getUTCFullYear()},fixtures,standings:table(fixtures),players:{},status:fixtures.length?'available':'unavailable',standingsNote:'Berekend uit beschikbare eindstanden; geen officiële ranglijst of puntenaftrek. Gelijke totalen delen een positie.'};}
// Two exact 2026/27 fixtures independently checked against UEFA's published
// match list. Only repair OpenLigaDB's wrong Excelsior identity when opponent,
// competition, season, fixture date and (for a final) score all agree.
function verifiedUefaClubIdentity({key,season,date,home,away,finished,score}){
 const original={home,away},excelsior=n=>/^(?:sbv\s+)?excelsior(?:\s+rotterdam)?$/i.test(String(n||'').trim());
 if(key!=='championsleague'||season!==2026)return original;
 if(date.slice(0,10)==='2026-11-03'&&excelsior(home.name)&&/^aston villa(?: fc)?$/i.test(away.name)){
  if(finished&&(!score||score.pointsTeam1!==3||score.pointsTeam2!==0))
   throw Error('UEFA-uitslag Barcelona - Aston Villa wijkt af; wedstrijd geblokkeerd');
  return {home:{id:'uefa-fc-barcelona-2026',name:'FC Barcelona'},away};
 }
 if(date.slice(0,10)==='2026-11-25'&&/^sabah(?: fc)?$/i.test(home.name)&&excelsior(away.name))
  return {home,away:{id:'uefa-fc-barcelona-2026',name:'FC Barcelona'}};
 return original;
}
function fromOpenLiga(rows,now=Date.now(),key='bundesliga',{displayNames=true}={}){
 if(!Array.isArray(rows)||rows.length<(PROVIDERS[key]?.min||100)||rows.length>500)throw Error('Onvolledig Bundesliga-schema');const ids=new Set();const fixtures=rows.map(r=>{if(!r.matchID||ids.has(r.matchID)||(r.leagueShortcut!==PROVIDERS[key]?.shortcut||r.leagueSeason!==(new Date(now).getUTCMonth()<6?new Date(now).getUTCFullYear()-1:new Date(now).getUTCFullYear()))||!r.team1?.teamName||!r.team2?.teamName||!Number.isFinite(Date.parse(r.matchDateTimeUTC)))throw Error('Ongeldig wedstrijdrecord');ids.add(r.matchID);const score=r.matchResults?.find(x=>x.resultTypeID===2),finished=r.matchIsFinished===true, date=new Date(r.matchDateTimeUTC).toISOString();if(finished&&(!score||![score.pointsTeam1,score.pointsTeam2].every(x=>Number.isInteger(x)&&x>=0)||Date.parse(date)>now))throw Error('Ongeldige eindstand');const teams=verifiedUefaClubIdentity({key,season:r.leagueSeason,date,home:{id:'oldb-'+r.team1.teamId,name:r.team1.teamName},away:{id:'oldb-'+r.team2.teamId,name:r.team2.teamName},finished,score});return {id:'oldb-'+r.matchID,competition:key,date,round:r.group?.groupName||'Speelronde',status:finished?'FT':Date.parse(date)>now?'NS':'AWAITING',home:teams.home,away:teams.away,goals:{home:finished?score.pointsTeam1:null,away:finished?score.pointsTeam2:null},checkedAt:new Date(now).toISOString()};});const value=envelope(key,fixtures,now,{...SOURCE,databaseDownload:'/integrations/football?competition='+key});value.sourceLastChanged=rows.reduce((last,r)=>r.lastUpdateDateTime>last?r.lastUpdateDateTime:last,'');const missing=fixtures.filter(f=>f.status==='AWAITING'&&now-Date.parse(f.date)>24*3600000).length;if(missing){value.standings=[];value.standingsNote='Geen competitiestand: '+missing+' verstreken duels hebben nog geen gecontroleerde eindstand.';}return displayNames?displaySnapshot(value,key):value;
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
function create({fetcher=fetch,redis,clock=Date.now,resultsToken=process.env.FOOTBALL_DATA_API_KEY?.trim()||process.env.FOOTBALL_DATA_TOKEN?.trim(),sportmonksToken=process.env.SPORTMONKS_API_TOKEN?.trim()}={}){
 const cache=new Map(),pending=new Map();
 async function getSource(key){
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
      if(raw){const value=JSON.parse(raw);if(value.rightsExpiresAt>now&&!(sportmonksToken&&['eredivisie','kkd','premierleague','knvbbeker','eredivisieplayoffs'].includes(key)&&(value.sourceDetails?.name!=='Sportmonks Football API'||value.sourceDetails?.eventParserRevision!==sportmonks.EVENT_PARSER_REVISION))){cache.set(key,{at:now,value,ttl:15*60000});return currentManual(value,now);}}
     }catch{storageFailed=true;}
    }
    if(['eredivisie','kkd','premierleague','knvbbeker','eredivisieplayoffs'].includes(key)){
     // Sportmonks is the first provider. An outage or incomplete season falls back
     // to the existing public schedule and Football-Data.org results.
     if(sportmonksToken){
      try{
       const fixtures=await sportmonks.load({fetcher,token:sportmonksToken,now,sourceBody,competition:key});
       const value=envelope(key,fixtures,now,sportmonks.SOURCE);
       if(['knvbbeker','eredivisieplayoffs'].includes(key)){value.standings=[];value.standingsNote='Beker en play-offs hebben geen reguliere competitieranglijst.';}
       if(fixtures.some(f=>f.status==='AWAITING'&&Date.parse(f.date)<now)){
        value.standings=[];value.standingsNote='Niet alle eindstanden zijn bevestigd; stand tijdelijk verborgen.';
       }
       cache.set(key,{at:now,value,ttl:15*60000});return value;
      }catch(error){console.warn('football47 Sportmonks fallback:',error.message);}
     }
     if(key!=='eredivisie'){
      // No subscription is a configured absence, not a failed source call.
      // A configured token with unusable data must be reported as an outage.
      const value={...envelope(key,[],now),source:'Veldio',sourceDetails:null,
       status:sportmonksToken?'source_unavailable':'unavailable',
       message:sportmonksToken?'Sportmonks '+key+'-gegevens tijdelijk niet beschikbaar.':key+' vereist een actief Sportmonks-token.'};
      cache.set(key,{at:now,value,ttl:60000});
      return value;
     }
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
    let openLigaError;
    try{
     const r=await fetcher('https://api.openligadb.de/getmatchdata/'+PROVIDERS[key].shortcut+'/'+(new Date(now).getUTCMonth()<6?new Date(now).getUTCFullYear()-1:new Date(now).getUTCFullYear()),{headers:{'User-Agent':'Veldio/48 (redactie.veldio@gmail.com)'},signal:AbortSignal.timeout(12000)});
     if(!r.ok){await r.body?.cancel();throw Error('Bron HTTP '+r.status);}
     const value=fromOpenLiga(JSON.parse(await sourceBody(r)),now,key,{displayNames:false});
     cache.set(key,{at:now,value,ttl:15*60000});return value;
    }catch(e){openLigaError=e;}
    // La Liga alone has a documented free-tier, credentialed second source.
    // Validate a complete 380-match dataset instead of publishing a partial table.
    if(key==='laliga'&&resultsToken){
     try{
      const fallback=await require('./football-laliga108').load({token:resultsToken,fetcher,now,sourceBody});
      const value=envelope(key,fallback.fixtures,now,fallback.source);
      if(fallback.fixtures.some(f=>f.status==='AWAITING'&&Date.parse(f.date)<now-24*3600000)){
       value.standings=[];value.standingsNote='Geen betrouwbare stand: gespeelde wedstrijden zonder bevestigde eindstand.';
      }
      cache.set(key,{at:now,value,ttl:15*60000});return value;
     }catch(e){console.warn('football47 La Liga reservebron niet beschikbaar:',e.message);}
    }
    throw openLigaError;
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

 async function publish(body){if(!redis?.isReady)throw Error('Permanente opslag niet beschikbaar');const value=manual(body,clock());const prior=await redis.get('football47:'+body.competition);if(prior){const old=JSON.parse(prior);if(old.rightsExpiresAt>clock()){const merged=new Map((old.fixtures||[]).map(f=>[String(f.id),f]));for(const f of value.fixtures)merged.set(String(f.id),f);if(merged.size>500)throw Error('Maximaal 500 handmatige wedstrijden per competitie');value.fixtures=[...merged.values()].filter(f=>clock()-Date.parse(f.checkedAt)<=36*3600000);}}const saved=await redis.eval("local old=redis.call('GET',KEYS[1]) or ''; if old~=ARGV[1] then return 0 end; redis.call('SET',KEYS[1],ARGV[2]); return 1",{keys:['football47:'+body.competition],arguments:[prior||'',JSON.stringify(value)]});if(Number(saved)!==1)throw Error('Invoer is ondertussen gewijzigd; controleer en probeer opnieuw');cache.delete(body.competition);return displaySnapshot(value,body.competition);}
 async function get(key,options){
  return displaySnapshot(await getSource(key),key,options);
 }
 // Select matches using source labels so a display correction does not select extra matches.
 async function getSelected(key){
  if(!EUROPE.includes(key))return get(key);
  const snapshots=await Promise.all(EUROPE.map(getSource));
  const selected=select(snapshots.flatMap(s=>s.fixtures||[]),require('./match-selection50.json'));
  const snap=snapshots[EUROPE.indexOf(key)];
  return displaySnapshot({...snap,fixtures:selected.filter(f=>f.competition===key),
   selection:'Veldio topwedstrijden',selectionLimit:require('./match-selection50.json').maxPerWeek},key);
 }
 async function overview(options){
  const [eredivisie,...snapshots]=await Promise.all([get('eredivisie',options),...EUROPE.map(getSource)]);
  const europe=select(snapshots.filter(s=>s.rightsExpiresAt>clock()).flatMap(s=>s.fixtures||[]),require('./match-selection50.json'));
  return {...eredivisie,europeanFixtures:europe.map(fixture=>displayFixture(fixture,fixture.competition,options))};
 }

 return {get,getSelected,overview,publish,catalog:()=>Object.entries(CATALOG).map(([key,v])=>({key,...v}))};}
module.exports={CATALOG,SOURCE,table,envelope,fromOpenLiga,verifiedUefaClubIdentity,displayClubName,manual,currentManual,sourceBody,create};
