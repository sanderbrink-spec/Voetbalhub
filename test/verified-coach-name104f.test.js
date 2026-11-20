'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {repairVerifiedCoachName}=require('../editorial-ai');
const {reopenVerifiedCoachName104F}=require('../scripts/automatic-publication');
const facts=[
 'Assistent-trainer Casper Goedkoop neemt de honneurs waar.',
 'De selectie van FC Groningen is bevestigd voor de wedstrijd.',
 'Groningen ontvangt SC Heerenveen.',
 'De wedstrijd begint zaterdagavond.'
];
const fixture={id:'sm-19714591',competition:'eredivisie',status:'NS',date:'2026-11-21T20:00:00Z',
 home:{name:'FC Groningen'},away:{name:'sc Heerenveen'}};
test('104F: alleen volledig bewezen Casper Goedkoop wordt uit onvolledige rolnaam gerepareerd',()=>{
 const draft={headline:'Assistent-trainer Casper bereidt derby voor',
  standfirst:'Assistent-trainer Casper Goedkoop zal de wedstrijd begeleiden.',
  body:['Assistent-trainer Casper neemt voorlopig de honneurs waar.']};
 const fixed=repairVerifiedCoachName(draft,facts);
 assert.equal(fixed.headline,'Casper Goedkoop bereidt derby voor');
 assert.equal(fixed.standfirst,'Casper Goedkoop zal de wedstrijd begeleiden.');
 assert.equal(fixed.body[0],'Casper Goedkoop neemt voorlopig de honneurs waar.');
 assert.deepEqual(repairVerifiedCoachName(fixed,facts),fixed);
 assert.deepEqual(repairVerifiedCoachName(draft,['Assistent-trainer Casper is genoemd.']),draft);
 assert.deepEqual(repairVerifiedCoachName(draft,['Casper Goedkoop is genoemd.']),draft);
});
test('104F: bekende generatorafwijzing uitsluitend eenmaal opnieuw met volledig verse controle',()=>{
 const candidate={fixture,kind:'preview',category:'Eredivisie',topic:'FC Groningen – SC Heerenveen',
 kickoff:Date.parse(fixture.date)};
 const group=Object.assign([{title:candidate.topic}],{clubPreview:candidate});
 const job={clubPreviewId:fixture.id,status:'review',failureStage:'generation',failureCategory:'journalistic_rejection',
 reason:'insufficient_verified_facts',errorHash:'88bf273c7239a1571b66588dfda8209f1164594085cadd3dead5a76693b1f825',
 checkpoint:'rejected-writer',attempts:2};
 const now=Date.parse('2026-11-20T23:15:00Z');
 assert.equal(reopenVerifiedCoachName104F(job,group,now),true);
 assert.equal(job.status,'pending');assert.equal(job.checkpoint,undefined);
 assert.equal(reopenVerifiedCoachName104F(job,group,now),false);
 assert.equal(reopenVerifiedCoachName104F({...job,status:'review',failureStage:'generation',failureCategory:'journalistic_rejection',reason:'insufficient_verified_facts',errorHash:'other',verifiedCoachNameRecovery104F:false},group,now),false);
 assert.equal(reopenVerifiedCoachName104F({...job,status:'review',failureStage:'generation',failureCategory:'journalistic_rejection',reason:'insufficient_verified_facts',errorHash:'88bf273c7239a1571b66588dfda8209f1164594085cadd3dead5a76693b1f825',verifiedCoachNameRecovery104F:false},group,Date.parse(fixture.date)+1),false);
});
