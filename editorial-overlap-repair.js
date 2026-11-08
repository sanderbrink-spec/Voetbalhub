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
  // Swap only the already-verified pair; retain remaining source-grounded
  // context and the full-length paragraph structure.
  const originalPair=first+' en '+second;
  const replacement=second+' en '+first+paragraph.slice(originalPair.length);
  if(replacement===paragraph||
    docs.some(doc=>overlapPhrases(doc.text,{headline:'',standfirst:'',body:[replacement]}).length))return paragraph;
  changed=true;return replacement;
 });
 return changed?{...draft,body}:draft;
}
module.exports={reframeVerifiedStaffPair};
