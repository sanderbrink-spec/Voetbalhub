'use strict';
// Source-faithful rephrasing for a verified pair of returning assistants.
// All ordinary factual, originality and independent editorial checks remain mandatory.
function reframeVerifiedStaffPair(draft,facts,docs,overlapPhrases){
 if(!draft||!Array.isArray(draft.body)||!Array.isArray(facts)||!Array.isArray(docs)||typeof overlapPhrases!=='function')return draft;
 const name='[A-ZÀ-Ý][a-zà-ÿ]+(?:\\s+(?:van|de|der|den|ten|ter))*\\s+[A-ZÀ-Ý][a-zà-ÿ]+';
 const pair=new RegExp('^('+name+')\\s+en\\s+('+name+'),\\s+die\\s+.+?,\\s+.+','u');
 let changed=false;
 const body=draft.body.map(paragraph=>{
  if(typeof paragraph!=='string'||!docs.some(doc=>overlapPhrases(doc.text,{headline:'',standfirst:'',body:[paragraph]}).length))return paragraph;
  const m=paragraph.match(pair);
  if(!m)return paragraph;
  const [,first,second]=m;
  const verified=facts.some(f=>String(f).includes(first)&&String(f).includes(second)&&
   /\bassistent/i.test(f)&&/\b(?:terug|hervat|weer)\b/i.test(f));
  if(!verified)return paragraph;
  // Reorder the two verified names, but preserve the remaining full-length
  // paragraph: deleting context made an otherwise valid article too short.
  const prefix=first+' en '+second;
  const replacement=second+' en '+first+paragraph.slice(prefix.length);
  if(replacement===paragraph||
    docs.some(doc=>overlapPhrases(doc.text,{headline:'',standfirst:'',body:[replacement]}).length))return paragraph;
  changed=true;return replacement;
 });
 return changed?{...draft,body}:draft;
}
module.exports={reframeVerifiedStaffPair};


// Safe deterministic normalizations using only facts already validated as literal
// official source evidence. Full independent quality checks remain mandatory.
function reframeVerifiedClubDecision(draft,facts,docs,overlapPhrases){
 if(!draft||!Array.isArray(draft.body)||!Array.isArray(facts)||!Array.isArray(docs)||
    typeof overlapPhrases!=='function')return draft;
 const overlaps=d=>docs.reduce((sum,doc)=>sum+overlapPhrases(doc.text,d).length,0);
 const before=overlaps(draft);
 if(!before)return draft;
 const escape=value=>value.replace(/[.*+?^$()|[\]\\]/g,'\\$&').replace(/[{}]/g,'\\$&');
 const name='[A-ZÀ-Ý][a-zà-ÿ]+(?:\\s+(?:van|de|der|den|ten|ter))*\\s+[A-ZÀ-Ý][a-zà-ÿ]+';
 let candidate={...draft,body:[...draft.body]},changed=false;
 for(const fact of facts){
  const text=String(fact||'');
  const appointment=text.match(/^([A-ZÀ-Ý][\p{L} .-]{1,45}?) heeft ([A-ZÀ-Ý][\p{L} .-]{2,55}?) als nieuwe (hoofdtrainer|trainer|coach) aangesteld[.!]?$/u);
  if(appointment){
   const [,club,person,role]=appointment;
   const source=appointment[0].replace(/[.!]$/,'');
   const target=person+' is benoemd tot '+role+' van '+club;
   const rule=new RegExp(escape(source),'gi');
   const changedIntro=candidate.standfirst?.replace(rule,target);
   const changedBody=candidate.body.map(x=>x.replace(rule,target));
   if(changedIntro!==candidate.standfirst||changedBody.some((x,i)=>x!==candidate.body[i])){
    candidate={...candidate,standfirst:changedIntro,body:changedBody};changed=true;
   }
  }
  const sourcePair=text.match(new RegExp('^('+name+')\\s+en\\s+('+name+'),\\s+die\\s+.+?\\b(?:keren|gaan)\\s+(?:weer\\s+)?terug\\b.+?assistent','u'));
  if(sourcePair){
   const [,first,second]=sourcePair;
   const rule=new RegExp(escape(first)+'\\s+en\\s+'+escape(second),'g');
   const body=candidate.body.map(x=>x.replace(rule,second+' en '+first));
   if(body.some((x,i)=>x!==candidate.body[i])){candidate={...candidate,body};changed=true;}
  }
 }
 return changed&&overlaps(candidate)<before?candidate:draft;
}
module.exports.reframeVerifiedClubDecision=reframeVerifiedClubDecision;
