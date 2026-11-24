'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {repairVerifiedClubPreviewForm,reopenVerifiedSourceSentences104J}=require('../scripts/automatic-publication');
const f={id:'sm-19714591',competition:'eredivisie',status:'NS',date:'2026-11-21T20:00:00Z',
 home:{name:'FC Groningen'},away:{name:'sc Heerenveen'}};
const facts=[
 'Bij Heerenveen was Ringo Meerveld in zijn laatste vier competitieduels in slechts 154 minuten betrokken bij vijf doelpunten, evenveel als in de 24 duels ervoor.',
 'Thom van Bergen scoorde in zijn laatste vier thuiswedstrijden voor FC Groningen.',
 'FC Groningen ontvangt sc Heerenveen. De club licht de wedstrijd toe.',
 'Casper Goedkoop vervangt de hoofdtrainer voor deze wedstrijd.'
];
test('104J: productievariant Ringo wordt aantoonbaar anders geformuleerd',()=>{
 const draft={headline:'Groningen en Heerenveen in derby',standfirst:'De teams treffen elkaar.',
  body:[
   'Bij Heerenveen was Ringo Meerveld in zijn laatste vier competitieduels betrokken bij vijf doelpunten in 154 minuten speeltijd. Daarnaast is de tegenstander bekend.',
   'Ook Thom van Bergen scoorde in zijn laatste vier thuiswedstrijden voor Groningen.'
  ]};
 const fixed=repairVerifiedClubPreviewForm(draft,facts);
 assert.equal(fixed.body.length,2);
 assert.doesNotMatch(fixed.body.join(' '),/bij heerenveen was ringo meerveld in zijn laatste vier competitieduels/i);
 assert.doesNotMatch(fixed.body.join(' '),/thom van bergen scoorde in zijn laatste vier thuiswedstrijden/i);
 assert.match(fixed.body[0],/154 speelminuten/);
 assert.match(fixed.body[0],/Daarnaast is de tegenstander bekend/);
 assert.match(fixed.body[1],/vier recentste thuiswedstrijden/);
 assert.deepEqual(repairVerifiedClubPreviewForm(fixed,facts),fixed);
 assert.deepEqual(repairVerifiedClubPreviewForm(draft,[]),draft);
});
test('104J: bij onvoldoende specifiek bewijs vindt geen automatische bronparafrase plaats',()=>{
 const draft={headline:'Groningen',standfirst:'Voorbeschouwing',body:[
  'Bij Heerenveen was Ringo Meerveld in zijn laatste vier competitieduels betrokken bij vijf doelpunten in 154 minuten speeltijd.'
 ]};
 assert.deepEqual(repairVerifiedClubPreviewForm(draft,['Heerenveen begint zaterdag.']),draft);
});
test('104J: uitsluitend exact afgewezen preview wordt één keer geheel opnieuw gecontroleerd',t=>{
 const c={kind:'preview',category:'Eredivisie',topic:'FC Groningen – SC Heerenveen',
  fixture:f,kickoff:Date.parse(f.date),facts:facts.map(text=>({text}))};
 const group=Object.assign([{title:c.topic}],{clubPreview:c});
 const now=Date.parse('2026-11-20T23:48:00Z');
 const hash='a492ca90a140fc8487db6114c6e1b6d7cf42637eff3bf7d2137e8393bcb838e9';
 const job={clubPreviewId:f.id,status:'review',failureStage:'quality',
  failureCategory:'journalistic_rejection',reason:'editorial_review_required',errorHash:hash,
  storageFixtureRetry104I:true,attempts:3,checkpoint:'reject-copy'};
 assert.equal(reopenVerifiedSourceSentences104J({...job},group,now),false);
 const lib=require('../image-library49');
 const raw=require('../image-library49.json').assets.find(x=>x.id==='veldio104d-fcgroningen-night-preview');
 const synthetic={...raw,id:'synthetic-104-preview',manualReview115:undefined,brandingAudit115:require('../test-support/branding-fixture115')(raw.sha256)};
 const actual=lib.catalog();
 t.mock.method(lib,'catalog',()=>[...actual,synthetic]);
 assert.equal(reopenVerifiedSourceSentences104J(job,group,now),true);
 assert.equal(job.status,'pending');assert.equal(job.attempts,0);
 assert.equal(job.checkpoint,undefined);
 const old={...job,status:'review',failureStage:'quality',
  failureCategory:'journalistic_rejection',reason:'editorial_review_required',errorHash:hash};
 assert.equal(reopenVerifiedSourceSentences104J(old,group,now),false);
 const base={...old,sourceSentenceRetry104J:false};
 assert.equal(reopenVerifiedSourceSentences104J({...base,errorHash:'different'},group,now),false);
 assert.equal(reopenVerifiedSourceSentences104J({...base,storageFixtureRetry104I:false},group,now),false);
 assert.equal(reopenVerifiedSourceSentences104J({...base,clubPreviewId:'other'},group,now),false);
 assert.equal(reopenVerifiedSourceSentences104J(base,group,Date.parse(f.date)+1),false);
});
