'use strict';
const normalized=value=>String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/\s+/g,' ').trim();
const escape=value=>value.replace(/[^a-zA-Z0-9 ]/g,'\\$&');
const officialHosts=new Set(['ajax.nl','english.ajax.nl','fctwente.nl','fcgroningen.nl','psv.nl','feyenoord.com','az.nl','eredivisie.nl','peczwolle.nl']);
function officialUrl(value){
 try{const u=new URL(value);return u.protocol==='https:'&&!u.username&&!u.password&&!u.port&&officialHosts.has(u.hostname.replace(/^www\./,''));}catch{return false;}
}
// Official European match reports must match the competition and both teams.
function europeanMatchSource(record,doc){
 try{
  const url=new URL(doc.url);
  const competition={'Champions League':'uefachampionsleague','Europa League':'uefaeuropaleague','Conference League':'uefaconferenceleague'}[record.category];
  if(!competition||url.protocol!=='https:'||url.username||url.password||url.port||
   url.hostname.replace(/^www\./,'')!=='uefa.com'||
   !new RegExp('^/'+competition+'/news/02[a-z0-9-]+/?$').test(url.pathname))return false;
  const title=normalized(doc.title).toLowerCase();
  if(/\b(?:round[ -]?up|preview|predicted|youth|women|academy|u[12]\d|under[ -]?\d+|highlights and)\b/i.test(title))return false;
  const tokens=value=>normalized(value).toLowerCase().replace(/\b(?:fc|cf|afc|sc|ssc|ac)\b/g,'').replace(/[^a-z0-9]+/g,' ').trim();
  const heading=' '+tokens(title)+' ';
  return [record.match.homeTeam,record.match.awayTeam].every(name=>{
   const key=tokens(name);
   return key.length>=3&&heading.includes(' '+key+' ');
  });
 }catch{return false;}
}
function evidence(record,doc,now=Date.now()){
 const european=Boolean(record?.match&&doc&&europeanMatchSource(record,doc));
 if(!record?.match||!doc||(!officialUrl(doc.url)&&!european)||typeof doc.text!=='string'||doc.text.length<120||doc.text.length>20000)return null;
 const time=Date.parse(doc.publishedAt||''),matchTime=Date.parse(record.publishedAt||'');
 // Unknown dates are ordinary rejected evidence, never a fatal DateTimeFormat error.
 if(!Number.isFinite(time)||!Number.isFinite(matchTime))return null;
 const dateOnly=/^\d{4}-\d{2}-\d{2}$/.test(doc.publishedAt||'');
 const sourceDay=new Intl.DateTimeFormat('sv-SE',{timeZone:'Europe/Amsterdam'}).format(new Date(time));
 const matchDay=new Intl.DateTimeFormat('sv-SE',{timeZone:'Europe/Amsterdam'}).format(new Date(matchTime));
 // A date-only first-party publication provides no exact clock time.
 // Accept that exact match day without pretending to know when it was posted.
 if(!Number.isFinite(time)||!Number.isFinite(matchTime)||time>now+300000||
    (dateOnly?sourceDay!==matchDay:time<matchTime-3600000)||
    (dateOnly?now-matchTime>48*3600000:time<now-48*3600000))return null;
 const {homeTeam,awayTeam,homeScore,awayScore}=record.match;
 if(![homeTeam,awayTeam].every(v=>typeof v==='string'&&v.length>=3)||![homeScore,awayScore].every(Number.isInteger))return null;
 const content=normalized(doc.text),heading=normalized(doc.title);
 if(/\b(women|vrouwen|u23|jong ajax|academy|onder 21)\b/i.test(heading))return null;
 const scorePattern=new RegExp(escape(normalized(homeTeam)).replace(/AZ Alkmaar/i,'AZ(?: Alkmaar)?')+'\\s*[-–]\\s*'+escape(normalized(awayTeam))+'\\s+'+homeScore+'\\s*[-–]\\s*'+awayScore+'(?:\\s|\\()','i');
 const header=scorePattern.exec(content);
 if(!header)return null;
 const tail=content.slice(header.index+header[0].length,header.index+header[0].length+1600);
 const pattern=/(?:^|\s)(\d{1,2})(?:\+(\d{1,2}))?\s*[.']\s*([A-Za-zÀ-ž][A-Za-zÀ-ž .()'-]{1,55}?)\s+(\d{1,2})\s*[-–]\s*(\d{1,2})(?=\s|[.,]|$)/g;
 const events=[];
 for(const match of tail.matchAll(pattern)){
  const minute=Number(match[1]),extra=match[2]?Number(match[2]):0;
  const person=match[3].trim(),home=Number(match[4]),away=Number(match[5]);
  if(minute>90||extra>20||person.length<3||person.length>55)return null;
  events.push({minute,extra,person,home,away,raw:match[0].trim()});
  if(events.length>12)return null;
 }
 if(events.length<(european?2:3)||events.length!==homeScore+awayScore)return null;
 let previousHome=0,previousAway=0,previousMinute=0;
 for(const event of events){
  const at=event.minute*100+event.extra;
  if(at<previousMinute||(event.home-previousHome)+(event.away-previousAway)!==1||
    event.home<previousHome||event.away<previousAway)return null;
  previousHome=event.home;previousAway=event.away;previousMinute=at;
 }
 if(previousHome!==homeScore||previousAway!==awayScore)return null;
 if(european){
  const half=(record.verifiedFacts||[]).map(f=>/^Ruststand (\d+)-(\d+)\.$/.exec(f)).find(Boolean);
  const lastFirstHalf=events.filter(e=>e.minute<=45).at(-1);
  if(half&&(Number(half[1])!==(lastFirstHalf?.home||0)||Number(half[2])!==(lastFirstHalf?.away||0)))return null;
 }
 const facts=events.map(e=>'Volgens het officiële wedstrijdverslag veranderde de stand in minuut '+e.minute+(e.extra?'+'+e.extra:'')+' door '+e.person+' naar '+e.home+'-'+e.away+'.');
 return {sourceUrl:doc.url,sourcePublishedAt:doc.publishedAt,events,facts,
  sourceExcerpt:content.slice(Math.max(0,header.index-160),header.index+header[0].length+1600)};
}
// Only positive, explicit descriptions of incidents in a first-party
// verified *match report* can become facts. Generic discipline references,
// future suspensions and speculative penalty discussions do not qualify.
function verifiedDisciplinaryFacts(doc,matchRecord){
 const home=String(matchRecord?.match?.homeTeam||'').toLowerCase();
 const away=String(matchRecord?.match?.awayTeam||'').toLowerCase();
 const body=String(doc?.text||'');
 if(!home||!away||body.length<120||!officialUrl(doc?.url))return [];
 const title=normalized(doc?.title||'').toLowerCase();
 // A club announcement about future bans is not evidence of an incident
 // in the match being reported.
 if(/schorsing|schikkingsvoorstel|voorbeschouwing|vooruitblik|preview|tuchtzaak/i.test(title))return [];
 const lines=body.replace(/\s+/g,' ').split(/(?<=[.!?])\s+(?=[A-ZÀ-Ž])/u);
 const result=[];
 for(const line of lines){
  if(line.length>350||line.length<25||/\b(?:geen|niet|mogelijk|zou|volgende wedstrijd|komende duel|geschorst|beroep)\b/i.test(line))continue;
  const actor='([A-ZÀ-Ž][a-zà-ž]+(?:\\s+(?:van|de|der|den|[A-ZÀ-Ž][a-zà-ž]+)){0,3})';
  const direct=new RegExp('\\b'+actor+'\\s+(?:kreeg|ontving|pakte)\\s+(?:een\\s+)?rode kaart\\b','u').exec(line);
  const second=new RegExp('\\b'+actor+'\\s+(?:kreeg|ontving|pakte)\\s+(?:(?:zijn|haar|de)\\s+)?tweede gele kaart\\b','u').exec(line);
  const matched=direct||second;
  if(!matched)continue;
  const person=matched[1].trim();
  if(person.length<4||person.length>70)continue;
  const kind=direct?'een directe rode kaart':'een tweede gele kaart';
  const fact='Volgens het officiële wedstrijdverslag kreeg '+person+' '+kind+'.';
  if(!result.includes(fact))result.push(fact);
 }
 return result.slice(0,4);
}
function verifiedArbitrationFacts(doc) {
 const body = normalized(doc.text);
 // Require an explicit stoppage of a dangerous attack, an actual video review,
 // and a documented decision. An isolated reference to VAR proves none of these.
 const stopped = /(?:big chance|promising attack)[^.!?]{0,110}(?:blew his whistle|stopped play)[.!?]/i.exec(body);
 if (!stopped) return [];
 const review = body.slice(stopped.index, stopped.index + 650);
 if (!/called (?:over )?to the monitor/i.test(review) ||
     !/did not agree with the VAR[^.!?]{0,150}(?:committed a foul|no penalty)/i.test(review)) return [];
 return ['Volgens het officiële wedstrijdverslag onderbrak de scheidsrechter een kansrijke aanval voor een VAR-beoordeling en gaf hij na het bekijken van de beelden geen strafschop.'];
}
function attach(record,doc,now=Date.now()){
 const verified=evidence(record,doc,now);if(!verified)return null;
 const primaryGoals = record.verifiedFacts.filter(fact => /waarna de stand/.test(fact));
 if (primaryGoals.length && verified.events.some((event, index) => {
  const minute = event.minute + (event.extra ? '+'+event.extra : '');
  return !primaryGoals[index]?.includes('minuut '+minute+' ') ||
   !primaryGoals[index].endsWith('stand '+event.home+'-'+event.away+' was.');
 })) return null;
 const arbitration = officialUrl(doc.url)?verifiedArbitrationFacts(doc):[];
 const cards = verifiedDisciplinaryFacts(doc,record);
 const additional = cards.filter(fact => {
  const key = fact.replace('Volgens het officiële wedstrijdverslag ', '').replace(/\.$/, '');
  return !record.verifiedFacts.some(existing => existing.includes(key));
 });
 return {...record,articleKind:'match_report',verifiedFacts:[...record.verifiedFacts,...(primaryGoals.length ? [] : verified.facts),...additional,...arbitration],
  sources:[...record.sources,{url:verified.sourceUrl}],matchEvidence:{
   url:verified.sourceUrl,publishedAt:verified.sourcePublishedAt,
   text:doc.text,title:doc.title
  }};
}
module.exports={evidence,attach,officialUrl,verifiedDisciplinaryFacts};
