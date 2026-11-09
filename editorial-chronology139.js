'use strict';

// A stoppage-time minute 45+3 belongs to the first half; minute 47 to the second.
// Relative interval claims spanning that break must never be calculated.
const relativeInterval=/\b(?:een|twee|drie|vier|vijf|zes|zeven|acht|negen|tien|\d+)\s+minut(?:en|e)\s+(?:later|daarna|verder)\b/iu;
const firstHalf=/\b(?:blessuretijd\s+(?:van\s+)?(?:de\s+)?eerste\s+helft|eerste\s+helft|voor\s+rust)\b/iu;
const secondHalf=/\b(?:na\s+(?:de\s+)?rust|na\s+(?:de\s+)?pauze|tweede\s+helft|na\s+de\s+hervatting)\b/iu;
const factsFrom=record=>Array.isArray(record?.verifiedFacts)?record.verifiedFacts.filter(x=>typeof x==='string'):[];
function halfTimeNarrativeIssues(record={},draft={}) {
 if(record.articleKind!=='match_report')return [];
 const facts=factsFrom(record);
 const rest=facts.some(x=>/\bRuststand\s+\d{1,2}-\d{1,2}\b/i.test(x));
 const events=facts.flatMap(f=>{
   const m=f.match(/\bminuut\s+(\d{1,3})(?:\+(\d{1,2}))?\b/i);
   const n=f.match(/(?:eigen\s+doelpunt\s+van|benutte\s+strafschop\s+van|doelpunt\s+van)\s+([^,.;]+?)\s*,\s*waarna/i);
   return m&&n?[{minute:Number(m[1]),extra:Number(m[2]||0),player:n[1].trim()}]:[];
 });
 if(!rest||!events.some(e=>e.minute===45&&e.extra>0)||!events.some(e=>e.minute>=46&&e.minute<=90))return [];
 const paragraphs=[draft.standfirst,...(Array.isArray(draft.body)?draft.body:[])].filter(x=>typeof x==='string');
 const issues=[];
 if(paragraphs.some(p=>relativeInterval.test(p)))
   issues.push('Niet-geverifieerd tijdsverschil tussen doelpunten. Reken nooit blessuretijd door over de rust.');
 for(const sentence of paragraphs.join(' ').split(/(?<=[.!?])\s+/u)){
   if(!firstHalf.test(sentence)||secondHalf.test(sentence))continue;
   if(events.some(e=>e.minute>=46&&e.minute<=90&&sentence.toLocaleLowerCase('nl').includes(e.player.toLocaleLowerCase('nl'))))
     issues.push('Een doelpunt na rust wordt zonder rustovergang als onderdeel van de eerste helft beschreven.');
 }
 return [...new Set(issues)];
}

// One narrowly scoped, evidence-locked display correction for the reported
// already-published article. Original Redis record remains intact for audit.
function correctConfirmedPublishedArticle(article={}) {
 if(article.status!=='published'||article.match?.playedAt!=='2026-11-08'||
    !/heerenveen/i.test(article.match?.homeTeam||'')||!/feyenoord/i.test(article.match?.awayTeam||'')||
    article.match?.homeScore!==5||article.match?.awayScore!==3)return article;
 const facts=factsFrom(article);
 if(!facts.some(f=>/\bminuut\s+45\+3\b/i.test(f)&&/Willemsen/i.test(f)&&/1-2\b/.test(f))||
    !facts.some(f=>/\bminuut\s+47\b/i.test(f)&&/Smans/i.test(f)&&/2-2\b/.test(f))||
    !facts.some(f=>/\bRuststand\s+1-2\b/i.test(f))||!Array.isArray(article.body))return article;
 let changed=false;
 const body=article.body.map(p=>{
   if(typeof p!=='string')return p;
   const fixed=p.replace(/(in\s+blessuretijd\s+van\s+de\s+eerste\s+helft\s+bracht\s+Maas\s+Willemsen[^.!?]{0,120}?\b1-2),\s*en\s+twee\s+minuten\s+later\s+maakte\s+Levi\s+Smans\s+gelijk\s+op\s+2-2\./iu,
    '$1. Na rust, in de 47e minuut, maakte Levi Smans gelijk op 2-2.');
   if(fixed!==p)changed=true;
   return fixed;
 });
 return changed?{...article,body,correctionNote:'Chronologie rond rust gecorrigeerd aan de hand van geverifieerde minuten.'}:article;
}
module.exports={halfTimeNarrativeIssues,correctConfirmedPublishedArticle};
