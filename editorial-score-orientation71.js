'use strict';

// Veldio preserves the official home-away orientation in every scoreline.
// Models sometimes render a correct away victory from the winner's point of
// view (3-2) instead of the registered home-away score (2-3). Correct only an
// *exact reversed* score which is itself absent from verifiedFacts.
// Every factual and independent review gate remains mandatory afterwards.
const SCORE=/(?<![\d-])\b(\d{1,2})\s*[-–]\s*(\d{1,2})\b(?![-–]\d)/g;
const normalized=(a,b)=>Number(a)+'-'+Number(b);
function repairReversedVerifiedScores(draft,record){
 if(!draft||typeof draft.headline!=='string'||typeof draft.standfirst!=='string'||
    !Array.isArray(draft.body)||!record?.matchId||
    !['match_report','score_update'].includes(record.articleKind)||
    !Array.isArray(record.verifiedFacts)||record.verifiedFacts.length<2)return draft;
 const facts=record.verifiedFacts.join(' ');
 const supported=new Set([...facts.matchAll(SCORE)].map(m=>normalized(m[1],m[2])));
 const final=record.match;
 const finalScore=normalized(final?.homeScore,final?.awayScore);
 const certifiedResult=String(record.verifiedFacts[0]||'');
 const finalReceipt=new RegExp('\\beindigde\\s+in\\s+'+final?.homeScore+'\\s*[-–]\\s*'+final?.awayScore+'\\b','i');
 if(!supported.has(finalScore)||!Number.isInteger(final?.homeScore)||!Number.isInteger(final?.awayScore)||
    !finalReceipt.test(certifiedResult))
  return draft;
 const flipped=new Map();
 for(const score of supported){
  const [h,a]=score.split('-');
  if(h===a)continue;
  const reverse=normalized(a,h);
  if(!supported.has(reverse))flipped.set(reverse,score);
 }
 if(!flipped.size)return draft;
 const correct=part=>typeof part==='string'?part.replace(SCORE,(whole,a,b)=>flipped.get(normalized(a,b))||whole):part;
 const headline=correct(draft.headline),standfirst=correct(draft.standfirst),body=draft.body.map(correct);
 if(headline===draft.headline&&standfirst===draft.standfirst&&
    body.every((part,i)=>part===draft.body[i]))return draft;
 return {...draft,headline,standfirst,body};
}
module.exports={repairReversedVerifiedScores};
