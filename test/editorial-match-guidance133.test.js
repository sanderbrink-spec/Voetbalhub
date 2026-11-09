'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const guide=require('../editorial-match-guidance133');

const rich={articleKind:'match_report',matchId:'sm-19714597',
 verifiedFacts:[
  'FC Twente – Ajax eindigde in 2-2.',
  'Eredivisie speelronde 12, gespeeld op 2026-11-08.',
  'Volgens de wedstrijdregistratie viel in minuut 14 een doelpunt waarna de stand 1-0 was.',
  'Volgens de wedstrijdregistratie viel in minuut 21 een doelpunt waarna de stand 1-1 was.',
  'Volgens de wedstrijdregistratie viel in minuut 88 een doelpunt waarna de stand 2-2 was.'
 ]};
test('rich registered match gets the complete evidence-led report, not a compact summary',()=>{
 assert.equal(guide.isRichMatch(rich),true);
 const prompt=guide.writingPrompt(rich);
 assert.match(prompt,/3-5 verschillende bodyalinea’s/);
 assert.match(prompt,/18-120 woorden/);
 assert.match(prompt,/geen ongedocumenteerde kansen/i);
 assert.match(prompt,/tussenstanden alleen letterlijk/i);
 assert.doesNotMatch(prompt,/body bevat 1-2 alinea’s/);
});
test('bare score update stays compact and cannot invent details',()=>{
 const short={articleKind:'score_update',verifiedFacts:rich.verifiedFacts.slice(0,2)};
 assert.equal(guide.isRichMatch(short),false);
 assert.match(guide.writingPrompt(short),/1-2 alinea’s van elk 10-65 woorden/);
 assert.doesNotMatch(guide.writingPrompt(short),/3-5 verschillende bodyalinea’s/);
});
test('source-backed rich matchEvidence still demands a full article',()=>{
 assert.equal(guide.isRichMatch({...rich,verifiedFacts:rich.verifiedFacts.slice(0,2),matchEvidence:{url:'https://example.org/match'}}),true);
});
test('numeric whitelist is derived only from evidence, never fabricated',()=>{
 assert.deepEqual(guide.allowedScores(rich.verifiedFacts),['2-2','1-0','1-1']);
 assert.ok(!guide.allowedNumbers(rich.verifiedFacts).includes('7'));
 assert.ok(guide.allowedNumbers(rich.verifiedFacts).includes('88'));
});
test('rewrite guidance retains the correct format and explicitly discards old draft',()=>{
 const prompt=guide.revisionPrompt(rich);
 assert.match(prompt,/3-5 verschillende bodyalinea’s/);
 assert.match(prompt,/afgekeurde concept is bewust niet beschikbaar/i);
 assert.match(prompt,/allowedScores/);
 assert.match(guide.revisionPrompt({articleKind:'score_update',verifiedFacts:rich.verifiedFacts.slice(0,2)}),/1-2 alinea’s/);
});

test('the independent facts audit must never treat an ISO date as a football score',()=>{
 const facts=require('../editorial-facts');
 const issues=facts.evidenceIssues({
  headline:'FC Twente en Ajax delen punten na doelpunten',
  standfirst:'FC Twente en Ajax eindigden met 11-8 volgens de registratie.',
  body:['De wedstrijd is gespeeld op de genoemde datum.']
 },rich.verifiedFacts);
 assert.ok(issues.some(x=>x.includes('Uitslag of tussenstand wijkt af')),issues.join(' | '));
});
