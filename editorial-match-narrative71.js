'use strict';
// Limited, source-bound language cleanup before the full independent editorial
// review. Never invent a score or remove a registered scorer or goal.
const SCORE=/(?<![\d-])\b(\d{1,2})\s*[-–]\s*(\d{1,2})\b(?![-–]\d)/g;
const MINUTE=/\bminuut\s+(\d{1,3})(?:\+\d{1,2})?\b/gi;
function repairUnverifiedMatchComeback(draft,record){
 if(!draft||typeof draft.headline!=='string'||!Array.isArray(draft.body)||
    !record?.matchId||!['match_report','score_update'].includes(record.articleKind)||
    !Array.isArray(record.verifiedFacts)||!record.match)return draft;
 const facts=record.verifiedFacts.filter(f=>typeof f==='string');
 // An explicit independently verified comeback is a separate editorial fact.
 if(facts.some(f=>/\b(?:achterstand|comeback|terugknok\w*|sterk terug)\b/i.test(f)))return draft;
 const teams=[record.match.homeTeam,record.match.awayTeam].filter(Boolean);
 if(teams.length!==2)return draft;
 const evidence=facts.join(' ');
 const known=new Set([...evidence.matchAll(SCORE)].map(m=>Number(m[1])+'-'+Number(m[2])));
 const minutes=new Set([...evidence.matchAll(MINUTE)].map(m=>Number(m[1])));
 let changed=false;
 const scrub=part=>{
  if(typeof part!=='string')return part;
  let result=part;
  for(const team of teams){
   // A stock interpretive sentence adds no verified football event.
   const lead='Na de rust kwam '+team+' sterk terug.';
   if(result.startsWith(lead)){result=result.slice(lead.length).trimStart();}
   const redundant=', waarmee '+team+' de achterstand verkleinde';
   if(result.includes(redundant))result=result.split(redundant).join('');
  }
  // Delete only a tail clause falsely claiming an unspecified comeback,
  // keeping the registered goal and full scoreline before the comma.
  result=result.replace(/,\s*maar dit was niet genoeg om de achterstand ongedaan te maken(?=[.!?]|$)/gi,'');
  // A documented score may replace a subjective deficit description.
  result=result.replace(/,\s*waarmee de achterstand werd verkleind tot\s+(\d{1,2})\s*[-–]\s*(\d{1,2})\b/gi,
   (whole,h,a)=>{
    const score=Number(h)+'-'+Number(a);
    return known.has(score)?', waarna de stand '+score+' was':whole;
   });
  result=result.replace(/\bde achterstand te verkleinen tot\s+(\d{1,2})\s*[-–]\s*(\d{1,2})\b/gi,
   (phrase,h,a)=>{
    const score=Number(h)+'-'+Number(a);
    return known.has(score)?'de stand op '+score+' te brengen':phrase;
   });
  // A calculated interval is not a sourced event. Keep the verified minute.
  result=result.replace(/\b(?:\d+|een|twee|drie|vier|vijf|zes|zeven|acht|negen|tien)\s+minuten?\s+(?:later|daarna),\s+in\s+de\s+(\d{1,3})(?:e|de|ste)\s+minuut\b/giu,
   (phrase,m)=>minutes.has(Number(m))?'In de '+m+'e minuut':phrase);
  if(result!==part)changed=true;
  return result;
 };
 // A malformed model headline can carry an unsupported invented "deficit".
 // Remove only its trailing unsupported clause, retaining an intact real headline.
 let headline=draft.headline;
 const trailing=/\s+na\s+[^.!?]{0,70}\b(\d{1,2})\s*[-–]\s*(\d{1,2})\s+achterstand\s*$/i;
 const m=trailing.exec(headline);
 if(m&&known.has(Number(m[1])+'-'+Number(m[2]))){
  const candidate=headline.slice(0,m.index).trim();
  if(candidate.split(/\s+/).length>=5){headline=candidate;changed=true;}
 }
 const standfirst=scrub(draft.standfirst);
 const body=draft.body.map(scrub);
 return changed?{...draft,headline,standfirst,body}:draft;
}
module.exports={repairUnverifiedMatchComeback};
