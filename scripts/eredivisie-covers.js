'use strict';
const {apiRequest,DATA_URL}=require('./eredivisie-data');
const {stadiumFor,createCover}=require('./match-cover');
const {contentHash}=require('../article-covers');
const API='https://voetbalhub-redactie.onrender.com';
const norm=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]/g,'').replace(/^fc|^sc/,'');
function kickoffFromFacts(p){
 const matches=p.candidate.facts.slice(0,2).map(f=>f.text.match(/om (\d{1,2})[.:](\d{2}) uur/i));
 if(matches.some(m=>!m)||matches[0][1]!==matches[1][1]||matches[0][2]!==matches[1][2])return p.candidate.eventDate;
 const name=new Intl.DateTimeFormat('en',{timeZone:'Europe/Amsterdam',timeZoneName:'longOffset'}).formatToParts(new Date(p.candidate.eventDate+'T12:00:00Z')).find(x=>x.type==='timeZoneName').value;
 const offset=name.replace('GMT','');
 return p.candidate.eventDate+'T'+matches[0][1].padStart(2,'0')+':'+matches[0][2]+':00'+offset;
}
const teamCache=new Map();
async function resolveTeam(name,key,fetcher){
 if(teamCache.has(name))return teamCache.get(name);
 const query=name==='AZ'?'AZ Alkmaar':name.replace(/^FC |^SC /i,'');
 const rows=await apiRequest('teams',query.length<3?{name:query}:{search:query},key,fetcher);
 const unique=[...new Map(rows.filter(x=>name==='FC Midtjylland'||x.team?.country==='Netherlands').map(x=>[x.team.id,x])).values()];
 const exact=unique.filter(x=>String(x.team?.name).toLowerCase()===name.toLowerCase());
 const match=exact.length===1?exact:unique.filter(x=>norm(x.team?.name)===norm(name)||(name==='AZ'&&norm(x.team?.name)==='azalkmaar'));
 if(match.length!==1)throw Error('Clublogo en stadion niet eenduidig bevestigd: '+name+' ('+match.map(x=>x.team.name).join(', ')+')');
 const result={id:match[0].team.id,name,logo:match[0].team.logo,venue:{...match[0].venue,provider:'API-SPORTS'}};
 teamCache.set(name,result);return result;
}

async function sync({key,secret,token,fetcher=fetch}={}){
 if(!secret||!token)throw Error('Publicatie-instellingen ontbreken.');
 const r=await fetcher(API+'/articles',{signal:AbortSignal.timeout(25000)});if(!r.ok)throw Error('Artikeloverzicht ontbreekt.');
 const before=(await r.json()).articles,updates=[],skipped=[];
 const packets=[...before.filter(a=>a.match&&Number.isInteger(a.match.homeScore)&&Number.isInteger(a.match.awayScore)).map(a=>({payload:{draft:{headline:a.headline,standfirst:a.standfirst,body:a.body},match:a.match},kind:'report',home:a.match.homeTeam,away:a.match.awayTeam,date:a.match.playedAt,goals:{home:a.match.homeScore,away:a.match.awayScore},category:a.category})),...require('../automatic-bootstrap.json').map(p=>({payload:{draft:p.draft},kind:'preview',home:p.candidate.teams[0],away:p.candidate.teams[1],date:kickoffFromFacts(p),category:p.candidate.category})),{payload:require('../redactie/trial/article.json').payload,kind:'preview',home:'FC Emmen',away:'FC Den Bosch',date:'2026-11-01T14:30:00+01:00',category:'Keuken Kampioen Divisie'},...require('../redactie/curated/articles.json').filter(p=>p.payload.match).map(p=>({payload:p.payload,kind:'report',home:p.payload.match.homeTeam,away:p.payload.match.awayTeam,date:p.payload.match.playedAt,goals:{home:p.payload.match.homeScore,away:p.payload.match.awayScore},category:'KNVB Beker'}))];
 let stats=null;try{const r=await fetcher(DATA_URL);if(r.ok)stats=await r.json();}catch{}
 for(const a of before){
  if(a.status!=='published'||a.imageReview?.method==='fixture-specific-stadium-and-logos-v2')continue;
  const packet=packets.find(p=>contentHash(a)===contentHash(p.payload));if(!packet)continue;
  try{
   const home=await resolveTeam(packet.home,key,fetcher),away=await resolveTeam(packet.away,key,fetcher);
   const found=stats?.fixtures.find(f=>norm(f.home.name)===norm(packet.home)&&norm(f.away.name)===norm(packet.away)&&f.date.slice(0,10)===packet.date.slice(0,10));
   // A date-only preview packet is insufficient to announce an exact kickoff.
   if(packet.kind==='preview'&&!found&&!packet.date.includes('T'))throw Error('Exact aftraptijdstip nog niet bevestigd.');
   const fixture={id:found?.id||packet.payload.match?.playedAt,date:found?.date||packet.date,status:packet.kind==='report'?'FT':'NS',home,away,venue:{...home.venue,name:home.venue?.name||found?.venue?.name||''},goals:packet.goals||{home:null,away:null}};
   const stadium=packet.kind==='preview'?await stadiumFor(fixture.venue,key,fetcher):{};
   const image=await createCover({kind:packet.kind,fixture,...stadium,competition:packet.category},{token,fetcher});
   const response=await fetcher(API+'/article-image',{method:'POST',headers:{Authorization:'Bearer '+secret,'Content-Type':'application/json'},body:JSON.stringify({approved:true,articleId:a.id,...image}),signal:AbortSignal.timeout(25000)});
   const result=await response.json();if(!response.ok||result.updated!==true||result.article?.imageUrl!==image.imageUrl)throw Error('Afbeeldingskoppeling niet bevestigd.');
   updates.push({id:a.id,imageUrl:image.imageUrl});
  }catch(e){skipped.push({headline:a.headline,reason:e.message});}
 }
 const check=await fetcher(API+'/articles',{signal:AbortSignal.timeout(25000)});if(!check.ok)throw Error('Controle openbare feed mislukt.');const after=(await check.json()).articles;
 for(const u of updates){const old=before.find(a=>a.id===u.id),a=after.find(a=>a.id===u.id);if(a?.imageUrl!==u.imageUrl)throw Error('Beeld ontbreekt in app.');for(const k of ['headline','standfirst','body','publishedAt'])if(JSON.stringify(old[k])!==JSON.stringify(a[k]))throw Error('Artikelinhoud gewijzigd.');}
 return {updated:updates.length,skipped};
}
if(require.main===module)sync({key:process.env.API_FOOTBALL_KEY,secret:process.env.HUB_API_SECRET,token:process.env.GITHUB_TOKEN}).then(x=>console.log(JSON.stringify(x))).catch(e=>{console.error(e.message);process.exitCode=1;});
module.exports={resolveTeam,sync};
