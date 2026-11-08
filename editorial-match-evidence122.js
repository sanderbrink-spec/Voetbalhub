'use strict';
const normalized=value=>String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/\s+/g,' ').trim();
const escape=value=>value.replace(/[^a-zA-Z0-9 ]/g,'\\$&');
const officialHosts=new Set(['ajax.nl','english.ajax.nl','fctwente.nl','fcgroningen.nl','psv.nl','feyenoord.com','az.nl','eredivisie.nl','peczwolle.nl']);
function officialUrl(value){
 try{const u=new URL(value);return u.protocol==='https:'&&!u.username&&!u.password&&!u.port&&officialHosts.has(u.hostname.replace(/^www\./,''));}catch{return false;}
}
function evidence(record,doc,now=Date.now()){
 if(!record?.match||!doc||!officialUrl(doc.url)||typeof doc.text!=='string'||doc.text.length<120||doc.text.length>20000)return null;
 const time=Date.parse(doc.publishedAt||''),matchTime=Date.parse(record.publishedAt||'');
 if(!Number.isFinite(time)||!Number.isFinite(matchTime)||time<matchTime-3600000||time>now+300000||time<now-48*3600000)return null;
 const {homeTeam,awayTeam,homeScore,awayScore}=record.match;
 if(![homeTeam,awayTeam].every(v=>typeof v==='string'&&v.length>=3)||![homeScore,awayScore].every(Number.isInteger))return null;
 const content=normalized(doc.text),heading=normalized(doc.title);
 if(/\b(women|vrouwen|u23|jong ajax|academy|onder 21)\b/i.test(heading))return null;
 const scorePattern=new RegExp(escape(normalized(homeTeam))+'\\s*[-–]\\s*'+escape(normalized(awayTeam))+'\\s+'+homeScore+'\\s*[-–]\\s*'+awayScore+'(?:\\s|\\()','i');
 const header=scorePattern.exec(content);
 if(!header)return null;
 const tail=content.slice(header.index+header[0].length,header.index+header[0].length+1600);
 const pattern=/(?:^|\s)(\d{1,2})(?:\+(\d{1,2}))?\s*[.']\s*([A-Za-zÀ-ž][A-Za-zÀ-ž .'-]{1,55}?)\s+(\d{1,2})\s*[-–]\s*(\d{1,2})(?=\s|$)/g;
 const events=[];
 for(const match of tail.matchAll(pattern)){
  const minute=Number(match[1]),extra=match[2]?Number(match[2]):0;
  const person=match[3].trim(),home=Number(match[4]),away=Number(match[5]);
  if(minute>90||extra>20||person.length<3||person.length>55)return null;
  events.push({minute,extra,person,home,away,raw:match[0].trim()});
  if(events.length>12)return null;
 }
 if(events.length<3||events.length!==homeScore+awayScore)return null;
 let previousHome=0,previousAway=0,previousMinute=0;
 for(const event of events){
  const at=event.minute*100+event.extra;
  if(at<previousMinute||(event.home-previousHome)+(event.away-previousAway)!==1||
    event.home<previousHome||event.away<previousAway)return null;
  previousHome=event.home;previousAway=event.away;previousMinute=at;
 }
 if(previousHome!==homeScore||previousAway!==awayScore)return null;
 const facts=events.map(e=>'Volgens het officiële wedstrijdverslag veranderde de stand in minuut '+e.minute+(e.extra?'+'+e.extra:'')+' door '+e.person+' naar '+e.home+'-'+e.away+'.');
 return {sourceUrl:doc.url,sourcePublishedAt:doc.publishedAt,events,facts,
  sourceExcerpt:content.slice(header.index,header.index+header[0].length+1600)};
}
function attach(record,doc,now=Date.now()){
 const verified=evidence(record,doc,now);if(!verified)return null;
 return {...record,articleKind:'match_report',verifiedFacts:[...record.verifiedFacts,...verified.facts],
  sources:[...record.sources,{url:verified.sourceUrl}],matchEvidence:{
   url:verified.sourceUrl,publishedAt:verified.sourcePublishedAt,
   text:verified.sourceExcerpt,title:doc.title
  }};
}
module.exports={evidence,attach,officialUrl};
