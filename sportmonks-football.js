'use strict';
// Sportmonks is the first-choice football provider only for leagues explicitly configured here.
// Never log the token, API URL with token, or raw provider errors.
// The Eredivisie is league 72; 271 is Denmark's Superliga. Verify against provider catalog.
const LEAGUES={eredivisie:72};
const CREDIT='Sportmonks Football API';
const SOURCE={name:CREDIT,url:'https://www.sportmonks.com/football-api/',license:'Sportmonks subscription; commercial display rights subject to contract',commercial:null,cost:'trial/subscription',refreshMinutes:15,databaseDownload:null};
const finalStates=new Set([5,7,8]);
function parseFixture(row,competition,now){
 if(!row||row.league_id!==LEAGUES[competition]||!Number.isSafeInteger(row.id))throw Error('Ongeldig Sportmonks competitierecord');
 const home=row.participants?.find(p=>p.meta?.location==='home'),away=row.participants?.find(p=>p.meta?.location==='away');
 const kickoff=Number.isSafeInteger(row.starting_at_timestamp)?row.starting_at_timestamp*1000:Date.parse(String(row.starting_at||'').replace(' ','T')+'Z');
 if(!home?.id||!away?.id||!home.name||!away.name||home.id===away.id||!Number.isFinite(kickoff))throw Error('Sportmonks deelnemers of datum ontbreken');
 const state=Number(row.state_id);
 let status=finalStates.has(state)?'FT':state===1?'NS':state===10?'PST':state===12?'CANC':state===13?'TBD':'AWAITING';
 const score=(label)=>{const candidates=(row.scores||[]).filter(x=>x.description===label&&['home','away'].includes(x.score?.participant));if(candidates.length!==2||new Set(candidates.map(x=>x.score.participant)).size!==2)return null;return Object.fromEntries(candidates.map(x=>[x.score.participant,x.score.goals]));};
 let goals={home:null,away:null};
 if(status==='FT'){
   // Never mistake an in-play CURRENT score for a verified final score.
   const current=score('CURRENT');
   if(!current||!Number.isInteger(current.home)||!Number.isInteger(current.away)||current.home<0||current.away<0||kickoff>now){status='AWAITING';}
   else goals=current;
 }
 const halftime=score('1ST_HALF');
 const rawRound=String(row.round?.name||'').trim();
 const round=/^\d{1,2}$/.test(rawRound)?'Speelronde '+rawRound:
   /^(?:Speelronde|Round)\s+(\d{1,2})$/i.test(rawRound)?'Speelronde '+rawRound.match(/\d{1,2}/)[0]:'';
 return {id:'sm-'+row.id,competition,date:new Date(kickoff).toISOString(),round, status,
  home:{id:'sm-'+home.id,name:home.name},away:{id:'sm-'+away.id,name:away.name},goals,
  ...(status==='FT'&&halftime&&[halftime.home,halftime.away].every(Number.isInteger)&&halftime.home<=goals.home&&halftime.away<=goals.away?{halfTime:halftime}:{}),
  checkedAt:new Date(now).toISOString(),resultSource:CREDIT,
  ...(status==='FT'?{resultExpiresAt:now+36*3600000,goalTimeline:confirmedGoals(row,goals)}:{})};
}
// Do not turn unverified or incomplete live events into newspaper facts.
function confirmedGoals(row,final){
 const total=final.home+final.away;
 if(!Number.isInteger(total)||total<2||total>15||!Array.isArray(row.events)||row.events.length>150)return [];
 const raw=row.events.filter(e=>[14,15,16].includes(e?.type_id));
 if(raw.length!==total||!raw.every(e=>Number.isInteger(e.sort_order)&&Number.isInteger(e.minute)&&e.minute>=1&&e.minute<=130&&
   (e.extra_minute==null||Number.isInteger(e.extra_minute)&&e.extra_minute>=0&&e.extra_minute<=30)&&
   typeof e.player_name==='string'&&/^[\p{L} .'-]{3,75}$/u.test(e.player_name.trim())&&
   /^\d{1,2}\s*[-:]\s*\d{1,2}$/.test(String(e.result||''))))return [];
 const sorted=[...raw].sort((a,b)=>a.sort_order-b.sort_order);
 if(new Set(sorted.map(e=>e.sort_order)).size!==sorted.length)return [];
 let previous={home:0,away:0};
 const events=[];
 for(const e of sorted){
  const m=String(e.result).match(/^(\d{1,2})\s*[-:]\s*(\d{1,2})$/),next={home:Number(m[1]),away:Number(m[2])};
  const goalSide=next.home-previous.home===1&&next.away===previous.away?'home':
    next.away-previous.away===1&&next.home===previous.home?'away':null;
  if(!goalSide)return [];
  // An ordinary goal or penalty must belong to the team whose total increased.
  const scorerId=goalSide==='home'?row.participants.find(p=>p.meta?.location==='home')?.id:
    row.participants.find(p=>p.meta?.location==='away')?.id;
  if(e.type_id!==15&&e.team_id!==scorerId)return [];
  events.push({minute:e.minute,extra:e.extra_minute||0,player:e.player_name.trim(),
   kind:e.type_id===15?'own_goal':e.type_id===16?'penalty':'goal',home:next.home,away:next.away});
  previous=next;
 }
 return previous.home===final.home&&previous.away===final.away?events:[];
}

async function load({fetcher,token,now,sourceBody,competition='eredivisie'}){
 if(!token||!Object.hasOwn(LEAGUES,competition))throw Error('Sportmonks niet geconfigureerd');
 const year=new Date(now).getUTCMonth()<6?new Date(now).getUTCFullYear()-1:new Date(now).getUTCFullYear();
 const first=Date.UTC(year,6,1),last=Date.UTC(year+1,6,1);
 const all=new Map();
 // The API limits ranges to 100 days and 50 results per page. Limit pages and calls.
 for(let start=first;start<last;start+=99*86400000){
  const end=Math.min(last-86400000,start+98*86400000);
  const day=t=>new Date(t).toISOString().slice(0,10);
  for(let page=1;page<=10;page++){
   const url=new URL('https://api.sportmonks.com/v3/football/fixtures/between/'+day(start)+'/'+day(end));
   url.searchParams.set('api_token',token);
   url.searchParams.set('include','participants;scores;round;events');
   url.searchParams.set('filters','fixtureLeagues:'+LEAGUES[competition]);
   url.searchParams.set('per_page','50');url.searchParams.set('page',String(page));
   let response;
   try{response=await fetcher(url.toString(),{redirect:'error',signal:AbortSignal.timeout(8000)});}
   catch{throw Error('Sportmonks netwerkfout');}
   if(!response.ok){await response.body?.cancel();throw Error('Sportmonks HTTP '+response.status);}
   let data;
   try{data=JSON.parse(await sourceBody(response));}catch{throw Error('Sportmonks antwoord ongeldig');}
   if(!Array.isArray(data.data)||data.data.length>50)throw Error('Sportmonks onvolledige respons');
   for(const row of data.data){const f=parseFixture(row,competition,now);if(all.has(f.id))throw Error('Sportmonks dubbel wedstrijd-ID');all.set(f.id,f);}
   if(!data.pagination||data.pagination.has_more===false)break;
   if(page===10)throw Error('Sportmonks paginering overschrijdt limiet');
  }
 }
 // Reject unexpectedly sparse seasons rather than replacing existing data with a partial standings table.
 if(all.size<100||all.size>500)throw Error('Sportmonks onvolledige seizoensdekking');
 return [...all.values()].sort((a,b)=>a.date.localeCompare(b.date));
}
module.exports={LEAGUES,CREDIT,SOURCE,parseFixture,confirmedGoals,load};
