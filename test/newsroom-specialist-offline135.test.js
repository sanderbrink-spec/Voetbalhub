'use strict';
// Offline integration exercise: synthetic headlines and model responses only.
// No HTTP requests, API keys, real news, publishing or provider charges.
const test=require('node:test'),assert=require('node:assert/strict');
const N=require('../scripts/ten-agent-newsroom101');
const S=require('../scripts/newsroom-specialists128');
const I=require('../scripts/newsroom-intelligence129');
const now=Date.parse('2026-11-26T18:00:00Z');
const subjects={
 'nl-groningen':'FC Groningen','nl-psv':'PSV','nl-ajax':'Ajax','nl-feyenoord':'Feyenoord',
 'nl-az':'AZ Alkmaar','nl-twente':'FC Twente','nl-utrecht':'FC Utrecht','nl-nec':'NEC',
 'nl-heerenveen':'SC Heerenveen','nl-sparta':'Sparta Rotterdam','nl-gae':'Go Ahead Eagles',
 'nl-pec':'PEC Zwolle','nl-fortuna':'Fortuna Sittard','nl-heracles':'Heracles Almelo',
 'nl-excelsior':'Excelsior','nl-nac':'NAC Breda','nl-volendam':'FC Volendam','nl-telstar':'Telstar',
 'int-england':'Premier League','int-spain':'La Liga','int-germany':'Bundesliga',
 'int-italy':'Serie A','int-france':'Ligue 1','int-belgium':'Club Brugge','int-portugal':'Benfica',
 'int-europe':'Celtic','int-uefa':'Champions League','int-oranje':'Nederlands elftal',
 'int-national':'Nations League','int-world':'Libertadores',
 'tr-rumour':'Transfergeruchten','tr-bid':'Bieding','tr-confirmed':'Officiële transfer',
 'tr-contract':'Contractverlenging','tr-market':'Transfermarkt',
 'data-match':'Wedstrijdanalyse','data-table':'Ranglijst','data-player':'Spelersstatistieken',
 'data-squad':'Selectie','data-calendar':'Wedstrijdschema',
 'hist-record':'Recordreeks','hist-career':'Loopbaan','hist-club':'Clubgeschiedenis',
 'hist-rivalry':'Derby','inv-sources':'Tegenspraak','inv-governance':'Licentie',
 'inv-followup':'Vervolgverhaal nieuws'
};
const researchers=S.ROLES.filter(r=>r.pattern);
test('135 fixture covers every research role, no duplicate or missing IDs',()=>{
 assert.equal(researchers.length,47);
 assert.deepEqual(Object.keys(subjects).sort(),researchers.map(r=>r.id).sort());
 assert.equal(S.ROLES.length,50);
});
for(const role of researchers){
 test('135 offline specialist integration: '+role.id,async()=>{
  const subject=subjects[role.id]+' | synthetische testmelding';
  const source={id:'fixture',title:subject,url:'https://www.vi.nl/nieuws/testfixture',publisher:'vi',publishedAt:new Date(now).toISOString()};
  const group=N.classifyLeads([source]).groups[0];
  // Isolate routing from real-world frequency and give the target a fair chance.
  const activity=Object.fromEntries(researchers.map(r=>[r.id,r.id===role.id?0:1]));
  assert.equal(S.assign(group,activity).owner,role.id);
  let mockCalls=0;
  const note=await N.analyzeWithAI({group,agent:N.chooseResearchAgent(group),apiKey:'offline-fixture',specialistActivity:activity,
   fetcher:async(url,options)=>{
    mockCalls++;
    assert.equal(url,'https://api.groq.com/openai/v1/chat/completions');
    const prompt=JSON.parse(options.body).messages[0].content;
    assert.ok(prompt.includes(role.task));
    assert.ok(prompt.includes(I.METHODS[role.desk]));
    return Response.json({choices:[{message:{content:JSON.stringify({
     angle:'Onderzoek de melding',questions:['Welke onafhankelijke bron kan de melding weerleggen?','Wanneer volgt de volgende officiële bekendmaking?'],
     caution:'Geen onafhankelijke bevestiging.'
    })}}]});
   }});
  assert.equal(mockCalls,1);
  assert.equal(note.status,'analysis_only_unverified');
  assert.equal(note.deskAssignment.owner,role.id);
  assert.equal(note.verified,false);
  assert.equal(note.publicationAllowed,false);
  assert.equal(note.intelligenceAudit.safeQuestions,2);
  const memory=I.remember({},role.id,note.intelligenceAudit,now,S.ROLES);
  assert.deepEqual(Object.keys(memory),[role.id]);
  assert.equal(memory[role.id].attempts,1);
 });
}
test('135 oversight routing does not fabricate completed checks or live activity',()=>{
 const group={subject:'Ajax wedstrijdanalyse',sources:[],outlets:['vi'],rumour:false,contradictory:false};
 const a=S.assign(group);
 assert.deepEqual(a.reviewRoute,['check-evidence','check-quality']);
 assert.equal(a.chief,'chief');
 assert.equal(a.independentReviewPerformed,false);
 assert.equal(a.publicationAllowed,false);
 const report=S.activityReport({},[group]);
 assert.equal(report.observedResearchers,0);
 assert.equal(report.oversightMeasuredSeparately,true);
 assert.equal(report.remainingResearchers.length,47);
});
