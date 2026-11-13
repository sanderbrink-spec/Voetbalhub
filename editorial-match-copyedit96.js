'use strict';

// One-time, conservative corrections of already published match copy.
// No new facts or AI text are generated. Articles needing a substantial
// journalistic rewrite are left unchanged for editorial review.
const {draftIssues,matchSourceStyleIssues}=require('./editorial-desk-model');
const {audit}=require('./editorial-facts');
const {halfTimeNarrativeIssues}=require('./editorial-chronology139');
const {headlineContradictions}=require('./editorial-quality');
const VERSION='96';

// Only remove complete supplier-verification sentences without match facts.
const emptySourceSentence=[
 /^(?:Dit|Dat)\s+blijk(?:t|en)\s+uit\s+(?:de\s+)?(?:offici[eë]le\s+)?(?:Sports?monks[- ]?)?wedstrijdregistratie(?:\s+van\s+Sports?monks)?\.$/i,
 /^(?:Beide|Deze|Alle|De genoemde)\s+doelpunten\s+(?:werden|zijn)\s+(?:bevestigd|geregistreerd)\s+(?:door|volgens)\s+(?:de\s+)?Sports?monks[- ]wedstrijdregistratie(?:\s+en\s+gekoppeld\s+aan\s+de\s+genoemde\s+spelers)?\.$/i,
 /^(?:Deze|De genoemde)\s+doelpunten\s+zijn\s+geregistreerd\s+volgens\s+de\s+Sports?monks[- ]wedstrijdregistratie\.$/i,
 /^(?:Dit|Dat)\s+wordt\s+bevestigd\s+door\s+(?:de\s+)?(?:offici[eë]le\s+)?(?:Sports?monks[- ]?)?wedstrijdregistratie\.$/i
];
const attributionPrefix=/^Volgens\s+(?:de\s+)?(?:(?:offici[eë]le\s+)?Sports?monks[- ]wedstrijdregistratie|(?:offici[eë]le\s+)?wedstrijdregistratie\s+van\s+Sports?monks)\s*,?\s+/i;
function polishParagraph(paragraph){
 const original=String(paragraph||'').trim();
 if(!original)return original;
 const sentences=original.split(/(?<=[.!?])\s+(?=[\p{Lu}])/u);
 const kept=[];
 for(let sentence of sentences){
  sentence=sentence.trim();
  if(emptySourceSentence.some(pattern=>pattern.test(sentence)))continue;
  if(attributionPrefix.test(sentence)){
   sentence=sentence.replace(attributionPrefix,'');
   if(/^viel\s+in\s+minuut\s+(\d{1,3}(?:\+\d{1,2})?)\s+/i.test(sentence))
    sentence=sentence.replace(/^viel\s+in\s+minuut\s+(\d{1,3}(?:\+\d{1,2})?)\s+/i,
     (_,minute)=>'In minuut '+minute+' viel ');
   else sentence=sentence[0]?.toUpperCase()+sentence.slice(1);
  }
  kept.push(sentence);
 }
 return kept.join(' ').replace(/\s{2,}/g,' ').trim();
}
function isMatch(article){
 return ['match_report','score_update'].includes(article?.articleKind) &&
  typeof article?.matchId==='string' &&
  /^(?:sm-\d+|of-nl-\d{4}-[a-z0-9-]+|fd-cl-\d+)$/i.test(article.matchId);
}
function reviewReason(article){
 if(!isMatch(article)||article.status!=='published'||!Array.isArray(article.body))return 'not_match';
 const d={headline:article.headline,standfirst:article.standfirst,body:article.body.map(polishParagraph)};
 if(d.body.some(x=>!x))return 'empty_paragraph';
 if(d.body.every((x,i)=>x===article.body[i]))return 'unsupported_source_pattern';
 const facts=Array.isArray(article.verifiedFacts)?article.verifiedFacts:[];
 if(facts.length<2)return 'insufficient_verified_facts';
 if(!article.match?.homeTeam||!article.match?.awayTeam)return 'missing_match_identity';
 const compact=article.articleKind==='score_update'||article.compactVerified===true;
 if(draftIssues(d,compact).length)return 'structure_quality';
 if(matchSourceStyleIssues({articleKind:article.articleKind,draft:d}).length)return 'remaining_source_narration';
 if(headlineContradictions(d))return 'headline_conflict';
 const payload={...article,draft:d,factChecks:{resultVerified:true,namesVerified:true,dateVerified:true,timelineVerified:true}};
 if(audit(payload).length)return 'factual_quality';
 if(halfTimeNarrativeIssues(payload,d).length)return 'chronology';
 return 'ready';
}
function candidate(article){
 if(!isMatch(article)||article.status!=='published'||!Array.isArray(article.body))return null;
 const d={headline:article.headline,standfirst:article.standfirst,body:article.body.map(polishParagraph)};
 if(d.body.some(x=>!x)||d.body.every((x,i)=>x===article.body[i]))return null;
 const facts=Array.isArray(article.verifiedFacts)?article.verifiedFacts:[];
 if(facts.length<2||!article.match?.homeTeam||!article.match?.awayTeam)return null;
 const compact=article.articleKind==='score_update'||article.compactVerified===true;
 if(draftIssues(d,compact).length)return null;
 if(matchSourceStyleIssues({articleKind:article.articleKind,draft:d}).length)return null;
 if(headlineContradictions(d))return null;
 const payload={...article,draft:d,factChecks:{resultVerified:true,namesVerified:true,dateVerified:true,timelineVerified:true}};
 if(audit(payload).length||halfTimeNarrativeIssues(payload,d).length)return null;
 return {...article,body:d.body,updatedAt:new Date().toISOString(),
  correctionNote:'Redactionele tekstcorrectie: technische bronverwijzingen uit het wedstrijdverslag verwijderd; oorspronkelijke versie gearchiveerd.',
  editorialCopyeditVersion:VERSION};
}
const atomicRevision=[
 "if redis.call('GET', KEYS[1]) ~= ARGV[1] or redis.call('EXISTS', KEYS[2]) == 1 then return 0 end",
 "redis.call('MSET', KEYS[2], ARGV[1], KEYS[1], ARGV[2])",
 "return 1"
].join('\n');
async function apply(client,logger=console){
 const keys=await client.keys('article:*');
 if(keys.length>2000)throw Error('ARTICLE_ARCHIVE_REVIEW_REQUIRED');
 let examined=0,detected=0,updated=0,reviewRequired=0;
 for(let offset=0;offset<keys.length;offset+=64){
  const batch=keys.slice(offset,offset+64),records=await client.mGet(batch);
  if(!Array.isArray(records)||records.length!==batch.length)throw Error('ARTICLE_STORAGE_INCOMPLETE');
  for(let i=0;i<batch.length;i++){
   const raw=records[i];if(!raw)continue;
   let old;try{old=JSON.parse(raw)}catch{continue}
   if(!isMatch(old)||old.status!=='published')continue;
   examined++;
   if(!matchSourceStyleIssues({articleKind:old.articleKind,draft:old}).length)continue;
   detected++;
   const next=candidate(old);
   if(!next){reviewRequired++;logger.warn('Match copyedit '+VERSION+' held: '+JSON.stringify({matchId:old.matchId,articleId:old.id,reason:reviewReason(old)}));continue}
   const key=batch[i],history='article-copyedit:'+VERSION+':'+old.id;
   const wrote=await client.eval(atomicRevision,{keys:[key,history],arguments:[raw,JSON.stringify(next)]});
   if(wrote===1||wrote==='1')updated++;
  }
 }
 logger.info('Match copyedit '+VERSION+': '+JSON.stringify({examined,detected,updated,reviewRequired}));
 return {examined,detected,updated,reviewRequired};
}
module.exports={polishParagraph,candidate,isMatch,reviewReason,apply,VERSION};
