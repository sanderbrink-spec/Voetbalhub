'use strict';
const crypto=require('node:crypto');
const REPO='sanderbrink-spec/Voetbalhub';
const BRANCH='editorial-media';
const DATA_URL=`https://raw.githubusercontent.com/${REPO}/${BRANCH}/statistics/eredivisie.json`;
const DONE=new Set(['FT','AET','PEN']);
const ACTIVE=new Set(['NS','TBD']);
const hash=x=>crypto.createHash('sha256').update(typeof x==='string'?x:JSON.stringify(x)).digest('hex');
function seasonFor(now=Date.now()){const d=new Date(now);return d.getUTCMonth()>=6?d.getUTCFullYear():d.getUTCFullYear()-1;}
function fixtureRow(f,{leagueOnly=true}={}){
 if((leagueOnly&&f.league?.id!==88)||!Number.isInteger(f.fixture?.id)||!Number.isFinite(Date.parse(f.fixture.date))||!f.teams?.home?.id||!f.teams?.away?.id)throw Error('Ongeldige Eredivisiewedstrijd.');
 const status=f.fixture.status?.short||'TBD';
 const goals={home:f.goals?.home??null,away:f.goals?.away??null};
 if(DONE.has(status)&&(!Number.isInteger(goals.home)||!Number.isInteger(goals.away)))throw Error('Afgeronde wedstrijd zonder geldige eindstand.');
 return {id:f.fixture.id,date:f.fixture.date,round:f.league.round,status,minute:f.fixture.status?.elapsed??null,venue:f.fixture.venue||{},home:f.teams.home,away:f.teams.away,goals,halftime:f.score?.halftime||{}};
}
function playerRows(rows,kind){return rows.map(p=>{const s=p.statistics?.find(x=>x.league?.id===88)||p.statistics?.[0];if(!p.player?.id||!s)return null;return {id:p.player.id,name:p.player.name,photo:p.player.photo,team:s.team?.name,teamId:s.team?.id,appearances:s.games?.appearences??null,minutes:s.games?.minutes??null,goals:s.goals?.total??null,assists:s.goals?.assists??null,yellow:s.cards?.yellow??null,red:s.cards?.red??null,kind};}).filter(Boolean);}
function validateSnapshot(s){
 if(s?.schemaVersion!==1||s.league?.id!==88||!Number.isInteger(s.league.season)||!Number.isFinite(Date.parse(s.updatedAt))||!Array.isArray(s.fixtures)||!s.fixtures.length||!Array.isArray(s.standings)||s.standings.length<2)throw Error('Onvolledige Eredivisiegegevens.');
 if(s.fixtures.some(f=>!Number.isInteger(f.id)||!Number.isFinite(Date.parse(f.date))||!f.home?.name||!f.away?.name))throw Error('Wedstrijdgegevens ontbreken.');
 if(new Set(s.fixtures.map(f=>f.id)).size!==s.fixtures.length)throw Error('Dubbele wedstrijd-ID.');
 for(const t of s.standings){if(!t.team?.id||!t.team?.name||!Number.isInteger(t.rank)||!Number.isInteger(t.points)||!Number.isInteger(t.all?.played))throw Error('Ongeldige stand.');}
 return s;
}
function roundCandidates(s,now){
 const groups=new Map();
 for(const f of s.fixtures){if(!groups.has(f.round))groups.set(f.round,[]);groups.get(f.round).push(f);}
 return [...groups].map(([round,fixtures])=>({round,fixtures,start:Math.min(...fixtures.map(f=>Date.parse(f.date)))})).filter(g=>g.start>now&&g.start-now<=48*3600000&&g.fixtures.every(f=>ACTIVE.has(f.status))).sort((a,b)=>a.start-b.start);
}
function chooseFeatured(s,now=Date.now(),previous=null){
 const groups=roundCandidates(s,now);if(!groups.length)return null;
 const g=groups[0];
 if(previous?.round===g.round&&previous.season===s.league.season){const f=g.fixtures.find(f=>f.id===previous.fixtureId);return f?{...previous,fixture:f}:null;}
 const table=new Map(s.standings.map(t=>[t.team.id,t]));
 const derbies=[['Ajax','Feyenoord'],['PSV','Ajax'],['PSV','Feyenoord'],['FC Groningen','Heerenveen'],['Twente','Heracles']];
 const weight=f=>{
  const a=table.get(f.home.id),b=table.get(f.away.id);if(!a||!b)return -Infinity;
  const top=(19-a.rank)+(19-b.rank),close=18-Math.abs(a.rank-b.rank);
  const title=a.rank<=4&&b.rank<=4?25:0;
  const derby=derbies.some(pair=>pair.every(name=>[f.home.name,f.away.name].some(x=>x.toLowerCase().includes(name.toLowerCase()))))?15:0;
  return top*2+close+title+derby;
 };
 const f=[...g.fixtures].sort((a,b)=>weight(b)-weight(a)||Date.parse(a.date)-Date.parse(b.date)||a.id-b.id)[0];
 if(!f||!Number.isFinite(weight(f)))return null;
 return {season:s.league.season,round:g.round,fixtureId:f.id,selectedAt:new Date(now).toISOString(),publishAt:new Date(g.start-48*3600000).toISOString(),reason:'Gekozen op klassering, onderling verschil en vaste rivaliteitscriteria.',fixture:f};
}
function formFor(s,id){return s.fixtures.filter(f=>DONE.has(f.status)&&(f.home.id===id||f.away.id===id)).sort((a,b)=>Date.parse(b.date)-Date.parse(a.date)).slice(0,5).map(f=>{const home=f.home.id===id,a=home?f.goals.home:f.goals.away,b=home?f.goals.away:f.goals.home;return {...f,result:a>b?'W':a===b?'G':'V'};});}
function buildPreview(s,feature){
 const f=feature.fixture,home=s.standings.find(t=>t.team.id===f.home.id),away=s.standings.find(t=>t.team.id===f.away.id);
 if(!home||!away)throw Error('Stand ontbreekt voor de geselecteerde wedstrijd.');
 const date=new Intl.DateTimeFormat('nl-NL',{timeZone:'Europe/Amsterdam',weekday:'long',day:'numeric',month:'long',hour:'2-digit',minute:'2-digit'}).format(new Date(f.date));
 const n=x=>Number.isInteger(x)?x:'onbekend';
 const paragraphs=[
  `${f.home.name} en ${f.away.name} zijn onze keuze voor ${feature.round.replace('Regular Season - ','speelronde ')}. De aftrap staat gepland op ${date}. ${f.venue.name?`Het duel wordt gespeeld in ${f.venue.name}.`:'De stadionnaam is nog niet bevestigd.'}`,
  `${f.home.name} staat bij de laatste gegevensupdate op plaats ${home.rank} met ${home.points} punten uit ${home.all.played} duels. ${f.away.name} bezet plaats ${away.rank} en verzamelde ${away.points} punten uit ${away.all.played} wedstrijden. Deze cijfers beschrijven de situatie vóór de speelronde; zij zijn geen voorspelling van de uitslag.`,
  `De thuisbalans van ${f.home.name} bestaat uit ${n(home.home?.played)} gespeelde duels, ${n(home.home?.win)} overwinningen, ${n(home.home?.draw)} gelijke spelen en ${n(home.home?.lose)} nederlagen. ${f.away.name} noteert buitenshuis ${n(away.away?.win)} zeges, ${n(away.away?.draw)} remises en ${n(away.away?.lose)} nederlagen in ${n(away.away?.played)} wedstrijden.`,
  `In de competitie maakte ${f.home.name} ${n(home.all.goals?.for)} doelpunten en kreeg het ${n(home.all.goals?.against)} treffers tegen. Bij ${f.away.name} zijn dat ${n(away.all.goals?.for)} doelpunten voor en ${n(away.all.goals?.against)} tegen. Het verschil in gespeelde wedstrijden blijft relevant bij het vergelijken van deze seizoenstotalen.`,
  `De recente vorm en beschikbare doelpuntenmakers staan hieronder, naast de onderlinge ontmoetingen die de gegevensleverancier heeft aangeleverd. Ontbrekende cijfers blijven leeg. De selectie van deze wedstrijd volgt vaste criteria voor de stand en rivaliteit, zodat per speelronde één duel wordt uitgelicht.`
 ];
 return {headline:`${f.home.name} tegen ${f.away.name}: de cijfers vóór de aftrap`,standfirst:'Wedstrijd van de speelronde. Een vooruitblik op basis van klassering, thuis- en uitbalans, doelpunten en recente vorm.',body:paragraphs,homeForm:formFor(s,f.home.id),awayForm:formFor(s,f.away.id),scorers:s.players.scorers.filter(p=>[f.home.id,f.away.id].includes(p.teamId)),headToHead:s.headToHead||[],fixture:f,selection:feature.reason,publishedAt:feature.selectedAt};
}
let nextProviderCall=0;
async function apiRequest(endpoint,params,key,fetcher=fetch){
 if(!key)throw Error('API_FOOTBALL_KEY ontbreekt.');
 const u=new URL('https://v3.football.api-sports.io/'+endpoint);for(const [k,v]of Object.entries(params))u.searchParams.set(k,v);
 let r;
 for(let attempt=0;attempt<3;attempt++){
  if(fetcher===fetch){const delay=Math.max(0,nextProviderCall-Date.now());if(delay)await new Promise(resolve=>setTimeout(resolve,delay));nextProviderCall=Date.now()+6500;}
  r=await fetcher(u,{headers:{'x-apisports-key':key},signal:AbortSignal.timeout(25000)});
  if(r.status!==429||attempt===2)break;
  await new Promise(resolve=>setTimeout(resolve,60000));
 }
 if(!r.ok)throw Error(`Statistiekbron HTTP ${r.status}.`);
 const d=await r.json();if((Array.isArray(d.errors)?d.errors.length:Object.keys(d.errors||{}).length)||!Array.isArray(d.response))throw Error('Statistiekbron: '+JSON.stringify(d.errors||'ongeldig antwoord'));
 return d.response;
}
async function githubFile(file,content,{token,fetcher=fetch}){
 if(!token)throw Error('GITHUB_TOKEN ontbreekt.');
 const url=`https://api.github.com/repos/${REPO}/contents/${file}`;
 const headers={Authorization:'Bearer '+token,'Accept':'application/vnd.github+json','Content-Type':'application/json'};
 const get=await fetcher(url+'?ref='+BRANCH,{headers,signal:AbortSignal.timeout(25000)});if(!get.ok&&get.status!==404)throw Error('Mediabestand niet leesbaar.');
 const existing=get.ok?await get.json():null;
 if(existing?.content&&Buffer.from(existing.content,'base64').equals(Buffer.from(content)))return;
 const r=await fetcher(url,{method:'PUT',headers,body:JSON.stringify({message:'Update verified Eredivisie statistics',branch:BRANCH,content:Buffer.from(content).toString('base64'),...(existing?{sha:existing.sha}:{})}),signal:AbortSignal.timeout(25000)});
 if(!r.ok)throw Error('Statistieken konden niet worden bewaard: HTTP '+r.status);
}
async function collect({key,token,fetcher=fetch,now=Date.now()}={}){
 const season=seasonFor(now),params={league:88,season};
 const fixtures=(await apiRequest('fixtures',params,key,fetcher)).map(fixtureRow);
 const standings=(await apiRequest('standings',params,key,fetcher))[0]?.league?.standings?.flat()||[];
 if(!fixtures.length||!standings.length)throw Error('Geen actuele Eredivisiegegevens. Bestaande cijfers blijven behouden.');
 const warnings=[];
 const players={};
 for(const [kind,endpoint]of Object.entries({scorers:'topscorers',assists:'topassists',yellow:'topyellowcards',red:'topredcards'})){
  try{players[kind]=playerRows(await apiRequest('players/'+endpoint,params,key,fetcher),kind);}catch(e){players[kind]=[];warnings.push(kind+': '+e.message);}
 }
 const s=validateSnapshot({schemaVersion:1,updatedAt:new Date(now).toISOString(),source:'API-FOOTBALL / API-SPORTS',league:{id:88,name:'Eredivisie',season},fixtures,standings,players,warnings});
 let previous=null;
 try{const r=await fetcher(DATA_URL,{signal:AbortSignal.timeout(25000)});if(r.ok)previous=(await r.json()).featured;}catch{}
 const feature=chooseFeatured(s,now,previous);
 if(feature){
  try{s.headToHead=(await apiRequest('fixtures/headtohead',{h2h:feature.fixture.home.id+'-'+feature.fixture.away.id,last:5},key,fetcher)).filter(f=>DONE.has(f.fixture?.status?.short)).map(f=>({...fixtureRow(f,{leagueOnly:false}),competition:f.league.name}));}catch(e){warnings.push('Onderlinge duels niet beschikbaar.');}
  s.featured={...feature,preview:buildPreview(s,feature)};
  if(previous?.fixtureId===feature.fixtureId&&previous.imageUrl)s.featured.imageUrl=previous.imageUrl;
 }
 await githubFile('statistics/eredivisie.json',JSON.stringify(s),{token,fetcher});
 return s;
}
if(require.main===module)collect({key:process.env.API_FOOTBALL_KEY,token:process.env.GITHUB_TOKEN}).then(s=>console.log(JSON.stringify({updatedAt:s.updatedAt,fixtures:s.fixtures.length,teams:s.standings.length,featured:s.featured?.fixtureId,warnings:s.warnings}))).catch(e=>{console.error(e.message);process.exitCode=1;});
module.exports={DATA_URL,BRANCH,REPO,DONE,hash,seasonFor,fixtureRow,validateSnapshot,chooseFeatured,buildPreview,formFor,apiRequest,githubFile,collect};
