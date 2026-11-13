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
 return groups;
}
module.exports={ORANJE,UEFA,confirmedPreviews};
