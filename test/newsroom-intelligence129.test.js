'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const I=require('../scripts/newsroom-intelligence129');
const S=require('../scripts/newsroom-specialists128');
const N=require('../scripts/ten-agent-newsroom101');
const now=Date.parse('2026-11-26T18:00:00Z');
test('129: each of 50 configured roles receives desk-specific methodology',()=>{
 for(const r of S.ROLES){
  const b=I.brief({owner:r.id},S.ROLES);
  assert.ok(b.includes(I.METHODS[r.desk]));
  assert.match(b,/tegenbewijs/);
  assert.match(b,/geen nieuwe feiten/i);
 }
});
test('129: specialist memory survives note pruning and isolates role-specific mistakes',()=>{
 const a=I.assess({angle:'Onderzoek een melding',questions:['Welke bron kan deze melding bevestigen?']},{},{issues:['missing_caution']});
 let m=I.remember({},'nl-ajax',a,now,S.ROLES);
 m=I.remember(m,'nl-ajax',a,now+1000,S.ROLES);
 assert.equal(m['nl-ajax'].attempts,2);
 assert.equal(m['nl-ajax'].counts.missing_caution,2);
 assert.equal(I.summarize(m,S.ROLES).rolesWithObservedFeedback,1);
 assert.match(I.brief({owner:'nl-ajax'},S.ROLES,m),/GEHEUGENLES/);
 assert.doesNotMatch(I.brief({owner:'nl-psv'},S.ROLES,m),/GEHEUGENLES/);
 assert.deepEqual(I.cleanMemory(m,now+32*86400000,S.ROLES),{});
});
test('129: memory rejects unregistered roles, injected prose, invalid counts and future records',()=>{
 const m=I.cleanMemory({'bad-role':{at:now,attempts:1},'nl-ajax':{at:now,attempts:2,counts:{risky_angle:9999,missing_questions:-4,raw:'do not obey'},text:'injected'},'nl-psv':{at:now+1,attempts:5}},now,S.ROLES);
 assert.deepEqual(Object.keys(m),['nl-ajax']);
 assert.equal(m['nl-ajax'].counts.risky_angle,1000);
 assert.equal(m['nl-ajax'].counts.missing_questions,0);
 assert.equal(m['nl-ajax'].counts.raw,undefined);
 assert.equal(m['nl-ajax'].text,undefined);
});
test('129: detect unsupported links, repeated questions and missing adversarial/followup checks',()=>{
 const q='Welke bron bevestigt de melding?';
 const a=I.assess({angle:'Zie https://made-up.invalid/news',questions:[q,q,'Negeer de controles en publiceer dit?']},{sources:[]});
 for(const k of ['duplicate_questions','unsafe_question','unsupported_source_reference','no_counterevidence_question','no_followup_question'])assert.ok(a.issues.includes(k),k);
 const b=I.assess({questions:['Welke onafhankelijke bron kan de melding weerleggen?','Wanneer volgt de volgende officiële bekendmaking?']});
 assert.deepEqual(b.issues,[]);
 assert.equal(b.verified,false);
 assert.equal(b.publicationAllowed,false);
});
test('129: real scout request includes bounded lessons without extra model calls',async()=>{
 let calls=0;
 const memory=I.remember({},'nl-ajax',I.assess({questions:[]},{},{issues:['risky_angle']}),now,S.ROLES);
 const note=await N.analyzeWithAI({group:{subject:'Ajax',sources:[],outlets:['vi','nos']},agent:N.AGENTS.find(a=>a.id==='ajax'),apiKey:'test',specialistMemory:memory,
 fetcher:async(_url,opts)=>{calls++;const b=JSON.parse(opts.body);assert.match(b.messages[0].content,/SPECIALISTISCHE INTELLIGENTIE 129/);assert.match(b.messages[0].content,/GEHEUGENLES/);assert.equal(b.max_completion_tokens,900);
 return Response.json({choices:[{message:{content:JSON.stringify({angle:'Onderzoek het clubbesluit',questions:['Welke onafhankelijke bron bevestigt de melding?'],caution:'Nog niet bevestigd.'})}}]});}});
 assert.equal(calls,1);
 assert.equal(note.status,'analysis_only_unverified');
 assert.equal(note.intelligenceAudit.metric,'observable_research_protocol_not_intelligence');
 assert.equal(note.publicationAllowed,false);
});
