'use strict';
const {createHash}=require('node:crypto');
const {FEEDS,parseFeed,isContradiction}=require('./ten-agent-newsroom101');
const types=Object.freeze({official:'officieel bevestigd feit',media:'feitelijk vaststaande mediamelding',
 rumour:'onbevestigd gerucht',conflict:'tegenstrijdig bericht',unsupported:'niet onderbouwde conclusie'});
const normalize=s=>s.normalize('NFKC').toLocaleLowerCase('nl').replace(/[^\p{L}\d]+/gu,' ').trim();
const has=(text,term)=>(' '+normalize(text)+' ').includes(' '+normalize(term)+' ');

async function researchMedia(selection,fetcher,now,audit){
 const feeds=FEEDS.filter(f=>['vi','vp'].includes(f.id));
 const seen=new Map();
 audit.mediaFeeds=[];
 for(const feed of feeds){
  const url=new URL(feed.url);
  if(['psv','ajax'].includes(selection.destination.toLowerCase()))url.searchParams.set('tag',selection.destination.toLowerCase());
  const log={url:url.href,publisher:feed.name,matched:0};
  audit.mediaFeeds.push(log);
  try{
   const response=await fetcher(url.href,{redirect:'error',signal:AbortSignal.timeout(15000),headers:{Accept:'application/rss+xml'}});
   if(!response.ok)throw Error('HTTP '+response.status);
   const xml=await response.text();
   if(!/<rss\b/i.test(xml)||xml.length>1500000)throw Error('Ongeldig RSS-document.');
   const items=parseFeed(xml,feed,now,{research:true});
   for(const item of items){
    if(!item.passage||!has(item.passage,selection.player)||!has(item.passage,selection.destination))continue;
    const {url,title,passage:text,publishedAt,byline,publisherName:publisher}=item;
    seen.set(url,{url,title,text,publishedAt,byline,publisher,kind:'media',feedUrl:log.url,
     mayConflict:isContradiction(text)||/\bontkent|\bgeen (?:enkel )?(?:overleg|gesprek|contact)\b/i.test(text),independenceVerified:false,sha256:createHash('sha256').update(text).digest('hex')});
    log.matched++;
   }
  }catch(e){log.error=e.message;audit.unavailable.push(url.href);}
 }
 return [...seen.values()].sort((a,b)=>Number(b.mayConflict)-Number(a.mayConflict)||b.publishedAt.localeCompare(a.publishedAt)).slice(0,16);
}

function sentences(draft){
 const rows=[];
 const segmenter=new Intl.Segmenter('nl',{granularity:'sentence'});
 for(const [index,part] of [draft.headline,draft.standfirst,...draft.body].entries()){
  for(const {segment} of segmenter.segment(part)){
   const text=segment.trim();
   if(text)rows.push({id:'S'+(rows.length+1),index,text});
  }
 }
 return rows;
}

const confirmation=/\b(?:tekent bij|heeft getekend|transfer is (?:rond|bevestigd)|(?:overstap|komst) (?:is|staat) vast|is (?:definitief )?rond|officialiseert|heeft .* vastgelegd|geen (?:officiële )?bevestiging|niet (?:officieel )?bevestigd door|nergens bevestigd)\b/i;
const transfer=/\b(?:transfer\w*|overstap|gesprek\w*|belangstelling|interesse|onderhandel\w*|bieding|akkoord|geboden|openingsbod|vraagprijs|miljoen|euro)\b/i;
const attribution=/\b(?:volgens|meld\w*|schr(?:ijft|eef)|bericht\w*|rapporte\w*|citeert|aldus|tekent op|leest|signaleert|noemt|beschrijft)\b/i;
const amount=/€\s*[\d.,]+|(?:\d+(?:[.,]\d+)?|[\p{L}]+)(?:\s+(?:en een half|en een halve))?\s+(?:miljoen|miljard|ton|euro)\b/giu;
function hardIssue(text,docs,selection){
 if(/\b(?:onafhankelijke (?:bronnen|meldingen|bevestigingen)|onafhankelijk van elkaar|los van elkaar)\b/i.test(text))return 'Onafhankelijkheid van de oorspronkelijke melders is niet aangetoond.';
 if(confirmation.test(text))return 'Formele transferstatus of algemene afwezigheid van bevestiging valt buiten het onderzochte bewijs.';
 if(!has(text,selection.destination)&&!transfer.test(text))return null;
 const sources=docs.filter(d=>d.kind==='media'&&(has(text,d.publisher)||(d.publisher==='Voetbal International'&&has(text,'VI'))));
 if(!sources.length||!attribution.test(text))return 'Een gedateerde mediamelding vereist toeschrijving in dezelfde zin.';
 if([...text.matchAll(amount)].some(([phrase])=>!sources.some(d=>has(d.text,phrase))))return 'Het genoemde bedrag ontbreekt in de toegeschreven passage.';
 return null;
}

function prune(draft,rows,removed){
 const blocks=[draft.headline,draft.standfirst,...draft.body].map((block,i)=>{
  const subset=rows.filter(r=>r.index===i);
  return subset.some(r=>removed.has(r.id))?subset.filter(r=>!removed.has(r.id)).map(r=>r.text).join(' '):block;
 });
 return {headline:blocks[0],standfirst:blocks[1],body:blocks.slice(2).filter(Boolean)};
}

// The reviewer classifies every supplied sentence, chooses literal evidence IDs
// and scores only the surviving copy. Never accept invented or omitted rows.
function checkReview(rows,review,docs,selection){
 const claims=review.claims,issues=[],removed=new Set(),used=new Set();
 if(!Array.isArray(claims)||claims.length!==rows.length||new Set(claims.map(c=>c?.id)).size!==rows.length)
  return {issues:['Onvolledige onafhankelijke beoordeling per zin.'],removed,used};
 for(const row of rows){
  const claim=claims.find(c=>c?.id===row.id);
  if(!claim||!Object.values(types).includes(claim.type)||typeof claim.supported!=='boolean'){
   issues.push('Ongeldig oordeel voor '+row.id);continue;
  }
  if(!claim.supported||claim.type===types.unsupported){removed.add(row.id);continue;}
  const citations=claim.citations;
  if(!Array.isArray(citations)||!citations.length||citations.some(c=>!Number.isInteger(c?.source)||typeof c.quote!=='string'||c.quote.trim().length<8||!docs[c.source]?.text.includes(c.quote))){
   issues.push('Ontbrekende letterlijke bewijsplaats bij '+row.id);continue;
  }
  const cited=citations.map(c=>docs[c.source]);
  const isMedia=claim.type!==types.official;
  if(isMedia){
   const origin=typeof claim.origin==='string'?claim.origin.trim():'';
   if(!origin||(origin.toLowerCase()!=='onbekend'&&!cited.some(d=>
      has(d.text,origin)||d.publisher===origin||d.byline===origin))){
    issues.push('Oncontroleerbare oorspronkelijke melder bij '+row.id);continue;
   }
   if(origin.toLowerCase()!=='onbekend'&&!has(row.text,origin)&&
      !(origin==='Voetbal International'&&has(row.text,'VI'))){
    issues.push('Oorspronkelijke melder ontbreekt bij '+row.id);continue;
   }
  }
  if(isMedia&&(!cited.some(d=>d.kind==='media')||!attribution.test(row.text))||
     !isMedia&&(!cited.every(d=>d.kind==='register')||transfer.test(row.text)||has(row.text,selection.destination))||
     claim.type===types.conflict&&new Set(cited.filter(d=>d.kind==='media').map(d=>d.url)).size<2||
     hardIssue(row.text,cited.map((d,i)=>({...d,text:citations[i].quote})),selection)){
   issues.push('Claimtype of bronattributie wijkt af bij '+row.id);continue;
  }
  for(const c of citations)used.add(c.source);
 }
 return {issues,removed,used};
}
module.exports={types,researchMedia,sentences,prune,hardIssue,checkReview};
