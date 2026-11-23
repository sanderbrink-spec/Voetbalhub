'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const T=require('../scripts/newsroom-training112');
const N=require('../scripts/ten-agent-newsroom101');

const simpleGroup=(agentId,extra={})=>({
 id:'exercise-'+agentId,agents:[agentId],outlets:['vi','vp'],
 sources:[
  {publisher:'vi',title:'PSV meldt selectie-update',url:'https://www.vi.nl/nieuws/test'},
  {publisher:'vp',title:'PSV meldt selectie-update',url:'https://www.voetbalprimeur.nl/nieuws/test'}
 ],rumour:false,contradictory:false,...extra
});
const goodNote={
 angle:'Onderzoek welke officiële bronnen deze voetbalontwikkeling onderbouwen.',
 questions:['Welke club of bond heeft dit zelf bevestigd?'],
 caution:'Alleen mediaberichten, onafhankelijke broncontrole ontbreekt.'
};

test('112: all ten existing journalists have distinct, complete training profiles',()=>{
 assert.equal(N.AGENTS.length,10);
 assert.deepEqual(new Set(N.AGENTS.map(a=>a.id)),new Set(T.IDS));
 const report=T.coverage(N.AGENTS);
 assert.equal(report.profiles,10);
 assert.equal(report.configuredProfiles,10);
 assert.equal(report.validUniqueProfiles,true);
 assert.equal(report.extraAiCalls,0);
 assert.equal(report.modelFineTuned,false);
 assert.equal(report.actualJournalisticQualityMeasured,false);
 assert.ok(report.commonSkillProtocols>=9);
 assert.equal(report.perProfileSafetyChecks.length,10);
 for(const agent of N.AGENTS){
  const p=T.PROFILES[agent.id];
  assert.ok(p.name&&p.focus&&p.trap);
  assert.ok(p.checks.length>=3);
  assert.ok(p.questions.length>=2);
  const guide=T.specialistBrief(agent,simpleGroup(agent.id));
  assert.match(guide,new RegExp(p.name.replace(/[.*+?^\u0024{}()|[\]\\]/g,'\\$&')));
  assert.ok(guide.includes(p.trap));
  assert.match(guide,/BRON|BEWIJS|HERKOMST/);
  assert.match(guide,/onbetrouwbare data/i);
  assert.match(guide,/Publiceren.*verboden/i);
  assert.match(guide,/niet automatisch gerucht noemen/i);
  assert.ok(guide.includes(p.checks[0]));
 }
 assert.throws(()=>T.specialistBrief({id:'onbekend'}),/Onbekende journalist/);
});
test('112: specialized reasoning and counterevidence are different across ten roles',()=>{
 const expected={
  groningen:/FC Groningen/,
  psv:/PSV/,
  ajax:/Jong Ajax|jeugdteams/,
  feyenoord:/Rotterdam|Feyenoord/,
  aztwente:/AZ Alkmaar en FC Twente/,
  eredivisie:/ranglijst|speeldag/,
  internationals:/UEFA|KNVB/,
  transfers:/persoonlijk akkoord|clubakkoord/,
  geruchten:/anonieme bron|anonieme/,
  achtergrond:/historische wedstrijden|historisch/
 };
 for(const [id,pattern] of Object.entries(expected))
  assert.match(T.specialistBrief({id},simpleGroup(id)),pattern);
 const rumor=T.specialistBrief({id:'transfers'},simpleGroup('transfers',{rumour:true,contradictory:true}));
 assert.match(rumor,/ONBEVESTIGD/);
 assert.match(rumor,/handelingswoorden/);
});
test('112: research-note audit grades only prompt compliance, never actual journalism or source verification',()=>{
 const pass=T.assessNote(goodNote,simpleGroup('groningen'));
 assert.equal(pass.formatScore,100);
 assert.deepEqual(pass.issues,[]);
 assert.equal(pass.externalCorroborationVerified,false);
 assert.equal(pass.originalReporterIndependenceVerified,false);
 assert.equal(pass.trainingBasedPublicationAllowed,false);
 assert.match(pass.metric,/not_journalistic_skill/);
 const bad=T.assessNote({
  angle:'PSV heeft definitief getekend',
  questions:[],caution:'nvt'
 },simpleGroup('transfers',{rumour:true}));
 assert.ok(bad.issues.includes('risky_angle'));
 assert.ok(bad.issues.includes('missing_questions'));
 assert.ok(bad.issues.includes('missing_caution'));
 assert.ok(bad.formatScore<100);
});
test('112: feedback micro-lesson is based on recorded protocol gaps, never invented learning',()=>{
 assert.match(T.nextLesson(),/FEEDBACKLES/);
 assert.match(T.nextLesson([{trainingAudit:{issues:['missing_questions']}}]),/vraagteken/);
 assert.match(T.nextLesson([{trainingAudit:{issues:['missing_caution']}}]),/onzeker/);
 assert.match(T.nextLesson([{trainingAudit:{issues:['risky_angle']}}]),/stellige/);
});
test('112: specialist routing uses roles rather than always choosing transfer/rumour agent',()=>{
 const g=N.assignAgents('Ajax meldt nieuwe jeugdtrainer');
 assert.equal(N.chooseResearchAgent({agents:g.agentIds,rumour:false}).id,'ajax');
 assert.equal(N.chooseResearchAgent({agents:['groningen','geruchten'],rumour:false}).id,'groningen');
 assert.equal(N.chooseResearchAgent({agents:['transfers','geruchten'],rumour:true}).id,'transfers');
 assert.equal(N.chooseResearchAgent({agents:['transfers','geruchten'],rumour:true,contradictory:true}).id,'geruchten');
 assert.equal(N.chooseResearchAgent({agents:['achtergrond'],rumour:false}).id,'achtergrond');
 assert.equal(N.chooseResearchAgent({agents:['unknown']}),null);
});
test('112: each journalist receives training in the current existing AI request, never as extra request',async()=>{
 for(const agent of N.AGENTS){
  let calls=0;
  const group=simpleGroup(agent.id);
  const note=await N.analyzeWithAI({
   group,agent,apiKey:'test',
   priorNotes:[{trainingAudit:{issues:['missing_questions']}}],
   fetcher:async(url,opts)=>{
    calls++;
    assert.equal(url,'https://api.groq.com/openai/v1/chat/completions');
    const request=JSON.parse(opts.body);
    assert.equal(request.model,'openai/gpt-oss-120b');
    assert.equal(request.max_completion_tokens,900);
    assert.equal(request.messages.length,2);
    assert.match(request.messages[0].content,new RegExp(agent.name));
    assert.ok(request.messages[0].content.includes(T.PROFILES[agent.id].trap));
    assert.match(request.messages[0].content,/FEEDBACKLES/);
    assert.match(request.messages[0].content,/vraagteken/);
    assert.ok(!request.messages[1].content.includes('trainingAudit'));
    return Response.json({choices:[{message:{content:JSON.stringify(goodNote)}}]});
   }
  });
  assert.equal(calls,1);
  assert.equal(note.status,'analysis_only_unverified');
  assert.equal(note.verified,false);
  assert.equal(note.publicationAllowed,false);
  assert.equal(note.draft,null);
  assert.equal(note.trainingAudit.formatScore,100);
 }
});
test('112: unsupported absolute claims are quarantined, never presented as research conclusions',async()=>{
 const group=simpleGroup('transfers',{rumour:true});
 const agent=N.AGENTS.find(a=>a.id==='transfers');
 const note=await N.analyzeWithAI({
  group,agent,apiKey:'test',
  fetcher:async()=>Response.json({choices:[{message:{content:JSON.stringify({
   angle:'PSV heeft definitief getekend',questions:[],
   caution:'Niet bekend',
   draft:{headline:'Gerucht: PSV toont interesse',
    standfirst:'Volgens Voetbal International en VoetbalPrimeur is de transfer niet bevestigd.',
    body:['De berichtgeving is onbevestigd.']}
  })}}]})
 });
 assert.match(note.angle,/Stellige AI-claim is niet bewezen/);
 assert.equal(note.draft,null);
 assert.ok(note.trainingAudit.issues.includes('risky_angle'));
 assert.equal(note.publicationAllowed,false);
});
test('112: monitoring produces full training coverage at zero model calls in offline run',async()=>{
 let calls=0;
 const now=Date.parse('2026-11-23T09:10:00Z');
 const rss='<rss version="2.0"><channel><item><title>Ajax bevestigt benoeming jeugdtrainer</title><link>https://www.vi.nl/nieuws/jeugdtrainer</link><pubDate>Mon, 23 Nov 2026 09:00:00 GMT</pubDate></item></channel></rss>';
 const result=await N.scan({now,runAI:false,fetcher:async url=>{
  calls++;return new Response(url.includes('vi.nl')?rss:'<rss version="2.0"><channel></channel></rss>');
 }});
 assert.equal(calls,3);
 assert.equal(result.report.aiCalls,0);
 assert.equal(result.report.training.validUniqueProfiles,true);
 assert.equal(result.report.training.configuredProfiles,10);
 assert.equal(result.report.training.extraAiCalls,0);
 assert.equal(result.report.trainingAudits.length,0);
 assert.equal(result.report.published,0);
});
