'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {researchCandidates,europeanResearchPriority}=require('../scripts/ten-agent-newsroom101');
const now=Date.parse('2026-11-25T20:00:00Z');
function group(id,title,age=1,extra={}){
 return {id,subject:title,agents:['achtergrond'],outlets:['vi','nos'],sources:[{url:'https://example.org/'+id,title,publishedAt:new Date(now-age*3600000).toISOString()}],...extra};
}
test('120J a fresh missed lead remains eligible on a subsequent scan without being marked new',()=>{
 const g=group('a','PSV in de Champions League');
 assert.deepEqual(researchCandidates([g],[],[],now),[g]);
 assert.deepEqual(researchCandidates([g],[],[{groupKey:'a'}],now),[]);
});
test('120J older unresearched backlog expires but a genuinely new lead is still considered',()=>{
 const g=group('a','Nieuws van gisteren',24);
 assert.deepEqual(researchCandidates([g],[],[],now),[]);
 assert.deepEqual(researchCandidates([g],[{url:g.sources[0].url}],[],now),[g]);
});
test('120J European relevance breaks ties without treating rumors as verified',()=>{
 const domestic=group('a','Binnenlands nieuws'),european=group('b','PSV in de Champions League');
 assert.equal(europeanResearchPriority(european),2);
 assert.deepEqual(researchCandidates([domestic,european],[],[],now).map(g=>g.id),['b','a']);
 const r=group('d','Ajax en de Europa League',1,{rumour:true});
 assert.deepEqual(researchCandidates([r,domestic],[],[],now).map(g=>g.id),['a','d']);
});
