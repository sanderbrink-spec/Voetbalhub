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


test('fase 71: a historically rejected Hateboer item gets exactly one fresh full review',()=>{
 const {createHash}=require('node:crypto');
 const {reopenVerifiedHateboerDateV71}=require('../scripts/automatic-publication');
 const failure='Kwaliteitscontrole na 2 herschrijvingen: Cijfers ontbreken in de gecontroleerde feiten: 9.';
 const job={
  status:'review',failureStage:'quality',failureCategory:'journalistic_rejection',
  urls:[SOURCE],errorHash:createHash('sha256').update(failure).digest('hex'),
  checkpoint:'rejected-old-manuscript',attempts:2
 };
 const group=[{url:SOURCE,publishedAt:'2026-11-09T13:40:58Z',text:'confirmed article'}];
 group.officialDisciplinaryCandidate={facts:facts.map(text=>({text}))};
 const now=Date.parse('2026-11-10T18:02:00Z');
 assert.equal(reopenVerifiedHateboerDateV71(job,group,now,72),true);
 assert.equal(job.status,'pending');
 assert.equal(job.attempts,0);
 assert.equal(job.checkpoint,undefined);
 assert.equal(reopenVerifiedHateboerDateV71(job,group,now,72),false);
 const other={...job,status:'review',hateboerPublicationClockRecoveryV71:false,errorHash:'invalid'};
 assert.equal(reopenVerifiedHateboerDateV71(other,group,now,72),false);
 assert.equal(reopenVerifiedHateboerDateV71({...job,status:'review',hateboerPublicationClockRecoveryV71:false},group,now+100*3600000,72),false);
});


test('fase 71: independent revision is audited for the same unverified decision clock',()=>{
 const {finalizeCheckedRevision}=require('../scripts/automatic-publication');
 const payload={verifiedFacts:facts};
 const candidate={primaryAuthority:'club_decision'};
 const docs=[{url:SOURCE}];
 const revised=finalizeCheckedRevision(draft,payload,candidate,docs);
 assert.match(revised.body[0],/^FC Groningen maakte officieel bekend dat /);
 assert.doesNotMatch(revised.body[0],/\b9 november\b|\b14:40\b/);
 assert.deepEqual(revised.body[1],draft.body[1]);
 assert.deepEqual(finalizeCheckedRevision(draft,payload,{primaryAuthority:'preview'},docs),draft);
 assert.deepEqual(finalizeCheckedRevision(draft,payload,candidate,[...docs,...docs]),draft);
 assert.equal(finalizeCheckedRevision({skip:true},payload,candidate,docs),null);
});
