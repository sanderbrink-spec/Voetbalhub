'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const P=require('../editorial-topic-policy'),I=require('../editorial-image44');
const examples=[
 ['FC Groningen meldt blessure van speler','injury'],
 ['Ajax trainer bespreekt aanpassing','coach'],
 ['PSV past tactiek aan','tactics'],
 ['Feyenoord ziet jeugdspeler doorbreken','youth'],
 ['AZ speler krijgt schorsing','suspension'],
 ['FC Twente geeft interview','interview'],
 ['Nieuwe loting van competitie','competition'],
 ['NEC viert jubileum','history'],
];
for(const [headline,scene] of examples)test('distinct non-documentary image scene: '+scene,()=>{
 const plan=I.classify({draft:{headline,body:[]}});assert.equal(plan.scene,scene);
 const prompt=I.promptFor(plan);assert.ok(prompt.includes(P.visual(scene)));
 assert.match(prompt,/no real identifiable people/);
 const rules=P.rules(scene);assert.equal(rules.documentaryClaim,false);
});
test('transfers remain uncertain unless independently verified',()=>{
 const plan=I.classify({draft:{headline:'Ajax transfer nieuws'}});
 assert.equal(plan.category,'transfer');assert.equal(plan.scene,'unconfirmed');
 const prompt=I.promptFor(plan);assert.match(prompt,/no handshake/);
});
test('non-match pixel review refuses fabricated medical/transfer/person evidence',()=>{
 const plan=I.classify({draft:{headline:'Speler van PSV geblesseerd'}});
 const okay={relevant:true,coloursCorrect:true,highQuality:true,noLogos:true,noIdentifiablePeople:true,noMisleadingEvent:true,issues:[],texts:[],noInventedEvidence:true};
 assert.deepEqual(I.qualityIssues(plan,okay),[]);
 assert.ok(I.qualityIssues(plan,{...okay,noInventedEvidence:false}).some(x=>x.includes('No invented')));
});
