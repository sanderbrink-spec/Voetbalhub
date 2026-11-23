'use strict';
// Fase 112F: remove unsupported narrative glue only. Source receipts and
// independent factual/chronological/85-90 review remain unchanged.
const {verifiedGoals}=require('./editorial-match-gap111');
const relativeAtStart=/^(?:één|een|twee|drie|vier|vijf|zes|zeven|acht|negen|tien|\d{1,2})\s+minut(?:en|e)\s+(?:later|daarna|verder),?\s+/iu;
// A numerical gap is still unsupported even if it happens to equal two
// verified timestamps: only the actual goal times are facts from the feed.
const numericalGap=/\b(?:één|een|twee|drie|vier|vijf|zes|zeven|acht|negen|tien|\d{1,2})\s+minut(?:en|e)\s+(?:later|daarna|verder)\b/giu;
const escape=s=>s.replace(/[.*+?^$()|[\]{}\\]/g,'\\$&');
function eventInSentence(sentence,goal){
 const normalize=s=>String(s).normalize('NFC').replace(/\s+/gu,' ').toLocaleLowerCase('nl');
 const t=normalize(sentence),player=normalize(goal.player);
 if(!t.includes(player))return false;
 const score=new RegExp('(?<!\\d)'+goal.home+'\\s*[-–‑]\\s*'+goal.away+'(?!\\d)','u');
 const moment=new RegExp('\\b(?:minuut\\s+'+goal.minute+'(?:\\+'+goal.extra+')?|'+goal.minute+'(?:e|de|ste)\\s+minuut)\\b','iu');
 return score.test(t)||moment.test(t);
}
function soleRegisteredGoal(sentence,goals){
 const hits=goals.filter(g=>eventInSentence(sentence,g));
 return hits.length===1?hits[0]:null;
}
// Identify the named scorers in a clause only if the original goal receipts
// contain a UNIQUE occurrence of each scorer. A player who scored twice is
// ambiguous here unless a separate exact event check resolves it.
function namedScoringEvents(text,goals){
 if(!/\b(?:scoor\w*|doelpunt\w*|treffer\w*|maakte|gelijk\w*|voorsprong|opende|winnende)\b/iu.test(text))return [];
 // An explicit score in the clause must match a sourced event and player.
 // Never scrub an unsupported result (e.g. 8-4) while removing an interval.
 const statedScores=[...text.matchAll(/(?<!\d)(\d{1,2})\s*[-–‑]\s*(\d{1,2})(?!\d)/gu)]
  .map(m=>Number(m[1])+'-'+Number(m[2]));
 if(statedScores.some(score=>!goals.some(g=>g.home+'-'+g.away===score&&
    text.toLocaleLowerCase('nl').includes(g.player.toLocaleLowerCase('nl')))))return [];
 const events=[];
 for(const goal of goals){
  if(goals.filter(g=>g.player===goal.player).length!==1)continue;
  const pattern=new RegExp('(?<![\\p{L}])'+escape(goal.player).replace(/\s+/g,'\\s+')+'(?![\\p{L}])','giu');
  const matches=[...text.matchAll(pattern)];
  if(matches.length!==1)continue;
  events.push({event:goal,index:matches[0].index});
 }
 return events.sort((a,b)=>a.index-b.index);
}
function strictlyIncreasing(events){
 return events.every((hit,i)=>i===0||
  events[i-1].event.minute*100+events[i-1].event.extra<hit.event.minute*100+hit.event.extra);
}
function registeredCards(facts){
 const names=[];
 for(const fact of facts){
  if(typeof fact!=='string')continue;
  const m=/\bkreeg\s+([\p{L}.'’\-\s]+?)\s+(?:een|zijn|haar|de)\s+tweede\s+gele\s+kaart\b/iu.exec(fact);
  if(m&&m[1].trim().split(/\s+/).length>=2&&m[1].trim().length<=80)
   names.push(m[1].trim());
 }
 return [...new Set(names)];
}
function repairProofBoundMatchLanguage112F(draft,record){
 if(!draft||!Array.isArray(draft.body)||record?.articleKind!=='match_report'||
  !Array.isArray(record.verifiedFacts)||!record.match)return draft;
 const goals=verifiedGoals(record),facts=record.verifiedFacts;
 const teams=[record.match.homeTeam,record.match.awayTeam].filter(x=>typeof x==='string'&&x.length>2);
 const cards=registeredCards(facts);
 let changed=false;
 const body=draft.body.map(paragraph=>{
  if(typeof paragraph!=='string')return paragraph;
  const sentences=paragraph.split(/(?<=[.!?])\s+/u);
  const fixed=sentences.map((sentence,index)=>{
   let text=sentence;
   if(index>0&&goals.length>=2&&relativeAtStart.test(text)){
    const first=soleRegisteredGoal(sentences[index-1],goals);
    const second=soleRegisteredGoal(text,goals);
    if(first&&second&&first!==second&&
       first.minute*100+first.extra<second.minute*100+second.extra){
     text=text.replace(relativeAtStart,'Daarna ');
     changed=true;
    }
   }
   // An exact, verified goal sequence allows removing an unsupported
   // numerical interval in the SAME sentence or at the next sentence start.
   // Never add a time, scorer or score. Unclear or repeated scorers fail closed.
   if(goals.length>=2){
    numericalGap.lastIndex=0;
    text=text.replace(numericalGap,(term,at)=>{
     const preceding=text.slice(0,at);
     const following=text.slice(at+term.length);
     const from=preceding.trim()?namedScoringEvents(preceding,goals):
      index>0?namedScoringEvents(sentences[index-1],goals):[];
     const to=namedScoringEvents(following,goals);
     if(!from.length||to.length!==1||!strictlyIncreasing(from))return term;
     const previous=from[from.length-1].event,next=to[0].event;
     if(previous.minute*100+previous.extra>=next.minute*100+next.extra)return term;
     changed=true;
     const word=previous.minute<=45&&next.minute>45?'na rust':'daarna';
     return term[0]===term[0].toLocaleUpperCase('nl')?
      word[0].toLocaleUpperCase('nl')+word.slice(1):word;
    });
    numericalGap.lastIndex=0;
   }
   // A source-proven card recipient may lose an unverified club attribution.
   // No team affiliation, card minute or player identity is ever invented.
   for(const name of cards){
    const namePattern=escape(name).replace(/\s+/g,'\\s+');
    for(const team of teams){
     const teamPattern=escape(team).replace(/\s+/g,'\\s+');
     // The pre-112G pattern missed "kreeg in de 78e minuut zijn tweede
     // gele kaart". Remove ONLY an unproved club attribution; the exact
     // numeric card minute remains for independent factual review.
     const cardMinute='(?:\\s+in\\s+(?:de\\s+)?\\d{1,3}(?:e|de|ste)?\\s+minuut)?';
     const card='\\s+(?:een|zijn|haar|de)\\s+tweede\\s+gele\\s+kaart\\b';
     const afterVerb=new RegExp('(\\bkreeg\\s+)('+namePattern+')\\s+van\\s+'+teamPattern+'(?='+cardMinute+card+')','giu');
     const beforeVerb=new RegExp('\\b('+namePattern+')\\s+van\\s+'+teamPattern+'(?=\\s+kreeg'+cardMinute+card+')','giu');
     const next=text.replace(afterVerb,'$1$2').replace(beforeVerb,'$1');
     if(next!==text){text=next;changed=true;}
    }
   }
   return text;
  });
  return fixed.join(' ');
 });
 return changed?{...draft,body}:draft;
}
module.exports={eventInSentence,registeredCards,repairProofBoundMatchLanguage112F};
