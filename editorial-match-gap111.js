'use strict';
// Publicatiedesk 111A: remove an unverified numerical goal-to-goal gap only
// when two exact, distinct source-receipted goals are identifiable in the
// same sentence. No new event, scorer, score or minute is ever manufactured.
// This is a copyedit only: the normal factual and 85/90 reviews still run.

const GAP=/\b(?:[\p{L}]+|\d+)\s+minut(?:en|e)\s+(?:later|daarna|verder)\b/giu;
const RECEIPT=/\b(?:eigen\s+doelpunt\s+van|benutte\s+strafschop\s+van|doelpunt\s+van)\s+([^,.;]+?)\s*,\s*waarna de stand (\d{1,2})-(\d{1,2})\b/i;
function verifiedGoals(record) {
 if(record?.articleKind!=='match_report'||!Array.isArray(record.verifiedFacts))return [];
 const goals=[];
 for(const fact of record.verifiedFacts){
  if(typeof fact!=='string'||!/^(?:Volgens de Sportmonks-wedstrijdregistratie|Volgens het officiële wedstrijdverslag)/i.test(fact))continue;
  const time=fact.match(/\bminuut\s+(\d{1,3})(?:\+(\d{1,2}))?\b/i);
  const receipt=fact.match(RECEIPT);
  if(!time||!receipt)continue;
  const minute=Number(time[1]),extra=Number(time[2]||0);
  const home=Number(receipt[2]),away=Number(receipt[3]);
  if(minute<1||minute>120||(extra>0&&![45,90,105,120].includes(minute))||
     home+away===0||home>25||away>25)continue;
  const event={minute,extra,player:receipt[1].trim(),home,away};
  if(!event.player||event.player.length>80)continue;
  if(!goals.some(g=>g.minute===minute&&g.extra===extra&&g.player===event.player&&g.home===home&&g.away===away))goals.push(event);
 }
 // Two different sources giving conflicting names or minutes for the same
 // scoreline must never be silently reconciled by a copyedit.
 if(new Set(goals.map(g=>g.home+'-'+g.away)).size!==goals.length)return [];
 return goals;
}
function eventNamedAndScored(text,goal){
 if(!text.toLocaleLowerCase('nl').includes(goal.player.toLocaleLowerCase('nl')))return false;
 return new RegExp('(?<!\\d)'+goal.home+'\\s*[-–‑]\\s*'+goal.away+'(?!\\d)','u').test(text);
}
function repairUnsupportedGoalGap111(draft,record) {
 if(!draft||!Array.isArray(draft.body))return draft;
 const events=verifiedGoals(record);
 if(events.length<2)return draft;
 let changed=false;
 const body=draft.body.map(paragraph=>{
  if(typeof paragraph!=='string'||!GAP.test(paragraph)){GAP.lastIndex=0;return paragraph;}
  GAP.lastIndex=0;
  const sentences=paragraph.split(/(?<=[.!?])\s+/u);
  const revised=sentences.map((sentence,index)=>{
   const next=sentence.replace(GAP,(phrase,offset)=>{
    const before=sentence.slice(0,offset),after=sentence.slice(offset+phrase.length);
    const localPrevious=events.filter(e=>eventNamedAndScored(before,e));
    // A new sentence commonly starts with an unsupported interval. Only
    // look back to the immediately preceding sentence, and only when the
    // current prefix has no identifiable earlier event.
    const previous=localPrevious.length?localPrevious:events.filter(e=>index>0&&eventNamedAndScored(sentences[index-1],e));
    const following=events.filter(e=>eventNamedAndScored(after,e));
    if(previous.length!==1||following.length!==1)return phrase;
    const prior=previous[0],later=following[0];
    if(prior.minute*100+prior.extra>=later.minute*100+later.extra)return phrase;
    changed=true;
    const transition=prior.minute<=45&&later.minute>=46?'na rust':'later';
    return offset===0?transition[0].toUpperCase()+transition.slice(1):transition;
   });
   return next;
  });
  return revised.join(' ');
 });
 return changed?{...draft,body}:draft;
}
module.exports={repairUnsupportedGoalGap111,verifiedGoals};
