'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {repairUnsupportedDecisionTimestamp}=require('../editorial-ai');
const SOURCE='https://www.fcgroningen.nl/nieuws/schikkingsvoorstel-voor-hateboer-geaccepteerd/';
const facts=[
 'FC Groningen en Hans Hateboer hebben het schikkingsvoorstel voor de rode kaart geaccepteerd.',
 'De verdediger mist de eerstvolgende competitiewedstrijd op zaterdag 21 november.',
 'De rode kaart was het gevolg van hands.'
];
const draft={
 headline:'FC Groningen accepteert schikkingsvoorstel voor Hans Hateboer',
 standfirst:'FC Groningen bevestigt het besluit over de schorsing van Hans Hateboer.',
 body:[
  'Op maandag 9 november 2026 om 14:40 maakte FC Groningen officieel bekend dat zowel de club als Hans Hateboer het schikkingsvoorstel hebben geaccepteerd.',
  'De verdediger mist hierdoor de competitiewedstrijd op zaterdag 21 november.'
 ]
};
test('fase 71: removed unverified page clock while retaining genuine decision details',()=>{
 const fixed=repairUnsupportedDecisionTimestamp(draft,facts,SOURCE,'club_decision');
 assert.equal(fixed.body[0],'FC Groningen maakte officieel bekend dat zowel de club als Hans Hateboer het schikkingsvoorstel hebben geaccepteerd.');
 assert.equal(fixed.body[1],draft.body[1]);
 assert.doesNotMatch(fixed.body.join(' '),/\b9 november\b|\b14:40\b/);
 assert.match(fixed.body.join(' '),/21 november/);
 assert.match(draft.body[0],/9 november/); // Never mutate the initial manuscript
});
test('fase 71: only a verified own announcement is eligible for the narrow repair',()=>{
 assert.deepEqual(repairUnsupportedDecisionTimestamp(draft,facts,'https://fctwente.nl/nieuws/iets','club_decision'),draft);
 assert.deepEqual(repairUnsupportedDecisionTimestamp(draft,facts,SOURCE,'preview'),draft);
 assert.deepEqual(repairUnsupportedDecisionTimestamp(draft,[],SOURCE,'club_decision'),draft);
});
test('fase 71: unrelated or unconfirmed timestamps remain for factual review',()=>{
 const input={...draft,body:['Hans Hateboer speelde op maandag 9 november 2026 om 14:40 een wedstrijd.',draft.body[1]]};
 assert.deepEqual(repairUnsupportedDecisionTimestamp(input,facts,SOURCE,'club_decision'),input);
});
