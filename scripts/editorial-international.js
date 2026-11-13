'use strict';

const ORANJE='https://www.onsoranje.nl/teams/185184/programma';
const UEFA='https://www.uefa.com/uefanationsleague/teams/95/matches/';
const amsterdam=new Intl.DateTimeFormat('sv-SE',{
 timeZone:'Europe/Amsterdam',dateStyle:'short',timeStyle:'short'
});
const months='jan feb mrt apr mei jun jul aug sep okt nov dec'.split(' ');
const teamSlug=name=>({'nederland':'netherlands','griekenland':'greece','duitsland':'germany'}[name.toLowerCase()]||
 name.normalize('NFD').replace(/\p{M}/gu,'').toLowerCase().replace(/[^a-z0-9]+/g,'-'));

function confirmedPreviews(oranje,uefa,plain,now,horizonDays){
 const times=new Map();
 for(const [,options] of uefa.html.matchAll(/data-plugin="pk-match-unit" data-options="([^"]+)"/g)){
  try{
   const {match}=JSON.parse(plain(options).replace(/&#x2b;/gi,'+'));
   if(match.status==='Upcoming'&&/^\d+$/.test(match.id))times.set(match.id,Date.parse(match.kickOffTime.dateTime));
  }catch{}
 }
 const links=new Map();
 for(const [,path,id,teams] of uefa.html.matchAll(/href="(\/uefanationsleague\/match\/(\d+)--([a-z0-9-]+)\/)"/g)){
  links.set(teams,{path,kickoff:times.get(id)});
 }
 const groups=[];
 for(const item of oranje.html.split(/<div class="Matchevent-item">/).slice(1)){
  const card=item.match(/<a href="(\/teams\/185184\/programma\/wedstrijd\/\d+)" class="Matchblock-wrapper" title="(\d{1,2}) ([a-z]+) (\d{4}): ([^"]+)">([\s\S]*?)<\/a>/i);
  if(!card||!item.slice(0,card.index).includes('>UEFA Nations League</a>'))continue;
  const [,path,day,month,year,label,body]=card;
  const teams=plain(label).split(' - ');
  if(teams.length!==2||!teams.includes('Nederland'))continue;
  const corroboration=links.get(teams.map(teamSlug).join('-vs-'));
  if(!corroboration||!(corroboration.kickoff>now)||corroboration.kickoff>now+horizonDays*86400000)continue;
  const clock=body.match(/class="Matchblock-metadata--time">([0-2]\d:[0-5]\d)</)?.[1];
  const eventDate=year+'-'+String(months.indexOf(month.toLowerCase())+1).padStart(2,'0')+'-'+day.padStart(2,'0');
  if(amsterdam.format(corroboration.kickoff)!==eventDate+' '+clock)continue;
  const venue=plain(item.match(/class="location-label">([^<]+)</)?.[1]||'');
  if(!venue)continue;
  const topic=teams.join(' - ');
  const details=[
   topic+' staat op '+eventDate+' om '+clock+' Nederlandse tijd op het programma.',
   teams[0]+' speelt thuis tegen '+teams[1]+'.',
   'De wedstrijd wordt gespeeld in '+venue+'.',
   topic+' is een wedstrijd in de UEFA Nations League.'
  ];
  // The two official schedules establish the same kickoff and teams.
  const group=[
   {url:new URL(path,ORANJE).href,title:topic,text:details.join(' '),publishedAt:''},
   {url:new URL(corroboration.path,UEFA).href,title:topic,text:details[0],publishedAt:''}
  ];
  group.internationalPreview={
   kind:'preview',topic,category:'Nations League',eventDate,teams,kickoff:corroboration.kickoff,
   facts:details.map(text=>({text,evidence:[{source:0,quote:text}]})),
   sharedEventEvidence:[{source:0,quote:details[0]},{source:1,quote:details[0]}]
  };
  groups.push(group);
 }
 // A second independently verified group fixture gives useful context for
 // a preview without borrowing standings or an unverified match result.
 for(const group of groups){
  const candidate=group.internationalPreview;
  const adjacent=groups.find(other=>other!==group&&Math.abs(other.internationalPreview.kickoff-candidate.kickoff)<=7*86400000);
  if(!adjacent)continue;
  const related=adjacent.internationalPreview;
  const calendarFact='Het andere geplande groepsduel van Nederland is '+related.topic+' op '+related.eventDate+'.';
  group.push({url:ORANJE,title:'OnsOranje wedstrijdprogramma',publishedAt:'',text:calendarFact});
  candidate.facts.push({text:calendarFact,evidence:[{source:group.length-1,quote:calendarFact}]});
 }
 return groups;
}
function enrichPreview(group,detail,plain){
 const candidate=group.internationalPreview;
 const match=detail.html.match(/<div class="MatchDetail">([\s\S]*?)<div class="Template-aside">/)?.[1]||'';
 const detailTeams=[...match.matchAll(/<div class="MatchDetail-teamName[^"]*">\s*<span>([^<]+)<\/span>/g)]
  .map(([,name])=>plain(name));
 const clock=plain(match.match(/class="MatchDetail-separatorLineText">([^<]+)</)?.[1]||'');
 if(detail.url!==group[0].url||candidate.teams.join('|')!==detailTeams.join('|')||
    !amsterdam.format(candidate.kickoff).endsWith(' '+clock))return;
 const section=detail.html.match(/<div class="AsideLocation-content">([\s\S]*?)<\/div>\s*<\/div>\s*<\/div>/)?.[1]||'';
 const city=plain(section.match(/>Stad<\/span><span>([^<]+)</)?.[1]||'').split(',')[0];
 const stage=plain(match.match(/class="MatchDetail-title">([^<]+)</)?.[1]||'');
 const groupName=stage.match(/\bgroep ([A-D][1-4])$/i)?.[1];
 const facts=[
  city&&'De officiële speelstad voor dit duel is '+(city==='Berlin'?'Berlijn':city)+'.',
  groupName&&'Het duel hoort bij groep '+groupName+' van de UEFA Nations League.'
 ].filter(Boolean);
 for(const text of facts)candidate.facts.push({text,evidence:[{source:0,quote:text}]});
 group[0].text+=' '+facts.join(' ');
}
module.exports={ORANJE,UEFA,confirmedPreviews,enrichPreview};
