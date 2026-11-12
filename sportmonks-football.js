'use strict';
// Sportmonks is the first-choice football provider only for leagues explicitly configured here.
// Never log the token, API URL with token, or raw provider errors.
// The Eredivisie is league 72; 271 is Denmark's Superliga. Verify against provider catalog.
const LEAGUES={eredivisie:72};
const CREDIT='Sportmonks Football API';
const EVENT_PARSER_REVISION=138;
const SOURCE={name:CREDIT,eventParserRevision:EVENT_PARSER_REVISION,url:'https://www.sportmonks.com/football-api/',license:'Sportmonks subscription; commercial display rights subject to contract',commercial:null,cost:'trial/subscription',refreshMinutes:15,databaseDownload:null};
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
  ...(status==='FT'?{resultExpiresAt:now+36*3600000,goalTimeline:confirmedGoals(row,goals),incidents:confirmedIncidents(row,home.id,away.id),eventCoverage:Array.isArray(row.events)&&row.events.length<=150?'sportmonks':'unavailable',matchEvents:verifiedMatchEvents(row,home.id,away.id,goals)}:{})};
}
// Sportmonks v3 event types: missed penalty, direct red and second yellow.
const decisiveEventTypes = {17:'missed_penalty',20:'red_card',21:'second_yellow'};
function confirmedIncidents(row, homeId, awayId) {
 if (!Array.isArray(row.events) || row.events.length > 150) return [];
 const unique = new Map();
 for (const event of row.events) {
  const kind = decisiveEventTypes[event?.type_id];
  if (!kind) continue;
  const {minute, extra_minute: extra = 0, player_name: name, participant_id, team_id} = event;
  const teamId = participant_id ?? team_id;
  const added = extra ?? 0;
  if ((participant_id != null && team_id != null && participant_id !== team_id) ||
      ![homeId, awayId].includes(teamId) || !Number.isInteger(minute) || minute < 1 || minute > 130 ||
      !Number.isInteger(added) || added < 0 || added > 30 ||
      typeof name !== 'string' || !/^[\p{L} .'’\-]{3,75}$/u.test(name.trim())) continue;
  const player = name.trim();
  unique.set(JSON.stringify([kind, minute, added, player, teamId]), {kind, minute, extra:added, player});
 }
 return [...unique.values()].sort((a,b) => a.minute-b.minute || a.extra-b.extra);
}
// Do not turn unverified or incomplete live events into newspaper facts.
function confirmedGoals(row,final){
 const total=final.home+final.away;
 if(!Number.isInteger(total)||total<1||total>15||!Array.isArray(row.events)||row.events.length>150)return [];
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
  // Sportmonks API v3 reports the event's team as participant_id.
  // Legacy fixtures may have team_id instead. A contradiction invalidates
  // the complete chronology, rather than silently attributing the goal.
  if(e.participant_id!=null&&e.team_id!=null&&e.participant_id!==e.team_id)return [];
  const eventTeam=e.participant_id??e.team_id;
  if(e.type_id!==15&&eventTeam!==scorerId)return [];
  // For own goals, the event belongs to the conceding player/team, not the
  // side that gained a goal. A known same-side attribution is inconsistent.
  if(e.type_id===15&&eventTeam===scorerId)return [];
  events.push({minute:e.minute,extra:e.extra_minute||0,player:e.player_name.trim(),
   kind:e.type_id===15?'own_goal':e.type_id===16?'penalty':'goal',
   // A club claim is authorized only for an ordinary/penalty goal whose
   // participant_id was checked against the actual increased score side.
   scorerSide:e.type_id===15?null:goalSide,home:next.home,away:next.away});
  previous=next;
 }
 return previous.home===final.home&&previous.away===final.away?events:[];
}


/** Strict incident display: same subscribed events include, no extra API calls. */
function verifiedMatchEvents(row,homeId,awayId,final){
 if(!Array.isArray(row.events)||row.events.length>150||!final||
   !Number.isInteger(final.home)||!Number.isInteger(final.away))return [];
 const goals=confirmedGoals(row,final);
 const rawGoals=row.events.filter(e=>[14,15,16].includes(e?.type_id)).sort((a,b)=>a.sort_order-b.sort_order);
 const result=[];
 // Only publish scorer identities if the complete goal sequence matches the final score.
 if(goals.length===final.home+final.away&&goals.length===rawGoals.length){
  for(let i=0;i<goals.length;i++){
   const g=goals[i],source=rawGoals[i],teamId=source.participant_id??source.team_id;
   result.push({kind:g.kind,minute:g.minute,extra:g.extra,sortOrder:source.sort_order,
    side:g.kind==='own_goal'?(teamId===homeId?'home':'away'):g.scorerSide,
    player:g.player,score:String(g.home)+' – '+String(g.away)});
  }
 }
 const kinds={18:'substitution',19:'yellow_card',20:'red_card',21:'second_yellow',83:'red_card'};
 const isName=x=>typeof x==='string'&&x.trim().length>=2&&x.trim().length<=90&&
   /^[\p{L}\p{M} .'\u2019-]+$/u.test(x.trim());
 const seen=new Set();
 for(const e of row.events){
  const kind=kinds[e?.type_id];
  if(!kind||e.rescinded===true)continue;
  if(e.participant_id!=null&&e.team_id!=null&&e.participant_id!==e.team_id)continue;
  const teamId=e.participant_id??e.team_id;
  if(teamId!==homeId&&teamId!==awayId)continue;
  const minute=e.minute,extra=e.extra_minute??0,sortOrder=e.sort_order;
  if(!Number.isInteger(minute)||minute<1||minute>130||!Number.isInteger(extra)||extra<0||
     extra>30||!Number.isInteger(sortOrder)||sortOrder<0||!isName(e.player_name))continue;
  if(kind==='substitution'&&!isName(e.related_player_name))continue;
  const id=Number.isSafeInteger(e.id)?'id:'+e.id:JSON.stringify([sortOrder,kind,minute,extra,teamId,e.player_name,e.related_player_name]);
  if(seen.has(id))continue;
  seen.add(id);
  result.push({kind,minute,extra,sortOrder,side:teamId===homeId?'home':'away',
   player:e.player_name.trim(),...(kind==='substitution'?{relatedPlayer:e.related_player_name.trim()}:{})});
 }
 return result.sort((a,b)=>a.sortOrder-b.sortOrder||a.minute-b.minute||a.extra-b.extra).slice(0,100);
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
module.exports={EVENT_PARSER_REVISION,LEAGUES,CREDIT,SOURCE,parseFixture,confirmedGoals,verifiedMatchEvents,load};
