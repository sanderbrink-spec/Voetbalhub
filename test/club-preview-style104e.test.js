'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {repairVerifiedClubPreviewForm,reopenVerifiedClubPreviewStyle104E}=require('../scripts/automatic-publication');
const fixture={id:'sm-19714591',competition:'eredivisie',status:'NS',date:'2026-11-21T20:00:00Z',
 home:{name:'FC Groningen'},away:{name:'sc Heerenveen'}};
const facts=[
 'Groningen won de laatste drie ontmoetingen met de Friezen en kan zijn langste winstreeks tegen Heerenveen evenaren.',
 'Bij Heerenveen was Ringo Meerveld in zijn laatste vier competitieduels in slechts 154 minuten betrokken bij vijf doelpunten.',
 'Casper Goedkoop zal voor het eerst in zijn periode als trainer bij FC Groningen hoofdtrainer Dick Lukkien vervangen.',
 'Thom van Bergen scoorde in zijn laatste vier thuiswedstrijden voor FC Groningen.'
];
test('104E: vier originele AI-alinea’s worden drie, zonder nieuwe claim of bronkopie',()=>{
 const draft={headline:'Goedkoop neemt derby op zich',standfirst:'Casper Goedkoop staat tegen Heerenveen aan het roer.',
  body:[
   'Casper Goedkoop neemt voor het eerst de leiding bij FC Groningen, in plaats van Dick Lukkien.',
   'SC Heerenveen won vier wedstrijden op rij.',
   'FC Groningen won de laatste drie ontmoetingen met de Friezen en kan daarmee een langste winstreeks tegen deze tegenstander evenaren.',
   'Ringo Meerveld in zijn laatste vier competitieduels in slechts 154 minuten betrokken was bij vijf doelpunten.'
  ]};
 const repaired=repairVerifiedClubPreviewForm(draft,facts);
 assert.equal(repaired.body.length,3);
 assert.match(repaired.body[2],/De drie vorige ontmoetingen/);
 assert.doesNotMatch(repaired.body.join(' '),/Groningen won de laatste drie ontmoetingen met de Friezen en/);
 assert.doesNotMatch(repaired.body.join(' '),/in zijn laatste vier competitieduels in slechts 154 minuten/);
 assert.equal(repaired.headline,draft.headline);
 assert.deepEqual(repairVerifiedClubPreviewForm(repaired,facts),repaired);
});
test('104E: geen feitenparafrase wanneer expliciete bewijskaart ontbreekt',()=>{
 const draft={headline:'Test',body:['FC Groningen won de laatste drie ontmoetingen met de Friezen en kan daarmee een langste winstreeks tegen deze tegenstander evenaren.']};
 assert.deepEqual(repairVerifiedClubPreviewForm(draft,[]),draft);
});
test('104E: uitsluitend exact 104D-afgekeurd manuscript wordt eenmalig voor normale controle heropend',t=>{
 const candidate={kind:'preview',topic:'FC Groningen – SC Heerenveen',category:'Eredivisie',
 fixture,kickoff:Date.parse(fixture.date),facts:facts.map(text=>({text,evidence:[{source:0}]}))};
 const group=Object.assign([{url:'https://www.fcgroningen.nl/nieuws/voorbeeld',title:candidate.topic}],{clubPreview:candidate});
 const now=Date.parse('2026-11-20T23:15:00Z');
 const job={clubPreviewId:fixture.id,status:'review',failureStage:'quality',failureCategory:'journalistic_rejection',
 errorHash:'57ac3e8b2ec9ff951794999b63a8033448661d3316541a82a464c8c337d1d848',
 checkpoint:'unsafe-prior-copy',attempts:3};
 assert.equal(reopenVerifiedClubPreviewStyle104E({...job},group,now),false);
 const lib=require('../image-library49');
 const raw=require('../image-library49.json').assets.find(x=>x.id==='veldio104d-fcgroningen-night-preview');
 const synthetic={...raw,id:'synthetic-104-preview',manualReview115:undefined,brandingAudit115:require('../test-support/branding-fixture115')(raw.sha256)};
 const actual=lib.catalog();
 t.mock.method(lib,'catalog',()=>[...actual,synthetic]);
 assert.equal(reopenVerifiedClubPreviewStyle104E(job,group,now),true);
 assert.equal(job.status,'pending');
 assert.equal(job.attempts,0);
 assert.equal(job.checkpoint,undefined);
 assert.equal(reopenVerifiedClubPreviewStyle104E(job,group,now),false);
 assert.equal(reopenVerifiedClubPreviewStyle104E({...job,status:'review',errorHash:'different',previewStyleRecovery104E:false},group,now),false);
 assert.equal(reopenVerifiedClubPreviewStyle104E({...job,status:'review',errorHash:'57ac3e8b2ec9ff951794999b63a8033448661d3316541a82a464c8c337d1d848',previewStyleRecovery104E:false},group,Date.parse(fixture.date)+1),false);
});
