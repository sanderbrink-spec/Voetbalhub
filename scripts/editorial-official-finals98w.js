'use strict';

// Only literal, independently matching results on two official domains create
// a final. This is evidence intake, not an approval or publication shortcut.
const KNVB_RESULTS='https://www.onsoranje.nl/teams/185184/uitslagen';
const DFB_RESULTS='https://datencenter.dfb.de/teams/deutschland/seasonplan';
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

// The general newsroom parser deliberately caps extracted article text to
// 14,000 characters and may pick the first <article>. Those rules are suitable
// for stories but not two full official results indexes. Read the full bounded
// HTML fetched by officialPage instead. Never execute scripts or accept a
// result from any other URL.
function htmlText(value){
 return tidy(String(value||'')
  .replace(/<(script|style|noscript|svg|nav|header|footer|form)\b[^>]*>[\s\S]*?<\/\1>/gi,' ')
  .replace(/<[^>]*>/g,' ')
  .replace(/&nbsp;|&#160;/gi,' ').replace(/&amp;/gi,'&')
  .replace(/&ndash;/gi,'–').replace(/&mdash;/gi,'—')
  .replace(/&#(\d+);/g,(_,num)=>Number(num)<=0x10ffff?String.fromCodePoint(Number(num)):' ')
 );
}
const fullOfficialText=doc=>typeof doc?.html==='string'&&doc.html
 ?htmlText(doc.html):tidy(doc?.text);
const english=value=>countries.find(pair=>tidy(pair[0]).toLowerCase()===tidy(value).toLowerCase())?.[1];
const dutch=value=>countries.find(pair=>tidy(pair[0]).toLowerCase()===tidy(value).toLowerCase())?.[0];
const dayValid=(year,month,day)=>{
 if(!(year>=2020&&year<=2100&&month>=1&&month<=12&&day>=1&&day<=31))return false;
 const d=new Date(Date.UTC(year,month-1,day));
 return d.getUTCFullYear()===year&&d.getUTCMonth()===month-1&&d.getUTCDate()===day;
};
function officialRecentFinals(knvb,uefa,reports,now=Date.now()){
 if(knvb?.url!==KNVB_RESULTS||![UEFA_RESULTS,DFB_RESULTS].includes(uefa?.url))return [];
 const knvbText=fullOfficialText(knvb),uefaText=fullOfficialText(uefa);
 if(!/UEFA Nations League/i.test(knvbText)||!/UEFA Nations League/i.test(uefaText))return [];
 const leagueSeason=/\b(20\d{2})\/(?:20)?\d{2}\b/.exec(uefaText);
 const isUefa=uefa.url===UEFA_RESULTS;
 if(isUefa&&!leagueSeason)return [];
 const names=countries.map(pair=>tidy(pair[0])).join('|');
 const pattern=new RegExp('\\b('+names+')\\s+(\\d{1,2})\\s+('+months.join('|')+')\\s+(20\\d{2})\\s+(\\d{1,2})\\s*[-–]\\s*(\\d{1,2})\\s+('+names+')\\b','giu');
 const available=[],seen=new Set();
 for(const row of knvbText.matchAll(pattern)){
  const home=dutch(row[1]),away=dutch(row[7]);
  if(!home||!away||(home==='Nederland')===(away==='Nederland'))continue;
  if(!/UEFA Nations League/i.test(knvbText.slice(Math.max(0,row.index-260),row.index)))continue;
  const month=months.indexOf(row[3].toLowerCase())+1;
  const day=Number(row[2]),year=Number(row[4]),hs=Number(row[5]),as=Number(row[6]);
  if(!dayValid(year,month,day)||(isUefa&&year!==Number(leagueSeason[1]))||hs>25||as>25)continue;
  const date=year+'-'+String(month).padStart(2,'0')+'-'+String(day).padStart(2,'0');
  // Dates without a kickoff time are not sufficient evidence on matchday.
  const end=Date.parse(date+'T23:59:59Z');
  if(end>now||now-end>48*3600000)continue;
  const homeEn=english(home),awayEn=english(away);
  const dateTag=String(day).padStart(2,'0')+'/'+String(month).padStart(2,'0');
  let confirmed;
  if(isUefa){
   const uefaPattern='\\b'+dateTag.replace('/','\\/')+'\\s*:\\s*'+homeEn+'\\s+'+hs+'[-–]'+as+'\\s+'+awayEn+'\\b';
   confirmed=new RegExp(uefaPattern,'iu').exec(uefaText);
  }else{
   // DFB's own men's schedule provides an independently registered home/away
   // score and date. Do not transform or invent a score from a news headline.
   const de={Nederland:'Niederlande',Duitsland:'Deutschland'};
   if(!de[home]||!de[away])continue;
   const dateDe=String(day).padStart(2,'0')+'\\.'+String(month).padStart(2,'0')+'\\.'+year;
   const patternDe='\\b(?:Montag|Dienstag|Mittwoch|Donnerstag|Freitag|Samstag|Sonntag),\\s*'+dateDe+
    '\\s+\\d{2}:\\d{2}\\s+Uhr\\s+'+de[home]+'\\s+'+hs+'\\s*:\\s*'+as+'\\s+'+de[away]+'\\b';
   confirmed=new RegExp(patternDe,'iu').exec(uefaText);
   if(confirmed&&!/UEFA Nations League Div\. A/i.test(uefaText.slice(Math.max(0,confirmed.index-260),confirmed.index)))
    confirmed=null;
  }
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
   // 98Y: preserve more of the *actual* match evidence rather than asking
   // the writer to inflate four generic source sentences into three paragraphs.
   // A cited incident is not inferred from the final score, and older match
   // anecdotes are never selected as current timeline evidence.
   const picked=[],used=new Set();
   const safeSentence=s=>s&&!/\b(?:vorig seizoen|vorige ontmoeting|destijds|historische wedstrijd uit)\b/i.test(s);
   const add=s=>{
    if(!safeSentence(s))return;
    const key=tidy(s).toLowerCase();
    if(!used.has(key)){picked.push(s);used.add(key);}
   };
   const stakes=sentences.filter(s=>/\b(?:groep|kwartfinal|geplaatst|groepswinnaar)\b/i.test(s))
    .sort((a,b)=>Number(/\b(?:groep a[1-4]|tweede plaats|groepswinnaar)\b/i.test(b))-
     Number(/\b(?:groep a[1-4]|tweede plaats|groepswinnaar)\b/i.test(a))||
     Number(/\bfoto:/i.test(a))-Number(/\bfoto:/i.test(b)))[0];
   add(stakes);
   add(sentences.find(s=>/\b(?:eerste helft|voor rust|rust in|ruststand)\b/i.test(s)));
   add(sentences.find(s=>/\b(?:tweede helft|na rust|na de pauze)\b/i.test(s)));
   // Add explicit minute-bearing events from both halves. These events come
   // verbatim from the current KNVB article; no elapsed minute is calculated.
   const incidentMinutes=sentences.map((s,i)=>{
    const m=/\b(?:in|rond)\s+de\s+(\d{1,3})(?:e|ste)\s+minuut\b/i.exec(s);
    return {s,i,minute:m?Number(m[1]):null};
   }).filter(item=>Number.isInteger(item.minute)&&item.minute>=1&&item.minute<=120&&safeSentence(item.s));
   for(const phase of [0,1]){
    for(const {s,i} of incidentMinutes.filter(item=>phase===0?item.minute<=45:item.minute>45).slice(0,3)){
     // Retain immediate outcome of a chance, but only when the next source
     // sentence explicitly completes that same incident.
     const next=sentences[i+1]||'';
     const completion=/^(?:Een kansrijke positie|De kans|Hij|Zij|Maar)\b/i.test(next)&&
      s.length+next.length<500?s+' '+next:s;
     add(completion);
    }
   }
   // If the article reports an event without an explicit minute, it may serve
   // as a fourth separate fact but never as proof for a particular match minute.
   if(picked.length<3){
    add(sentences.find(s=>/\b(?:doelpunt|treffer|scoorde)\b/i.test(s)&&
     !/\b(?:vorige ontmoeting|afgelopen vrijdag)\b/i.test(s)));
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
    facts:[fact,...picked.slice(0,8).map(text=>({text,evidence:[{source:0,quote:text}]}))]};
   const key=[date,home,away,article.url].join(':');
   if(seen.has(key))continue;
   seen.add(key);
   // Preserve exact source excerpts used by the evidence gate. These are
   // substrings of the current raw official pages, not reconstructed claims.
   const knvbEvidence={url:knvb.url,title:knvb.title||'',publishedAt:knvb.publishedAt||'',
    text:knvbText.slice(Math.max(0,row.index-260),row.index+row[0].length+80)};
   const uefaEvidence={url:uefa.url,title:uefa.title||'',publishedAt:uefa.publishedAt||'',
    text:uefaText.slice(Math.max(0,confirmed.index-90),confirmed.index+confirmed[0].length+80)};
   available.push({candidate,documents:[article,knvbEvidence,uefaEvidence],
    proof:{knvbResultsUrl:KNVB_RESULTS,
     ...(isUefa?{uefaResultsUrl:UEFA_RESULTS}:{dfbResultsUrl:DFB_RESULTS}),
     sourceNewsUrl:article.url,match}});
  }
 }
 return available;
}
module.exports={KNVB_RESULTS,UEFA_RESULTS,DFB_RESULTS,officialRecentFinals};
