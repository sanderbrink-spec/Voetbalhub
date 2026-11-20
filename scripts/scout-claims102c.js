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
const attribution=/\b(?:volgens|meld\w*|ontkent|ontkracht|schr(?:ijft|eef)|bericht\w*|rapporte\w*|citeert|aldus|tekent op|leest|signaleert|noemt|beschrijft)\b/i;
const agreement=/\b(?:akkoord (?:hebben |heeft |is |zijn )?bereikt|persoonlijk akkoord|deal (?:is )?rond|contract (?:is )?getekend|handtekening gezet|contract gesloten|transfer afgerond)\b/i;
const amount=/€\s*[\d.,]+|(?:\d+(?:[.,]\d+)?|[\p{L}]+)(?:\s+(?:en een half|en een halve))?\s+(?:miljoen|miljard|ton|euro)\b/giu;
function hardIssue(text,docs,selection){
 if(/\b(?:onafhankelijke (?:bronnen|meldingen|bevestigingen)|onafhankelijk van elkaar|los van elkaar)\b/i.test(text))return 'Onafhankelijkheid van de oorspronkelijke melders is niet aangetoond.';
 if(confirmation.test(text))return 'Formele transferstatus of algemene afwezigheid van bevestiging valt buiten het onderzochte bewijs.';
 if(agreement.test(text)&&(!/\b(?:zou|zouden|mogelijk|naar verluidt)\b/i.test(text)||
   !docs.some(d=>d.kind==='media'&&/\b(?:akkoord|deal|contract|handtekening)\b/i.test(d.text))))
  return 'Een transferakkoord is niet vastgesteld; alleen een expliciet toegeschreven mogelijk mediabericht kan worden beschreven.';
 if(/\bgeen (?:ondertekende overeenkomst|(?:getekend|ondertekend) (?:akkoord|contract))\b/i.test(text))
  return 'Een ontbrekende handtekening volgt niet uit berichtgeving over de vraagprijs.';
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

function prepareRevision(draft,docs,selection){
 // A parenthetical access date is not part of a statistic in an undated register.
 const clean=part=>part.replace(/\s*\(UEFA,\s*\d{1,2}\s+(?:jan|feb|mrt|apr|mei|jun|jul|aug|sep|okt|nov|dec)[\p{L}.]*\s+\d{4}\)/giu,'');
 const copy={headline:clean(draft.headline),standfirst:clean(draft.standfirst),body:draft.body.map(clean)};
 const rows=sentences(copy);
 const removed=rows.map(r=>({...r,reason:hardIssue(r.text,docs,selection)})).filter(r=>r.reason);
 return {removed,beforeReview:prune(copy,rows,new Set(removed.map(r=>r.id)))};
}

// A non-conflicting bid and a denial of a meeting are different statements,
// not contradictory evidence about the same act. Require matching act types.
function activityTags(text){
 const words=normalize(text), tags=new Set();
 if(/\b(?:bod|bieding|geboden|biedt|offer)\b/.test(words))tags.add('offer');
 if(/\b(?:gesprek|gesprekken|contact|onderhandeling|onderhandelingen|overleg|gesproken)\b/.test(words))tags.add('talks');
 if(/\b(?:interesse|belangstelling|geinteresseerd)\b/.test(words))tags.add('interest');
 if(/\b(?:akkoord|contract|handtekening)\b/.test(words))tags.add('agreement');
 return tags;
}
function verifiedConflict(docs){
 const media=docs.filter(d=>d.kind==='media');
 return media.some(a=>isContradiction(a.text)&&media.some(b=>b.url!==a.url&&!isContradiction(b.text)&&
  [...activityTags(a.text)].some(tag=>activityTags(b.text).has(tag))));
}
function verifiedRegisterCounts(text,quotes){
 const raw=quotes.join(' ');
 const sourceNumbers=new Set([...raw.matchAll(/\b\d+\b/g)].map(m=>Number(m[0])));
 const numberWords={een:1,eén:1,één:1,twee:2,drie:3,vier:4,vijf:5,zes:6,zeven:7,acht:8,negen:9,tien:10};
 const claims=[...text.matchAll(/(?<![\p{L}\d])(\d+|één|eén|een|twee|drie|vier|vijf|zes|zeven|acht|negen|tien)\s+(?:wedstrijden|duels|minuten|assists?|doelpunten)\b/giu)];
 return claims.every(m=>sourceNumbers.has(/^\d+$/.test(m[1])?Number(m[1]):numberWords[m[1].toLocaleLowerCase('nl')]));
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
   // A reviewer can return both links in the chain. Verify the outlet against
   // the cited document, then check the original reporter against its text.
   const chain=typeof claim.origin==='string'?claim.origin.trim().split(/\s+via\s+/i):[];
   const [origin,outlet]=chain;
   if(chain.length>2||(outlet&&!cited.some(d=>has(d.publisher,outlet)))){
    issues.push('Oncontroleerbare doorplaatsing bij '+row.id);continue;
   }
   if(!origin||(origin.toLowerCase()!=='onbekend'&&!cited.some(d=>
      has(d.text,origin)||d.publisher===origin||d.byline===origin))){
    issues.push('Oncontroleerbare oorspronkelijke melder bij '+row.id);continue;
   }
   if(origin.toLowerCase()!=='onbekend'&&!has(row.text,origin)&&
      !(origin==='Voetbal International'&&has(row.text,'VI'))){
    issues.push('Oorspronkelijke melder ontbreekt bij '+row.id);continue;
   }
  }
  if(claim.type===types.conflict&&!verifiedConflict(cited)){
   issues.push('Geen bewezen tegenspraak over dezelfde gebeurtenis bij '+row.id);continue;
  }
  if(!isMedia&&!verifiedRegisterCounts(row.text,citations.map(c=>c.quote))){
   issues.push('Wedstrijdstatistieken ontbreken in het letterlijke registerbewijs bij '+row.id);continue;
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
module.exports={types,researchMedia,sentences,prune,hardIssue,prepareRevision,checkReview,verifiedConflict,verifiedRegisterCounts};
