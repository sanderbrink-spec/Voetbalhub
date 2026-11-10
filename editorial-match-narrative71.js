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
 let changed=false;
 const body=draft.body.map(paragraph=>{
  if(typeof paragraph!=='string')return paragraph;
  let result=paragraph;
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
  const redundantEnding=/,\s*maar dit was niet genoeg om de achterstand (?:ongedaan te maken|om te buigen)\b/gi;
  if(redundantEnding.test(result)){result=result.replace(redundantEnding,'');changed=true;}
  // The model repeatedly invents an unverified "comeback" label for a
  // registered goal. Remove only that label if the same player, exact minute
  // and scorer's club were independently checked in Sportmonks events.
  result=result.replace(/\bNa de rust kwam ([\p{L} .'-]{2,60}?) terug in de wedstrijd met een doelpunt van ([\p{L} .'-]{3,70}?) (?:in minuut (\d{1,3})|in de (\d{1,3})(?:e|de|ste) minuut)\b/giu,
   (phrase,club,player,a,b)=>{
    const minute=a||b;
    if(!teams.includes(club)||!facts.some(f=>f.includes('minuut '+minute+' ')&&
       f.includes('doelpunt van '+player+',')&&
       f.includes('als doelpuntenmaker aan '+club+'.')))return phrase;
    changed=true;
    return 'Na rust scoorde '+player+' voor '+club+' in minuut '+minute;
   });
  // The 10 November run's final revision added an unsupported 'kept pressing'
  // and 'reduced the deficit' narrative to a fully verified goal. Rewrite only
  // this exact construction when a single Sportmonks receipt proves player,
  // team, minute and resulting score. Otherwise retain it for rejection.
  result=result.replace(/\b([\p{L}'-]+(?:\s+[\p{L}'-]+){0,3}) bleef aandringen en verkleinde de achterstand in de (\d{1,3})(?:e|de|ste) minuut door een doelpunt van ([\p{L}'-]+(?:\s+[\p{L}'-]+){0,6})(?=[.,;]|$)/giu,
   (phrase,team,minute,player)=>{
    if(!teams.includes(team))return phrase;
    const receipt=facts.find(f=>f.includes('minuut '+minute+' een doelpunt van '+player+', waarna de stand ')&&
       f.includes('Sportmonks-participantregistratie koppelt '+player+' als doelpuntenmaker aan '+team+'.'));
    if(!receipt)return phrase;
    const score=receipt.match(/\bwaarna de stand (\d{1,2})-(\d{1,2}) was\b/i);
    if(!score||!known.has(Number(score[1])+'-'+Number(score[2])))return phrase;
    changed=true;
    return player+' scoorde voor '+team+' in minuut '+minute+', waardoor de stand '+Number(score[1])+'-'+Number(score[2])+' werd';
   });
  return result;
 });
 return changed?{...draft,body}:draft;
}
module.exports={repairUnverifiedMatchComeback};
