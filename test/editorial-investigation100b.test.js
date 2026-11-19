'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {planEvidenceResearch}=require('../editorial-investigation100b');
const {createEditorialDraft}=require('../editorial-ai');

test('100B news desk selects a verified decision and separate context desk only cites supplied facts',()=>{
 const facts=[
  'De club heeft een nieuwe hoofdtrainer aangesteld.',
  'Eerder werkte dezelfde trainer bij de jeugdopleiding in 2024.',
  'De eerste competitiewedstrijd met de trainer wordt komende zondag gespeeld.',
  'De club heeft een nieuwe hoofdtrainer aangesteld.'
 ];
 const plan=planEvidenceResearch(facts,{topic:'Club stelt trainer aan',compact:true});
 assert.deepEqual(plan.leadFactIds,['F1']);
 assert.deepEqual(plan.contextFactIds,['F2','F3']);
 assert.deepEqual(plan.supportedFactIds,['F1','F2','F3']);
 assert.ok(plan.bodySections.length<=2);
 assert.equal(plan.researchQuestionsAreEvidence,false);
 const assigned=[...plan.leadFactIds,...plan.bodySections.flatMap(section=>section.factIds)];
 assert.equal(new Set(assigned).size,assigned.length);
 assert.ok(assigned.every(id=>plan.supportedFactIds.includes(id)));
});

test('100B distinguishes different numerical claims and conflicting outcomes',()=>{
 const facts=[
  'De club heeft 11 punten in de groepsfase.',
  'De club heeft 12 punten in de groepsfase.',
  'De club heeft geen akkoord bereikt.',
  'De club heeft akkoord bereikt.'
 ];
 const plan=planEvidenceResearch(facts,{compact:true});
 assert.equal(plan.distinctFactCount,4);
 assert.equal(plan.supportedFactIds.length,4);
});

test('100B never promotes an unanswered research question into a verified fact',()=>{
 const facts=['De club heeft een nieuwe speler aangesteld.','Dat meldt de club op de eigen website.'];
 const plan=planEvidenceResearch(facts,{topic:'Spelernieuws',compact:true});
 assert.deepEqual(plan.supportedFactIds,['F1','F2']);
 assert.ok(plan.researchQuestions.some(question=>question.includes('eerdere wedstrijd')));
 assert.ok(plan.researchQuestions.some(question=>question.includes('volgende wedstrijd')));
 assert.equal(plan.researchQuestionsAreEvidence,false);
 const empty=planEvidenceResearch([],{});
 assert.deepEqual(empty.leadFactIds,[]);
 assert.deepEqual(empty.bodySections,[]);
});

test('100B writer gets the evidence-bound research plan without a new model request',async()=>{
 const facts=[
  'FC Groningen heeft een nieuwe trainer aangesteld.',
  'Eerder werkte de trainer in 2024 bij FC Groningen.',
  'De komende wedstrijd staat volgens de club op het programma.'
 ];
 let requests=0;
 let prompt;
 await assert.rejects(createEditorialDraft({
  topic:'FC Groningen benoemt trainer',category:'FC Groningen',facts,
  sourceUrls:['https://www.fcgroningen.nl/nieuws/officiele-aanstelling/'],
  articleKind:'announcement',primaryAuthority:'club_decision',
  automaticPublication:true,compact:true
 },{model:'test-model',apiKey:'not-real',fetcher:async(_url,opts)=>{
  requests++;
  const args=JSON.parse(opts.body);
  prompt=args.messages;
  return Response.json({choices:[{message:{content:'{"skip":true}'}}]});
 }}),error=>error.status===422);
 assert.ok(requests>=1&&requests<=2);
 const user=JSON.parse(prompt[1].content);
 assert.deepEqual(user.facts,facts);
 assert.deepEqual(user.editorialInvestigationPlan.leadFactIds,['F1']);
 assert.ok(user.editorialInvestigationPlan.contextFactIds.includes('F2'));
 assert.ok(prompt[0].content.includes('open researchQuestions'));
});
