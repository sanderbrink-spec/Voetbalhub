'use strict';
const DIMENSIONS=['accuracy','freshness','sources','originality','dutch','readability','relevance','headline','image','rights'];
function assess(review,{hardIssues=[],paragraphs=0,factIds=[],context=false}={}){
 const issues=[...hardIssues],scores=review?.scores||{};
 for(const key of DIMENSIONS)if(!Number.isFinite(scores[key])||scores[key]<0||scores[key]>10)issues.push('Ongeldige deelscore: '+key);
 const values=DIMENSIONS.map(k=>scores[k]),score=values.every(Number.isFinite)?values.reduce((a,b)=>a+b,0)/10:0;
 if(review?.approved!==true)issues.push('Tweede feitenredacteur keurt niet goed.');
 if(score<9||values.some(v=>v<8))issues.push('Kwaliteitsdrempel 9/10 of minimale deelscore 8/10 niet gehaald.');
 if(!Array.isArray(review?.issues)||review.issues.length)issues.push('Openstaande reviewbevindingen.');
 if(!Array.isArray(review?.coverage)||review.coverage.length!==paragraphs+2+(context?1:0)||review.coverage.some(row=>!Array.isArray(row)||!row.length||row.some(id=>!factIds.includes(id))))issues.push('Geen geldige feitenkoppeling voor kop, intro, alle alinea’s en eventuele context.');
 return {approved:issues.length===0,score:Math.round(score*100)/100,scores,issues:[...new Set(issues)]};
}
module.exports={DIMENSIONS,assess};
