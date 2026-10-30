'use strict';
const {seasonFor,validateSnapshot,chooseFeatured,buildPreview,githubFile,DONE}=require('./eredivisie-data');
const norm=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]/g,'').replace(/rotterdam|eindhoven|alkmaar|sc|fc/g,'');
const text=s=>String(s).replace(/<[^>]*>/g,' ').replace(/&amp;/g,'&').replace(/\s+/g,' ').trim();
function officialFixtures(raw,season){
 const rows=Object.values(raw).flatMap(g=>(g.matches||[]).map(f=>{
  if(!Number.isInteger(f.eid)||!f.home?.oid||!f.away?.oid||!Number.isInteger(f.round)||!Number.isFinite(Date.parse(f.date)))throw Error('Ongeldig officieel wedstrijdschema.');
  const d=new Date(f.date);if(d<Date.parse(season+'-07-01')||d>Date.parse((season+1)+'-07-01'))throw Error('Wedstrijdschema komt uit een ander seizoen.');
  const status=({played:'FT',fixture:'NS',live:'LIVE',postponed:'PST',cancelled:'CANC',suspended:'SUSP'})[f.status]||'TBD';
  return {id:f.eid,date:f.date,round:'Speelronde '+f.round,status,venue:{},home:{id:f.home.oid,name:f.home.name,logo:f.home.logo},away:{id:f.away.oid,name:f.away.name,logo:f.away.logo},goals:{home:DONE.has(status)?f.home.score:null,away:DONE.has(status)?f.away.score:null},sourceUrl:f.detail};
 }));
 if(rows.length<270||new Set(rows.map(f=>f.round)).size!==34)throw Error('Officieel seizoensschema onvolledig.');
 return rows;
}
function balance(fixtures,id,side){const rows=fixtures.filter(f=>DONE.has(f.status)&&(side==='home'?f.home.id===id:side==='away'?f.away.id===id:f.home.id===id||f.away.id===id));let r={played:rows.length,win:0,draw:0,lose:0,goals:{for:0,against:0}};for(const f of rows){const h=f.home.id===id,a=h?f.goals.home:f.goals.away,b=h?f.goals.away:f.goals.home;if(!Number.isInteger(a)||!Number.isInteger(b))throw Error('Uitslag ontbreekt.');r.goals.for+=a;r.goals.against+=b;r[a>b?'win':a===b?'draw':'lose']++;}return r;}
function officialStandings(html,fixtures){
 const standings=[];
 for(const m of html.matchAll(/<tr\s+data-clubs="([^"]+)"[^>]*>([\s\S]*?)<\/tr>/g)){
  const cells=[...m[2].matchAll(/<td\b[^>]*>([\s\S]*?)<\/td>/g)].map(x=>x[1]);if(cells.length!==7)continue;
  const plain=cells.map(text),wdl=plain[3].match(/^(\d+)\s*\|\s*(\d+)\s*\|\s*(\d+)$/),goals=plain[4].match(/^(\d+)-(\d+)$/);
  const name=text((cells[1].match(/<span[^>]*>([\s\S]*?)<\/span>/)||[])[1]||'');
  if(!wdl||!goals||!name)throw Error('Structuur officiële stand gewijzigd.');
  const home=balance(fixtures,m[1],'home'),away=balance(fixtures,m[1],'away'),all=balance(fixtures,m[1]);
  const official={played:Number(plain[2]),win:Number(wdl[1]),draw:Number(wdl[2]),lose:Number(wdl[3]),goals:{for:Number(goals[1]),against:Number(goals[2])}};
  if(JSON.stringify(all)!==JSON.stringify(official))throw Error('Stand en alle afzonderlijke uitslagen zijn niet consistent: '+name);
  const form=fixtures.filter(f=>DONE.has(f.status)&&(f.home.id===m[1]||f.away.id===m[1])).sort((a,b)=>Date.parse(a.date)-Date.parse(b.date)).slice(-5).map(f=>{const h=f.home.id===m[1],a=h?f.goals.home:f.goals.away,b=h?f.goals.away:f.goals.home;return a>b?'W':a===b?'G':'V';}).join('');
  standings.push({rank:Number(plain[0]),team:{id:m[1],name,logo:(cells[1].match(/src="([^"]+)"/)||[])[1]?.replace(/&amp;/g,'&')},points:Number(plain[6]),goalsDiff:Number(plain[5]),all,home,away,form});
 }
 if(standings.length!==18)throw Error('Niet alle 18 clubs in de officiële stand gevonden.');
 return standings.sort((a,b)=>a.rank-b.rank);
}
function officialPlayers(raw){if(!Array.isArray(raw)||raw.length<100)throw Error('Spelersstatistieken ontbreken.');const all=raw.map(p=>({id:p.id,name:p.name,team:p.club_name,teamId:p.team_id,photo:p.image,appearances:p.stats.games_played,minutes:p.stats.time_played,goals:p.stats.goals,assists:p.stats.goal_assists,yellow:p.stats.yellow_cards,red:p.stats.total_red_cards,shots:p.stats.total_shots,shotsOnTarget:p.stats.shots_on_target_inc_goals,chances:p.stats.att_assist,saves:p.stats.saves_made,passes:p.stats.total_successful_passes,passAccuracy:p.stats.total_pass_accuracy,topSpeed:p.stats.tracking_top_speed}));const groups={all};for(const [key,metric]of Object.entries({scorers:'goals',assists:'assists',yellow:'yellow',red:'red',shots:'shots',shotsOnTarget:'shotsOnTarget',chances:'chances',saves:'saves',passes:'passes',passAccuracy:'passAccuracy',topSpeed:'topSpeed'}))groups[key]=all.filter(p=>Number.isFinite(p[metric])&&p[metric]>0).sort((a,b)=>b[metric]-a[metric]||b.minutes-a.minutes||a.name.localeCompare(b.name)).slice(0,50);return groups;}
async function get(url,fetcher=fetch,json=true){const r=await fetcher(url,{signal:AbortSignal.timeout(30000)});if(!r.ok)throw Error('Officiële gegevensbron HTTP '+r.status);return json?r.json():r.text();}
async function collectOfficial({token,key,fetcher=fetch,now=Date.now(),save=true}={}){
 const season=seasonFor(now);
 const raw=await get('https://eredivisie.nl/cache/site/EredivisieNL/json/fixtures.json',fetcher);
 const fixtures=officialFixtures(raw,season);
 const standings=officialStandings(await get('https://eredivisie.nl/competitie/stand/',fetcher,false),fixtures);
 const players=officialPlayers(await get('https://eredivisie.nl/cache/site/EredivisieNL/json/stats/general-data.json',fetcher));
 const warnings=[];
 // ESPN only supplies venue names, matched against the official home/away clubs and exact kickoff.
 try{const events=[];for(const y of [season,season+1])events.push(...(await get('https://site.api.espn.com/apis/site/v2/sports/soccer/ned.1/scoreboard?dates='+y+'&limit=1000',fetcher)).events||[]);
  for(const f of fixtures){const e=events.find(e=>Math.abs(Date.parse(e.date)-Date.parse(f.date))<60000&&e.competitions?.[0]?.competitors?.some(c=>c.homeAway==='home'&&norm(c.team.shortDisplayName||c.team.displayName)===norm(f.home.name))&&e.competitions[0].competitors.some(c=>c.homeAway==='away'&&norm(c.team.shortDisplayName||c.team.displayName)===norm(f.away.name)));if(e){const v=e.competitions[0].venue;f.venue={name:v?.fullName||'',city:v?.address?.city||''};}}
 }catch(e){warnings.push('Stadionnamen niet beschikbaar.');}
 const s=validateSnapshot({schemaVersion:1,updatedAt:new Date(now).toISOString(),source:'Eredivisie.nl · officiële competitiegegevens',league:{id:88,name:'Eredivisie',season},fixtures,standings,players,warnings});
 let previous=null;try{previous=(await get(require('./eredivisie-data').DATA_URL,fetcher)).featured;}catch{}
 const feature=chooseFeatured(s,now,previous);
 if(feature){
  s.headToHead=s.fixtures.filter(f=>DONE.has(f.status)&&[feature.fixture.home.id,feature.fixture.away.id].includes(f.home.id)&&[feature.fixture.home.id,feature.fixture.away.id].includes(f.away.id)).sort((a,b)=>Date.parse(b.date)-Date.parse(a.date)).slice(0,5);
  s.featured={...feature,preview:buildPreview(s,feature)};
  if(previous?.fixtureId===feature.fixtureId&&previous.imageUrl)s.featured.imageUrl=previous.imageUrl;
  if(!s.featured.imageUrl){try{const {stadiumFor,createCover}=require('./match-cover');const stadium=await stadiumFor(feature.fixture.venue,key,fetcher);const image=await createCover({kind:'preview',fixture:feature.fixture,...stadium,competition:'Eredivisie'},{token,fetcher});s.featured.imageUrl=image.imageUrl;s.featured.imageCredit=image.imageCredit;}catch(e){warnings.push('Beeldcontrole: '+e.message);}}
 }
 if(save)await githubFile('statistics/eredivisie.json',JSON.stringify(s),{token,fetcher});
 return s;
}
if(require.main===module)collectOfficial({token:process.env.GITHUB_TOKEN,key:process.env.API_FOOTBALL_KEY}).then(s=>console.log(JSON.stringify({updatedAt:s.updatedAt,fixtures:s.fixtures.length,clubs:s.standings.length,players:s.players.all.length,featured:s.featured?.fixtureId,warnings:s.warnings}))).catch(e=>{console.error(e.message);process.exitCode=1;});
module.exports={officialFixtures,officialStandings,officialPlayers,collectOfficial};
