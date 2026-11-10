'use strict';
// Remove only unsupported generic "comeback" language while preserving every
// verified goal, scorer and scoreboard receipt. This is a preflight cleanup,
// not a waiver of the independent factual or 85/90 editorial review.
const SCORE=/(?<![\d-])\b(\d{1,2})\s*[-–]\s*(\d{1,2})\b(?![-–]\d)/g;
function repairUnverifiedMatchComeback(draft,record){
 if(!draft||!Array.isArray(draft.body)||!record?.matchId||
    !['match_report','score_update'].includes(record.articleKind)||
    !Array.isArray(record.verifiedFacts)||!record.match)return draft;
 const facts=record.verifiedFacts.filter(f=>typeof f==='string');
 if(facts.some(f=>/\b(?:achterstand|comeback|terugknok\w*|sterk terug)\b/i.test(f)))return draft;
 const teams=[record.match.homeTeam,record.match.awayTeam].filter(Boolean);
 if(teams.length!==2)return draft;
 const known=new Set([...facts.join(' ').matchAll(SCORE)].map(m=>Number(m[1])+'-'+Number(m[2])));
 // A goal attribution may be rewritten only if the same official receipt proves
 // the scorer, minute AND club. A score by itself does not prove a comeback.
 const verifiedGoal=(player,team,minute)=>facts.some(f=>
  f.includes('minuut '+minute+' een doelpunt van '+player+', waarna')&&
  f.includes('Sportmonks-participantregistratie koppelt '+player+' als doelpuntenmaker aan '+team));
 let changed=false;
 const body=draft.body.map(paragraph=>{
  if(typeof paragraph!=='string')return paragraph;
  let result=paragraph;
  // Remove the unsourced interpretation, never the underlying scored goal.
  // This exact pattern was observed in the 10 November production rejection.
  result=result.replace(/\bNa de rust kwam (.+?) terug in de wedstrijd met een doelpunt van (.+?) in (?:de )?(\d{1,3})(?:e|de|ste)? minuut/giu,
   (phrase,team,player,minute)=>{
    if(!teams.includes(team)||!verifiedGoal(player,team,minute))return phrase;
    changed=true;
    return 'Na de rust scoorde '+player+' in minuut '+minute+' voor '+team;
   });
  for(const team of teams){
   const lead='Na de rust kwam '+team+' sterk terug.';
   if(result.startsWith(lead)){result=result.slice(lead.length).trimStart();changed=true;}
   const redundant=', waarmee '+team+' de achterstand verkleinde';
   if(result.includes(redundant)){result=result.split(redundant).join('');changed=true;}
  }
  result=result.replace(/\bde achterstand te verkleinen tot\s+(\d{1,2})\s*[-–]\s*(\d{1,2})\b/gi,
   (phrase,h,a)=>{
    const value=Number(h)+'-'+Number(a);
    if(!known.has(value))return phrase;
    changed=true;
    return 'de '+value+' te maken';
   });
  // A verified score (1-2) substantiates the scoreline, not the unquoted
  // evaluation that the opposition "came back". Preserve the scorer's action.
  result=result.replace(/\bwaarmee de achterstand werd verkleind tot\s+(\d{1,2})\s*[-–]\s*(\d{1,2})\b/gi,
   (phrase,h,a)=>{
    const score=Number(h)+'-'+Number(a);
    if(!known.has(score))return phrase;
    changed=true;
    return 'waardoor de stand '+score+' werd';
   });
  const redundantEnding=/,\s*maar dit was niet genoeg om de achterstand ongedaan te maken\b/gi;
  if(redundantEnding.test(result)){result=result.replace(redundantEnding,'');changed=true;}
  // An invented numerical "margin" and generic defeat explanation are not
  // evidence in verifiedFacts. Drop these clauses instead of inventing a lead.
  const unsourcedMargin=/,\s*die de marge(?:\s+weer)?\s+op\s+(?:een|twee|drie|vier|\d+)\s+bracht\b/giu;
  const unsourcedDeficit=/,\s*maar dit was niet genoeg om de achterstand (?:om te buigen|weg te werken|ongedaan te maken)\b/giu;
  if(unsourcedMargin.test(result)){result=result.replace(unsourcedMargin,'');changed=true;}
  if(unsourcedDeficit.test(result)){result=result.replace(unsourcedDeficit,'');changed=true;}
  return result;
 });
 return changed?{...draft,body}:draft;
}
module.exports={repairUnverifiedMatchComeback};
