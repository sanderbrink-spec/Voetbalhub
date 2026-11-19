'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {officialSourceAuthority,articleUrl}=require('../scripts/editorial-discovery53');
const {primaryAuthority,validateEvidence}=require('../scripts/automatic-publication');
const {attachVerifiedOfficialAttribution,editorialAttributionIssues}=require('../editorial-ai');
const indexes=require('../automatic-editorial.json').newsIndexes;
const prefix='https://www.uefa.com/uefanationsleague/news/';
const draw=prefix+'02a3-decision--2026-27-uefa-nations-league-knockout-stage-and-play-off-draw/';
const confirmed=prefix+'02a3-decision--nations-league-quarter-finals-last-eight-confirmed/';
test('99C-2 official UEFA draw and final qualification have first-party status at both gates',()=>{
 for(const url of [draw,confirmed]){
  const canonical=articleUrl(url,indexes);
  assert.equal(canonical,url);
  assert.equal(officialSourceAuthority(canonical),'association_decision');
  assert.equal(primaryAuthority({url,title:'UEFA Nations League quarter-finals confirmed',text:'UEFA Nations League officially confirms the teams and the draw.'}),'association_decision');
 }
});
test('99C-2 UEFA analysis and malicious URLs never receive primary decision authority',()=>{
 for(const suffix of [
  '02a3-analysis--knockout-stage-and-play-off-draw-explained/',
  '02a3-preview--nations-league-quarter-finals-last-eight-confirmed-preview/',
  '02a3-rumour--knockout-stage-and-play-off-draw-rumours/'
 ]){
  const url=prefix+suffix;
  assert.notEqual(officialSourceAuthority(url),'association_decision');
  assert.notEqual(primaryAuthority({url,title:'UEFA Nations League analysis of a possible draw',text:'An expert interpretation, not a decision.'}),'association_decision');
 }
 assert.notEqual(officialSourceAuthority('https://www.uefa.com.evil.example/uefanationsleague/news/02a3-a--knockout-stage-and-play-off-draw/'),'association_decision');
});
test('99C-2 UEFA body attribution is repaired once with unchanged football claims',()=>{
 const sourceUrls=[confirmed];
 const facts=[
  'Iceland confirmed its promotion to the UEFA Nations League top group.',
  'The official overview also lists the other promoted national sides.',
  'The tournament is organised by UEFA and has separate competition tiers.',
  'The confirmed status appears in the UEFA Nations League overview.'
 ];
 const draft={headline:'IJsland promoveert volgens de UEFA naar een hogere divisie',
  standfirst:'IJsland krijgt in de Nations League een andere plaats na de bevestigde promotie.',
  body:[
   'De promotie is opgenomen in het overzicht van deelnemende landen en hun onderlinge indeling voor de volgende fase van de landencompetitie.',
   'Ook de overige gepromoveerde landen staan in de officiële competitie-informatie, met afzonderlijke categorieën voor de verschillende divisies binnen het toernooi.',
   'De indeling geeft aan welke deelnemende landen in de volgende toernooifase van de UEFA Nations League onder dezelfde competitiecategorie vallen.'
  ]};
 const opts={primaryAuthority:'association_decision',sourceUrls,facts};
 assert.ok(editorialAttributionIssues(draft,opts).some(s=>s.includes('inhoudelijke alinea')));
 const result=attachVerifiedOfficialAttribution(draft,opts);
 assert.deepEqual(editorialAttributionIssues(result,opts),[]);
 assert.equal(result.body.length,draft.body.length);
 assert.ok(result.body[0].startsWith(draft.body[0]));
 assert.deepEqual(attachVerifiedOfficialAttribution(result,opts),result);
 assert.deepEqual(draft.body[1],result.body[1]);
 assert.deepEqual(draft.body[2],result.body[2]);
});
test('99C-2 external status cannot skip independent confirmation',()=>{
 const docs=[{url:prefix+'02a3-explainer--knockout-stage-and-play-off-draw-explained/',publishedAt:'2026-11-19T08:00:00Z',text:'One unconfirmed observer reports that a new qualification decision is coming tomorrow.'}];
 const fact='One unconfirmed observer reports that a new qualification decision is coming tomorrow.';
 const result=validateEvidence({kind:'announcement',facts:[{text:fact,evidence:[{source:0,quote:fact}]}],sharedEventEvidence:[]},docs,Date.parse('2026-11-19T12:00:00Z'));
 assert.ok(result.some(issue=>issue.includes('Vier tot tien')||issue.includes('twee onafhankelijke')));
});
