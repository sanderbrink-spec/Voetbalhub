'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {repairVerifiedCoachName}=require('../editorial-ai');
const {repairVerifiedClubPreviewForm,reopenClubPreviewCopyAndRole104H}=require('../scripts/automatic-publication');

const facts=[
 'Zo leidt de assistent-trainer de afsluitende trainingen in aanloop naar sc Heerenveen.',
 'Casper Goedkoop zal voor het eerst in zijn periode als trainer bij FC Groningen hoofdtrainer Dick Lukkien vervangen.',
 'Bij Heerenveen was Ringo Meerveld in zijn laatste vier competitieduels in slechts 154 minuten betrokken bij vijf doelpunten.',
 'Thom van Bergen scoorde in zijn laatste vier thuiswedstrijden voor FC Groningen.'
];
test('104H: alleen geverifieerde Goedkoop-naam krijgt geen onbetrouwbare rolaanduiding',()=>{
 const draft={headline:'Trainer Casper bereidt derby voor',
  standfirst:'Assistent-trainer Goedkoop vervangt Lukkien.',
  body:['Assistent-trainer Casper Goedkoop vervangt de hoofdtrainer.']};
 const fixed=repairVerifiedCoachName(draft,facts);
 assert.equal(fixed.headline,'Casper Goedkoop bereidt derby voor');
 assert.equal(fixed.standfirst,'Casper Goedkoop vervangt Lukkien.');
 assert.equal(fixed.body[0],'Casper Goedkoop vervangt de hoofdtrainer.');
 assert.deepEqual(repairVerifiedCoachName(fixed,facts),fixed);
 assert.deepEqual(repairVerifiedCoachName(draft,['Casper Goedkoop is een voetballer.']),draft);
 assert.deepEqual(repairVerifiedCoachName(draft,['Trainer Casper wordt genoemd.']),draft);
});
test('104H: herformuleer aantoonbare Meerveld- en Van Bergen-feiten zonder originele bronzin',()=>{
 const draft={headline:'Derby',standfirst:'Vooruitblik op de derby.',body:[
  'Bij Heerenveen was Ringo Meerveld in zijn laatste vier competitieduels in slechts 154 minuten betrokken bij vijf doelpunten.',
  'Thom van Bergen scoorde in zijn laatste vier thuiswedstrijden voor FC Groningen.',
  'In de wedstrijdleiding staat Alex Bos.'
 ]};
 const fixed=repairVerifiedClubPreviewForm(draft,facts);
 assert.doesNotMatch(fixed.body.join(' '),/in zijn laatste vier competitieduels in slechts 154 minuten betrokken bij vijf doelpunten/i);
 assert.doesNotMatch(fixed.body.join(' '),/Thom van Bergen scoorde in zijn laatste vier thuiswedstrijden voor FC Groningen/i);
 assert.match(fixed.body[0],/154 speelminuten/);
 assert.match(fixed.body[1],/van Bergen/i);
 assert.deepEqual(repairVerifiedClubPreviewForm(fixed,facts),fixed);
 assert.deepEqual(repairVerifiedClubPreviewForm(draft,[]),draft);
});
test('104H: heropen exact afgewezen bericht, nooit ander dossier of na de aftrap',t=>{
 require('../test-support/catalogue-before116')(t);
 const fixture={id:'sm-19714591',competition:'eredivisie',status:'NS',date:'2026-11-21T20:00:00Z',
  home:{name:'FC Groningen'},away:{name:'sc Heerenveen'}};
 const candidate={kind:'preview',category:'Eredivisie',topic:'FC Groningen – SC Heerenveen',
  fixture,kickoff:Date.parse(fixture.date),facts:facts.map(text=>({text}))};
 const group=Object.assign([{title:candidate.topic}],{clubPreview:candidate});
 const now=Date.parse('2026-11-20T23:30:00Z');
 const hash='13700d5052988bc7ca200f89f4c6a4178785cb19e9b399cab7b130346bbb88b3';
 const job={clubPreviewId:fixture.id,status:'review',failureStage:'quality',
  failureCategory:'journalistic_rejection',reason:'editorial_review_required',
  errorHash:hash,clubDemonymRetry104G:true,attempts:1,checkpoint:'old'};
 assert.equal(reopenClubPreviewCopyAndRole104H({...job},group,now),false);
 const lib=require('../image-library49');
 const raw=require('../image-library49.json').assets.find(x=>x.id==='veldio104d-fcgroningen-night-preview');
 const synthetic={...raw,id:'synthetic-104-preview',manualReview115:undefined,brandingAudit115:require('../test-support/branding-fixture115')(raw.sha256)};
 const actual=lib.catalog();
 t.mock.method(lib,'catalog',()=>[...actual,synthetic]);
 assert.equal(reopenClubPreviewCopyAndRole104H(job,group,now),true);
 assert.equal(job.status,'pending');assert.equal(job.attempts,0);assert.equal(job.checkpoint,undefined);
 const previous={...job,status:'review',failureStage:'quality',failureCategory:'journalistic_rejection',
  errorHash:hash,reason:'editorial_review_required'};
 assert.equal(reopenClubPreviewCopyAndRole104H(previous,group,now),false);
 const another={...previous,copyAndRoleRetry104H:false};
 assert.equal(reopenClubPreviewCopyAndRole104H({...another,errorHash:'unrelated'},group,now),false);
 assert.equal(reopenClubPreviewCopyAndRole104H({...another,clubPreviewId:'other'},group,now),false);
 assert.equal(reopenClubPreviewCopyAndRole104H(another,group,Date.parse(fixture.date)+1),false);
});
