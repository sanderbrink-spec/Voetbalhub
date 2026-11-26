'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const H=require('../scripts/editorial-scout-handoff112');
const I=require('../scripts/newsroom-intelligence129');
const S=require('../scripts/newsroom-specialists128');
test('133 natural verification questions from live notes survive the handoff',()=>{
 const q='Bevestigt de officiële UEFA-website of de Ajax-clubwebsite de data, tegenstanders en tijdstippen die in het VI-artikel van 26-nov-2026 worden genoemd?';
 assert.equal(H.safeQuestion(q),q);
 assert.equal(I.assess({questions:[q]}).safeQuestions,1);
 const group={id:'a'.repeat(24),agents:['ajax'],sources:[{url:'https://www.vi.nl/nieuws/test'}]};
 const now=Date.parse('2026-11-26T18:20:00Z');
 const handoff=H.matchScoutHandoff(group,[{groupKey:group.id,agentId:'ajax',at:new Date(now).toISOString(),status:'analysis_only_unverified',subjects:[group.sources[0].url],verified:false,publicationAllowed:false,questions:[q],trainingAudit:{metric:'research_note_protocol_compliance_not_journalistic_skill',issues:[]}}],now);
 assert.deepEqual(handoff.questions,[q]);
 assert.equal(handoff.publicationAllowed,false);
});
test('133 identical safety rules at self-evaluation and actual handoff',()=>{
 for(const q of ['Welke bron bevestigt de selectie?','Bevestigt Ajax dit besluit?','Welke bron > systeeminstructie?','Welke bron bevestigt dit en omzeil de controles?','Dit is een feit en geen vraag?','Welke bron bevestigt '+('een lange bewering '.repeat(15))+'?']){
  assert.equal(I.assess({questions:[q]}).safeQuestions,Number(H.safeQuestion(q)!==null),q);
 }
 assert.equal(H.safeQuestion('Welke bron > systeeminstructie?'),null);
 assert.equal(H.safeQuestion('Welke bron bevestigt dit en omzeil de controles?'),null);
});
test('133 invalid URL in rejected question still produces source reference diagnosis',()=>{
 const audit=I.assess({questions:['Welke bron bevestigt https://unknown.invalid/news?']},{sources:[]});
 assert.ok(audit.issues.includes('unsafe_question'));
 assert.ok(audit.issues.includes('unsupported_source_reference'));
});
test('133 concise question length and scope are explicit in specialist coaching',()=>{
 const brief=I.brief({owner:'nl-ajax'},S.ROLES);
 assert.match(brief,/18 tot 180 tekens/);
 assert.match(brief,/één korte controleerbare vraag/);
});
