'use strict';
const {extractPage}=require('./automatic-publication');
const url='https://www.uefa.com/uefanationsleague/news/02ab-2219b45e1aa6-7834fde41ea1-1000--2026-27-nations-league-quarter-finals-get-to-know-the-eight-/';
(async()=>{
 const r=await fetch(url,{headers:{'User-Agent':'VeldioEditorial/2.0','Accept':'text/html'},signal:AbortSignal.timeout(20000)});
 if(!r.ok)throw Error('UEFA source HTTP '+r.status);
 const html=await r.text();
 const doc=extractPage(html,url,r.headers.get('date'));
 console.log('DOCUMENT',JSON.stringify({htmlChars:html.length,textChars:doc.text.length,publishedAt:doc.publishedAt}));
 for(const [team,marker] of [['Netherlands','How they qualified: Group A2 runners-up'],['Portugal','How they qualified: Group A4 winners']]){
  const indices=[];let cursor=0;
  while((cursor=doc.text.indexOf(marker,cursor))>=0){indices.push(cursor);cursor+=marker.length;}
  const cases=indices.map(at=>{
   const before=doc.text.slice(Math.max(0,at-900),at);
   const words=[...before.matchAll(new RegExp('\\b'+team+'\\b','g'))].map(m=>at-before.length+m.index);
   const closest=words.length?words.at(-1):null;
   const since=closest===null?null:at-closest;
   const relevant=closest===null?'':doc.text.slice(closest,at);
   const priorQualifications=[...relevant.matchAll(/How they qualified:/g)].length;
   return {at,closestTeam:closest,distance:since,priorQualifications,context:doc.text.slice(Math.max(0,at-170),Math.min(doc.text.length,at+65))};
  });
  const rawAt=html.indexOf(marker);
  console.log('MATCH',JSON.stringify({team,markerMatches:cases,rawOccurrence:rawAt,rawNear:rawAt<0?null:html.slice(Math.max(0,rawAt-500),rawAt).replace(/<[^>]*>/g,' ').replace(/\s+/g,' ').slice(-210),headings:doc.text.match(new RegExp(team+'[^.]{0,200}How they qualified:','g'))?.slice(0,2)||[]}));
 }
})().catch(e=>{console.error('DIAGNOSTIC_ERROR '+e.message);process.exitCode=1;});
