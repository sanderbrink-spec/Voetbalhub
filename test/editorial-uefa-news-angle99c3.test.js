'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const M=require('../editorial-desk-model');
const {createEditorialDraft}=require('../editorial-ai');

const official='https://www.uefa.com/uefanationsleague/news/02ab-synthetic-fixture--quarter-finals-status/';
const facts=[
 'Group A1 Arland (12pts), Borland (10), Corland (4), Dorland (0)',
 'Arland are confirmed in first place and have qualified for the quarter-finals.',
 'Borland are confirmed in second place and have qualified for the quarter-finals.',
 'Group A2 Germany (11pts), Netherlands (11), Greece (11), Otherland (0)',
 'Germany are confirmed in first place and have qualified for the quarter-finals.',
 'Netherlands are confirmed in second place and have qualified for the quarter-finals.',
 'Group A3 Erland (15pts), Farland (12), Garland (3), Harland (0)',
 'Erland are confirmed in first place and have qualified for the quarter-finals.',
 'Group A4 Irland (13pts), Jarland (10), Karland (6), Larland (1)',
 'Jarland are confirmed in second place and have qualified for the quarter-finals.'
];
const payload={articleKind:'announcement',primaryAuthority:'association_decision',verifiedFacts:facts,sources:[{url:official}]};

test('99C-3: multiple official UEFA table facts can use a compact editorial form without losing evidence',()=>{
 assert.equal(M.briefEligible(payload),true);
 assert.equal(M.briefEligible({...payload,sources:[{url:'https://www.ajax.nl/artikelen/synthetic'}]}),false);
 assert.equal(M.briefEligible({...payload,primaryAuthority:null}),false);
 assert.equal(M.briefEligible({...payload,verifiedFacts:facts.filter(f=>!/^Group A[1-4]/.test(f))}),false);
 assert.equal(M.briefEligible({...payload,verifiedFacts:[...facts,'Unrelated extra sentence.']}),false);
 const concise={headline:'UEFA bevestigt de landen in de volgende ronde',standfirst:'De bond heeft de groepsplaatsen bevestigd voor de komende ronde.',body:['De bond bevestigt de eerste plaats en plaatst ook de nummer twee uit de betreffende groep voor de volgende ronde.']};
 assert.ok(!M.draftIssues(concise,true).some(x=>x.includes('Tekst: 3 tot 5')));
 assert.ok(M.draftIssues(concise,false).some(x=>x.includes('Tekst: 3 tot 5')));
});

test('99C-3: first-party UEFA writer is guided to one evidence-based angle, not repeated country lists',async()=>{
 let initialSystem='';
 const router={complete:async messages=>{
  if(!initialSystem)initialSystem=messages[0]?.content||'';
  return {skip:true};
 }};
 await assert.rejects(createEditorialDraft({
  topic:'Synthetic league group qualification update',category:'Nations League',facts,
  articleKind:'announcement',primaryAuthority:'association_decision',
  sourceUrls:[official],compact:true,automaticPublication:true
 },{router,model:'openai/gpt-oss-120b',apiKey:'synthetic',timeoutMs:10000}));
 assert.match(initialSystem,/1-2 inhoudelijk verschillende alinea/);
 assert.match(initialSystem,/Nederland/);
 assert.match(initialSystem,/Griekenland/);
 assert.match(initialSystem,/Verzin NIET waarom Duitsland boven Nederland/);
 assert.match(initialSystem,/geen lege waarderingszinnen/i);
 assert.doesNotMatch(initialSystem,/drie bodyalinea.s verplicht/i);
});
