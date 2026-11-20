'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {buildStoryStrategy}=require('../editorial-newsroom-strategy103');

test('103A kiest een eigen verhaalhoek uitsluitend uit aanwezige geverifieerde feiten',()=>{
 const facts=[
  'FC Groningen bevestigt de benoeming van een nieuwe hoofdtrainer.',
  'Eerder werkte de trainer in 2024 bij de jeugdopleiding.',
  'De eerstvolgende competitiewedstrijd wordt zondag gespeeld.',
  'De club licht volgens de trainer het besluit toe.'
 ];
 const plan=buildStoryStrategy(facts,{topic:'FC Groningen benoemt trainer'});
 assert.equal(plan.strategyVersion,'103A');
 assert.equal(plan.readyForWriting,true);
 assert.ok(plan.angleOptions.length>=3);
 assert.equal(plan.selectedAngle.id,'context');
 assert.equal(plan.selectedAngle.leadFactId,'F1');
 assert.ok(plan.selectedAngle.supportingFactIds.includes('F2'));
 for(const angle of plan.angleOptions){
  assert.ok(angle.factIds.every(id=>plan.supportedFactIds.includes(id)));
  assert.equal(new Set(angle.factIds).size,angle.factIds.length);
 }
 assert.equal(plan.researchQuestionsAreEvidence,false);
 assert.ok(plan.newsroomInstruction.includes('selectedAngle.readerQuestion'));
});

test('103A weigert ontbrekende context als feit te presenteren',()=>{
 const plan=buildStoryStrategy(['De club heeft een nieuwe trainer benoemd.'],{topic:'Clubnieuws',compact:true});
 assert.equal(plan.readyForWriting,false);
 assert.deepEqual(plan.angleOptions,[]);
 assert.equal(plan.selectedAngle,null);
 assert.ok(plan.evidenceGaps.length>=1);
 assert.ok(plan.evidenceGaps.every(item=>item.usableAsEvidence===false&&item.status==='onderzoek_nodig'));
 assert.ok(plan.newsroomInstruction.includes('{"skip":true}'));
});

test('103A promoot geen toekomstscenario of losse herhaling tot een nieuwe invalshoek',()=>{
 const facts=[
  'De voetbalbond bevestigt de plaatsing voor de kwartfinales.',
  'De voetbalbond bevestigt de plaatsing voor de kwartfinales.',
  'De loting vond vrijdag plaats.'
 ];
 const plan=buildStoryStrategy(facts,{topic:'Kwartfinale',compact:true});
 assert.deepEqual(plan.supportedFactIds,['F1','F3']);
 assert.ok(plan.angleOptions.every(angle=>!['context','vervolg','reactie','competitie'].includes(angle.id)));
 assert.ok(plan.angleOptions.every(angle=>angle.factIds.every(id=>['F1','F3'].includes(id))));
 assert.ok(plan.researchQuestionsAreEvidence===false);
});
