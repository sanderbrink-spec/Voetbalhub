'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {evidenceIssues}=require('../editorial-facts');
const {reopenVerifiedClubDemonym104G}=require('../scripts/automatic-publication');

const facts=['FC Groningen speelt tegen sc Heerenveen.','Thom van Bergen scoorde in vier thuiswedstrijden voor FC Groningen.'];
const draft={headline:'De Groningers treffen Heerenveen',
 standfirst:'FC Groningen ontvangt sc Heerenveen.',
 body:['Thom van Bergen scoorde in vier thuiswedstrijden.']};
test('104G: echte Groningse clubbijnaam mag, een ongedekte bijnaam blijft verboden',()=>{
 assert.ok(!evidenceIssues(draft,facts).some(x=>x.includes('De Groningers')));
 assert.ok(evidenceIssues(draft,['FC Twente speelt tegen Heerenveen.']).some(x=>x.includes('De Groningers')));
 assert.ok(evidenceIssues({...draft,headline:'De Amsterdammers treffen Heerenveen'},facts)
  .some(x=>x.includes('De Amsterdammers')));
});

test('104G: heropent uitsluitend exact bewezen en eerder afgewezen derby één keer vóór aftrap',t=>{
 const f={id:'sm-19714591',competition:'eredivisie',status:'NS',date:'2026-11-21T20:00:00Z',
  home:{name:'FC Groningen'},away:{name:'sc Heerenveen'}};
 const candidate={kind:'preview',topic:'FC Groningen – SC Heerenveen',category:'Eredivisie',
  fixture:f,kickoff:Date.parse(f.date),facts:[
    {text:'FC Groningen ontvangt sc Heerenveen.'},
    {text:'FC Groningen speelt de derby in eigen stadion.'},
    {text:'Thom van Bergen scoorde in vier thuiswedstrijden.'},
    {text:'De scheidsrechter is Alex Bos.'}
  ]};
 const group=Object.assign([{url:'https://www.fcgroningen.nl/nieuws/voorbeeld',title:candidate.topic}],{clubPreview:candidate});
 const now=Date.parse('2026-11-20T23:20:00Z');
 const hash='3572ce906db20d9827912a8193f831aab8a9989f6168dbca7942f1af1315940d';
 const job={clubPreviewId:f.id,status:'review',failureStage:'generation',
  failureCategory:'journalistic_rejection',reason:'insufficient_verified_facts',
  errorHash:hash,verifiedCoachNameRecovery104F:true,attempts:1,checkpoint:'afgekeurd'};
 assert.equal(reopenVerifiedClubDemonym104G({...job},group,now),false);
 const lib=require('../image-library49');
 const raw=require('../image-library49.json').assets.find(x=>x.id==='veldio104d-fcgroningen-night-preview');
 const synthetic={...raw,id:'synthetic-104-preview',manualReview115:undefined,brandingAudit115:require('../test-support/branding-fixture115')(raw.sha256)};
 const actual=lib.catalog();
 t.mock.method(lib,'catalog',()=>[...actual,synthetic]);
 assert.equal(reopenVerifiedClubDemonym104G(job,group,now),true);
 assert.equal(job.status,'pending');assert.equal(job.attempts,0);assert.equal(job.checkpoint,undefined);
 assert.equal(reopenVerifiedClubDemonym104G({...job,status:'review',failureStage:'generation',
  failureCategory:'journalistic_rejection',reason:'insufficient_verified_facts',errorHash:hash},group,now),false);
 const base={...job,clubDemonymRetry104G:false,status:'review',failureStage:'generation',
  failureCategory:'journalistic_rejection',reason:'insufficient_verified_facts',errorHash:hash};
 assert.equal(reopenVerifiedClubDemonym104G({...base,errorHash:'wrong'},group,now),false);
 assert.equal(reopenVerifiedClubDemonym104G({...base,verifiedCoachNameRecovery104F:false},group,now),false);
 assert.equal(reopenVerifiedClubDemonym104G(base,group,Date.parse(f.date)+1),false);
});
