'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {reviseDraft}=require('../scripts/automatic-publication');
const M=require('../editorial-desk-model');

const source='https://www.uefa.com/uefanationsleague/news/02ab-synthetic-fixture--last-eight-confirmed/';
const facts=[
 'Group A1 Fictionland (13pts), Northland (12), Otherland (5), Elsewhere (0)',
 'Fictionland are confirmed in first place and have qualified for the quarter-finals.',
 'Northland are confirmed in second place and have qualified for the quarter-finals.',
 'Group A2 Germany (11pts), Netherlands (11), Greece (11), Elsewhere (0)',
 'Germany are confirmed in first place and have qualified for the quarter-finals.',
 'Netherlands are confirmed in second place and have qualified for the quarter-finals.',
 'Group A3 Eastland (15pts), Westland (12), Southland (6), Somewhere (0)',
 'Eastland are confirmed in first place and have qualified for the quarter-finals.',
 'Group A4 Coastland (15pts), Valleyland (9), Mountainland (9), Plainland (3)',
 'The top two teams in each League A group advance to the quarter-finals in March.'
];
const candidate={kind:'announcement',category:'Nations League',
 topic:'Synthetic UEFA quarter-final qualification status',primaryAuthority:'association_decision'};
const docs=[{url:source,title:'Synthetic status source (test only)',publishedAt:'2026-11-19T11:00:00Z',text:facts.join(' ')}];
const draft={headline:'UEFA bevestigt status van ploegen voor de kwartfinales',
 standfirst:'De bond heeft de plaatsen in de kwartfinales van de competitie bekendgemaakt.',
 body:['In groep A2 staan de ploegen in de aangeleverde tabel.', 'Een ander gecontroleerd detail beschrijft het vervolg van de competitie.']};

test('99C-3: independent UEFA rewrite retains chosen 1-2 paragraph form and keeps literal evidence rule',async()=>{
 const payload={articleKind:'announcement',primaryAuthority:'association_decision',
  draft,verifiedFacts:facts,sources:[{url:source}]};
 assert.equal(M.briefEligible(payload),true);
 let prompt='',received;
 const revised=await reviseDraft(payload,candidate,docs,'Journalistieke kwaliteit lager dan 85.',
  {router:{complete:async messages=>{prompt=messages[0].content;received=JSON.parse(messages[1].content);return {skip:true};}}},
  [],{dimensions:{journalism:75,reliability:100}});
 assert.equal(revised,null);
 assert.match(prompt,/één of twee inhoudelijk verschillende bodyalinea.s van 10-65 woorden/);
 assert.match(prompt,/Herhaal geen groepswinnaar of kwalificatie die al in de intro staat/);
 assert.match(prompt,/Iedere claim moet worden gedragen door verifiedFacts/);
 assert.match(prompt,/alleen verifiedFacts zijn bewijs/);
 assert.doesNotMatch(prompt,/PRECIES drie bodyalinea.s/);
 assert.deepEqual(received.previousDraft,draft);
 assert.match(prompt,/eerdere concept is uitsluitend een te redigeren manuscript/);
 assert.match(prompt,/Controleer elke behouden zin opnieuw tegen verifiedFacts/);
});

test('99C-3: absence of official table confirmation does not grant compact form',()=>{
 const payload={articleKind:'announcement',primaryAuthority:'association_decision',
  draft,verifiedFacts:facts.filter(f=>!/^Group A[1-4]/.test(f)),sources:[{url:source}]};
 assert.equal(M.briefEligible(payload),false);
});


test('99C-5: unreliable UEFA drafts cannot be treated as a trustworthy manuscript',async()=>{
 const payload={articleKind:'announcement',primaryAuthority:'association_decision',
  draft,verifiedFacts:facts,sources:[{url:source}]};
 let received,prompt;
 await reviseDraft(payload,candidate,docs,'Betrouwbaarheid lager dan 90.',
  {router:{complete:async messages=>{
   prompt=messages[0].content;
   received=JSON.parse(messages[1].content);
   return {skip:true};
  }}},[],{dimensions:{journalism:75,reliability:75}});
 assert.ok(!Object.hasOwn(received,'previousDraft'));
 assert.doesNotMatch(prompt,/eerdere concept is uitsluitend een te redigeren manuscript/);
});
