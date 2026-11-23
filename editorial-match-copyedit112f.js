'use strict';
// Fase 112F: remove unsupported narrative glue only. Source receipts and
// independent factual/chronological/85-90 review remain unchanged.
const {verifiedGoals}=require('./editorial-match-gap111');
const relativeAtStart=/^(?:één|een|twee|drie|vier|vijf|zes|zeven|acht|negen|tien|\d{1,2})\s+minut(?:en|e)\s+(?:later|daarna|verder),?\s+/iu;
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
   // A source-proven card recipient may lose an unverified club attribution.
   // No team affiliation, card minute or player identity is ever invented.
   for(const name of cards){
    const namePattern=escape(name).replace(/\s+/g,'\\s+');
    for(const team of teams){
     const teamPattern=escape(team).replace(/\s+/g,'\\s+');
     const afterVerb=new RegExp('(\\bkreeg\\s+)('+namePattern+')\\s+van\\s+'+teamPattern+'(?=\\s+(?:een|zijn|haar|de)\\s+tweede\\s+gele\\s+kaart\\b)','giu');
     const beforeVerb=new RegExp('\\b('+namePattern+')\\s+van\\s+'+teamPattern+'(?=\\s+kreeg\\s+(?:een|zijn|haar|de)\\s+tweede\\s+gele\\s+kaart\\b)','giu');
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
