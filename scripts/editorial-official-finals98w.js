'use strict';

// Only literal, independently matching results on two official domains create
// a final. This is evidence intake, not an approval or publication shortcut.
const KNVB_RESULTS='https://www.onsoranje.nl/teams/185184/uitslagen';
const UEFA_RESULTS=require('./editorial-international').UEFA_RESULTS;
const countries=[
 ['Nederland','Netherlands'],['Duitsland','Germany'],['Griekenland','Greece'],
 ['Servië','Serbia'],['België','Belgium'],['Frankrijk','France'],
 ['Italië','Italy'],['Spanje','Spain'],['Portugal','Portugal'],
 ['Denemarken','Denmark'],['Noorwegen','Norway'],['Turkije','Türkiye'],
 ['Engeland','England'],['Kroatië','Croatia'],['Wales','Wales']
];
const months=['jan','feb','mrt','apr','mei','jun','jul','aug','sep','okt','nov','dec'];
const tidy=value=>String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/\s+/g,' ').trim();
const english=value=>countries.find(pair=>tidy(pair[0]).toLowerCase()===tidy(value).toLowerCase())?.[1];
const dutch=value=>countries.find(pair=>tidy(pair[0]).toLowerCase()===tidy(value).toLowerCase())?.[0];
const dayValid=(year,month,day)=>{
 if(!(year>=2020&&year<=2100&&month>=1&&month<=12&&day>=1&&day<=31))return false;
 const d=new Date(Date.UTC(year,month-1,day));
 return d.getUTCFullYear()===year&&d.getUTCMonth()===month-1&&d.getUTCDate()===day;
};
function officialRecentFinals(knvb,uefa,reports,now=Date.now()){
 if(knvb?.url!==KNVB_RESULTS||uefa?.url!==UEFA_RESULTS||
   typeof knvb.text!=='string'||typeof uefa.text!=='string'||
   !/UEFA Nations League/i.test(knvb.text)||!/UEFA Nations League/i.test(uefa.text))return [];
 const knvbText=tidy(knvb.text),uefaText=tidy(uefa.text);
 const leagueSeason=/\b(20\d{2})\/(?:20)?\d{2}\b/.exec(uefaText);
 if(!leagueSeason)return [];
 const names=countries.map(pair=>tidy(pair[0])).join('|');
 const pattern=new RegExp('\\b('+names+')\\s+(\\d{1,2})\\s+('+months.join('|')+')\\s+(20\\d{2})\\s+(\\d{1,2})\\s*[-–]\\s*(\\d{1,2})\\s+('+names+')\\b','giu');
 const available=[],seen=new Set();
 for(const row of knvbText.matchAll(pattern)){
  const home=dutch(row[1]),away=dutch(row[7]);
  if(!home||!away||(home==='Nederland')===(away==='Nederland'))continue;
  if(!/UEFA Nations League/i.test(knvbText.slice(Math.max(0,row.index-260),row.index)))continue;
  const month=months.indexOf(row[3].toLowerCase())+1;
  const day=Number(row[2]),year=Number(row[4]),hs=Number(row[5]),as=Number(row[6]);
  if(!dayValid(year,month,day)||year!==Number(leagueSeason[1])||hs>25||as>25)continue;
  const date=year+'-'+String(month).padStart(2,'0')+'-'+String(day).padStart(2,'0');
  // Dates without a kickoff time are not sufficient evidence on matchday.
  const end=Date.parse(date+'T23:59:59Z');
  if(end>now||now-end>48*3600000)continue;
  const homeEn=english(home),awayEn=english(away);
  const dateTag=String(day).padStart(2,'0')+'/'+String(month).padStart(2,'0');
  const uefaPattern='\\b'+dateTag.replace('/','\\/')+':\\s*'+homeEn+'\\s+'+hs+'[-–]'+as+'\\s+'+awayEn+'\\b';
  const confirmed=new RegExp(uefaPattern,'iu').exec(uefaText);
  if(!confirmed)continue;
  const score=hs+'-'+as;
  const homeAway=home+' – '+away;
  const scoreQuote=row[0],otherQuote=confirmed[0];
  for(const article of reports||[]){
   if(!/^https:\/\/www\.onsoranje\.nl\/nieuws\/nederlands-elftal-mannen\/\d+\//.test(article?.url||'')||
      /\b(vrouwen|jeugd|onder 1\d|onder 2\d)\b/i.test(article?.title||''))continue;
   const published=Date.parse(article?.publishedAt||'');
   if(!Number.isFinite(published)||published>now+300000||now-published>72*3600000)continue;
   const body=tidy(article.text);
   const lead=tidy(article.title+' '+body.slice(0,1100)).toLowerCase();
   const opponent=(home==='Nederland'?away:home).toLowerCase();
   if(!new RegExp('\\b'+hs+'\\s*[-–]\\s*'+as+'\\b').test(body.slice(0,1100))||
      !lead.includes(tidy(opponent).toLowerCase())||
      !(lead.includes('oranje')||lead.includes('nederland')))continue;
   const sentences=(body.slice(0,11000).match(/[^.!?]{36,340}[.!?]/gu)||[]).map(x=>x.trim());
   // Narrative plan: stakes, before the break, after the break, a concrete
   // match incident. Do not copy unrelated historical scorelines.
   const roles=[
    /\b(?:groep|kwartfinal|geplaatst|groepswinnaar)\b/i,
    /\b(?:eerste helft|voor rust|rust in|ruststand)\b/i,
    /\b(?:tweede helft|na rust|na de pauze)\b/i,
    /\b(?:in de \d{1,2}e minuut|doelpunt|treffer|scoorde)\b/i
   ];
   const picked=[],used=new Set();
   for(const role of roles){
    const line=sentences.find(s=>role.test(s)&&
     !/\b\d{1,2}\s*[-–]\s*\d{1,2}\b/.test(s)&&
     !used.has(tidy(s).toLowerCase()));
    if(line){picked.push(line);used.add(tidy(line).toLowerCase());}
   }
   if(picked.length<3)continue;
   const match={homeTeam:home,awayTeam:away,homeScore:hs,awayScore:as,playedAt:date};
   const fact={
    text:homeAway+' eindigde op '+date+' in '+score+' in de UEFA Nations League.',
    evidence:[{source:1,quote:scoreQuote},{source:2,quote:otherQuote}]
   };
   const candidate={kind:'announcement',topic:article.title,category:'Nations League',
    teams:[home,away],eventDate:date,match,verifiedOfficialFinal:true,
    sharedEventEvidence:[{source:1,quote:scoreQuote},{source:2,quote:otherQuote}],
    facts:[fact,...picked.slice(0,4).map(text=>({text,evidence:[{source:0,quote:text}]}))]};
   const key=[date,home,away,article.url].join(':');
   if(seen.has(key))continue;
   seen.add(key);
   available.push({candidate,documents:[article,knvb,uefa],
    proof:{knvbResultsUrl:KNVB_RESULTS,uefaResultsUrl:UEFA_RESULTS,
     sourceNewsUrl:article.url,match}});
  }
 }
 return available;
}
module.exports={KNVB_RESULTS,UEFA_RESULTS,officialRecentFinals};
