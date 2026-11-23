'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const N=require('../scripts/ten-agent-newsroom101');
const now=Date.parse('2026-11-23T12:00:00Z');
const published='Mon, 23 Nov 2026 11:45:00 GMT';
const passage='Het bericht bevat een concrete, gedateerde mededeling van een voetbalclub. Er wordt een besluit genoemd en er staan namen van de betrokken partijen, maar de inhoud van het bericht is uitsluitend afkomstig van de oorspronkelijke uitgever. De redactie moet dit onafhankelijk controleren voordat een nieuwsartikel mogelijk is.';
function rss(items){
 return '<rss version="2.0"><channel>'+items.map(item=>
  '<item><title><![CDATA['+item.title+']]></title>'+
  '<link>'+item.url+'</link><pubDate>'+published+'</pubDate>'+
  (item.description?'<description><![CDATA['+item.description+']]></description>':'')+
  '</item>').join('')+'</channel></rss>';
}
function noteResponse(){
 return Response.json({choices:[{message:{content:JSON.stringify({
  angle:'Welke officiële mededeling onderbouwt dit verhaal?',
  questions:['Welke clubbron of bondspagina bevestigt deze specifieke ontwikkeling?'],
  caution:'Eén medium is geen onafhankelijke bevestiging.',
  draft:{headline:'Gerucht: Ajax heeft officieel een speler gekocht',
   standfirst:'Volgens Voetbal International en VoetbalPrimeur is dit nog onbevestigd.',
   body:['Dit is een niet geverifieerde tekst.']}
 })}}]});
}
test('112B: one dated substantive RSS passage can open a capped research question, never a draft',async()=>{
 let apiCalls=0, system='';
 const result=await N.scan({
  now,apiKey:'test',runAI:true,
  fetcher:async(url,options={})=>{
   if(url.includes('api.groq.com')){
    apiCalls++;
    system=JSON.parse(options.body).messages[0].content;
    return noteResponse();
   }
   return new Response(url.includes('vi.nl')?rss([{
    title:'Ajax komt met nieuws over nieuwe jeugdtrainer',
    url:'https://www.vi.nl/nieuws/nieuwe-jeugdtrainer',
    description:passage
   }]):rss([]));
  }
 });
 assert.equal(apiCalls,1);
 assert.equal(result.report.aiCalls,1);
 assert.equal(result.report.singleOutletResearchCalls,1);
 assert.equal(result.report.aiDailyLimit,10);
 assert.equal(result.report.published,0);
 assert.match(system,/ÉÉN BRON/);
 assert.match(system,/GEEN concept/);
 const saved=result.state.researchNotes[0];
 assert.equal(saved.singleOutletResearch,true);
 assert.equal(saved.verified,false);
 assert.equal(saved.publicationAllowed,false);
 assert.equal(saved.independentEvidenceChecked,false);
 assert.equal(saved.draft,null);
 assert.equal(saved.trainingAudit.externalCorroborationVerified,false);
 assert.equal(result.report.training.validUniqueProfiles,true);
});
test('112B: title-only or short single-source leads spend no AI calls and cannot publish',async()=>{
 let apiCalls=0;
 const result=await N.scan({
  now,apiKey:'test',runAI:true,
  fetcher:async(url)=>{
   if(url.includes('api.groq.com')){apiCalls++;return noteResponse();}
   return new Response(url.includes('vi.nl')?rss([
    {title:'FC Groningen meldt nieuws over selectie',
     url:'https://www.vi.nl/nieuws/groningen-update'},
    {title:'Ajax brengt opmerkelijke trainersmededeling',
     url:'https://www.vi.nl/nieuws/aj-update',description:'Een korte omschrijving zonder concrete onderbouwing.'}
   ]):rss([]));
  }
 });
 assert.equal(apiCalls,0);
 assert.equal(result.report.aiCalls,0);
 assert.equal(result.report.singleOutletResearchCalls,0);
 assert.equal(result.report.singleOutletWithoutPassage,2);
 assert.equal(result.report.newSignals,2);
 assert.equal(result.report.published,0);
});
test('112B: multi-outlet leads retain priority and the one remaining daily slot is never exceeded',async()=>{
 let calls=0;
 const result=await N.scan({
  now,apiKey:'test',runAI:true,state:{day:'2026-11-23',aiCallsToday:9},
  fetcher:async url=>{
   if(url.includes('api.groq.com')){calls++;return noteResponse();}
   const data=url.includes('vi.nl')?[
    {title:'Ajax bevestigt benoeming nieuwe jeugdtrainer',url:'https://www.vi.nl/nieuws/ajax-jeugdtrainer',description:passage},
    {title:'FC Groningen publiceert nieuwe selectieplanning',url:'https://www.vi.nl/nieuws/groningen-planning',description:passage}
   ]:url.includes('voetbalprimeur.nl')?[
    {title:'Ajax bevestigt benoeming nieuwe jeugdtrainer',url:'https://www.voetbalprimeur.nl/nieuws/ajax-jeugdtrainer',description:passage}
   ]:[];
   return new Response(rss(data));
  }
 });
 assert.equal(calls,1);
 assert.equal(result.report.aiCalls,1);
 assert.equal(result.report.aiCallsToday,10);
 assert.equal(result.report.singleOutletResearchCalls,0);
 assert.equal(result.report.publicationAttempts,0);
 const first=result.state.researchNotes[0];
 assert.equal(first.singleOutletResearch,false);
 assert.equal(first.publicationAllowed,false);
});
test('112B: saved one-source research is deduplicated, no second model call for same URL',async()=>{
 let calls=0;
 const fetcher=async url=>{
  if(url.includes('api.groq.com')){calls++;return noteResponse();}
  return new Response(url.includes('vi.nl')?rss([{
   title:'Ajax meldt vernieuwing binnen de jeugdopleiding',
   url:'https://www.vi.nl/nieuws/nieuws-jeugdopleiding',description:passage
  }]):rss([]));
 };
 const a=await N.scan({now,apiKey:'test',runAI:true,fetcher});
 const b=await N.scan({now:now+15*60000,apiKey:'test',runAI:true,fetcher,state:a.state});
 assert.equal(calls,1);
 assert.equal(b.report.newSignals,0);
 assert.equal(b.report.aiCalls,0);
 assert.equal(b.report.publicationAttempts,0);
});
