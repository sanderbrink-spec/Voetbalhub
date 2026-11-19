'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const M=require('../editorial-desk-model');
const {createEditorialDraft,editorialAssignment}=require('../editorial-ai');
const {validateEvidence}=require('../scripts/automatic-publication');
const quality=require('../automatic-editorial.json');
const reply=value=>new Response(JSON.stringify({choices:[{message:{content:JSON.stringify(value)}}]}),{status:200});
const primaryUrl='https://www.ajax.nl/artikelen/contractbevestiging';
test('99C-3 verified short club decision uses 1-2 paragraphs even with four different details',()=>{
 const facts=[
  'Ajax bevestigt de overeenkomst met speler Lucas.',
  'Ajax meldt dat beide partijen de afspraak hebben ondertekend.',
  'De speler vervolgt zijn loopbaan bij Ajax.',
  'De club noemt de bevestiging in een officiële bekendmaking.'
 ];
 const payload={articleKind:'announcement',primaryAuthority:'club_decision',sources:[{url:primaryUrl}],verifiedFacts:facts};
 assert.equal(M.briefEligible(payload),true);
 const draft={headline:'Ajax bevestigt contractafspraak met speler Lucas',
  standfirst:'Ajax bevestigt de overeenkomst met speler Lucas en meldt de ondertekening door beide partijen.',
  body:['De club vermeldt dat beide betrokken partijen de afspraak hebben ondertekend. De bevestiging staat in de officiële clubmededeling.']};
 assert.deepEqual(M.draftIssues(draft,true),[]);
 assert.ok(M.draftIssues(draft,false).some(s=>s.includes('3 tot 5')));
 assert.equal(quality.qualityThreshold,85);
});
test('99C-3 complex trainer or staffing news cannot be forced into a two-paragraph brief',()=>{
 const facts=[
 'PEC Zwolle stelt Alex Pastoor aan als hoofdtrainer.',
 'De assistent-trainer keert terug naar de technische staf.',
 'De nieuwe coach werkte eerder bij een buitenlandse bond.',
 'Het bestuur motiveert de keuze.'
 ];
 const p={articleKind:'announcement',primaryAuthority:'club_decision',sources:[{url:'https://www.peczwolle.nl/nieuws/a'}],verifiedFacts:facts};
 assert.equal(M.briefEligible(p),false);
 assert.equal(M.briefEligible({...p,verifiedFacts:[...facts,'Extra loopbaaninformatie.']}),false);
 assert.equal(M.briefEligible({...p,primaryAuthority:null}),false);
 assert.equal(M.briefEligible({...p,transferStatus:'unconfirmed'}),false);
});
test('99C-3 writer reconsiders skip for two independent factual statements without creating new claims',async()=>{
 let calls=0;
 const facts=[
  'Ajax bevestigt dat speler Lucas zijn contract met de club heeft verlengd.',
  'De overeenkomst is door beide partijen in Amsterdam ondertekend.'
 ];
 const draft={headline:'Ajax bevestigt contractverlenging voor speler Lucas',
 standfirst:'Ajax bevestigt een contractverlenging voor speler Lucas. De club maakt de overeenkomst officieel bekend.',
 body:['Volgens Ajax is de overeenkomst in Amsterdam door beide partijen ondertekend. De club deelt dit mee als onderdeel van de officiële bevestiging.']};
 const finished=await createEditorialDraft({
  topic:'Ajax bevestigt contractverlenging van Lucas',category:'clubnieuws',
  facts,sourceUrls:[primaryUrl],articleKind:'announcement',
  primaryAuthority:'club_decision',compact:true,automaticPublication:true
 },{apiKey:'dummy',model:'openai/gpt-oss-120b',fetcher:async(_,options)=>{
  calls++;const data=JSON.parse(options.body);
  assert.deepEqual(JSON.parse(data.messages[1].content).facts,facts);
  return reply(calls===1?{skip:true}:draft);
 }});
 assert.equal(calls,2);
 assert.equal(finished.qualityReview.automatedTextChecksPassed,true);
 assert.equal(finished.qualityReview.autoPublish,false);
 assert.deepEqual(finished.body,draft.body);
});
test('99C-3 unrelated lone source and fabricated claim are still rejected',()=>{
 const url='https://www.ajax.nl/artikelen/eigen-mededeling';
 const text='Ajax bevestigt de contractverlenging van speler Lucas met een officiële mededeling op de eigen website.';
 const docs=[{url,title:'Ajax bevestigt contractverlenging',text,publishedAt:'2026-11-19T11:00:00Z'}];
 const fact={text,evidence:[{source:0,quote:text}]};
 const single={kind:'announcement',facts:[fact],sharedEventEvidence:[]};
 const issues=validateEvidence(single,docs,Date.parse('2026-11-19T12:00:00Z'));
 assert.ok(issues.some(s=>s.includes('Vier tot tien')||s.includes('twee onafhankelijke')));
 assert.ok(validateEvidence({...single,primaryAuthority:'club_decision',facts:[{...fact,text:'Ajax has won a fictional match with an unknown result.'}]},docs,Date.parse('2026-11-19T12:00:00Z')).includes('claim_evidence_mismatch'));
});
test('99C-3 repeated evidence is not treated as an invented background section',()=>{
 const x='Ajax bevestigt de overeenkomst met speler Lucas.';
 const plan=editorialAssignment([x,x,'De overeenkomst is officieel ondertekend.'],{compact:true});
 assert.deepEqual([...plan.leadFactIds,...plan.bodySections.flatMap(s=>s.factIds)].sort(),['F1','F3']);
});


test('99C-3 UEFA writer forms one supported news angle without invented Dutch involvement',async()=>{
 const facts=[
  'UEFA confirmed that Iceland earned promotion from its Nations League division.',
  'UEFA confirmed a separate promotion decision for another participating team.',
  'The official UEFA status overview confirms the placement of the promoted teams.',
  'The confirmed status concerns the current Nations League competition.',
  'UEFA lists the teams in separate divisions in its official decision.'
 ];
 const prompts=[];
 await assert.rejects(createEditorialDraft({
  topic:'UEFA confirms Nations League qualification',category:'Nations League',
  facts,sourceUrls:['https://www.uefa.com/uefanationsleague/news/02ab-example--quarter-final-qualification/'],
  articleKind:'announcement',primaryAuthority:'association_decision',
  compact:false,automaticPublication:true
 },{apiKey:'dummy',model:'openai/gpt-oss-120b',fetcher:async(_,options)=>{
  const request=JSON.parse(options.body);
  prompts.push(request.messages[0].content);
  return reply({skip:true});
 }}),/Onvoldoende gecontroleerde feiten/);
 assert.equal(prompts.length,2);
 assert.match(prompts[0],/geen Nederlands belang of Nederlandse ploeg/i);
 assert.match(prompts[0],/Een groepstand is geen bewijs voor een wedstrijduitslag/);
 assert.match(prompts[0],/één actuele UEFA-beslissing/);
});
test('99C-3 rejected UEFA review retries a coherent source-scoped story, never a guessed Dutch team',async()=>{
 const {reviseDraft}=require('../scripts/automatic-publication');
 const facts=[
  'UEFA confirmed that Iceland earned promotion to a higher Nations League division.',
  'UEFA confirmed that the group leaders qualified for the next competition stage.',
  'UEFA confirmed qualification for another participating country.',
  'UEFA separately confirmed a qualification place for a third participating country.',
  'UEFA published the official overview of the current qualifying decisions.'
 ];
 const source='https://www.uefa.com/uefanationsleague/news/02ab-verified--nations-league-quarter-finals-last-eight-confirmed/';
 const draft={headline:'UEFA bevestigt de nieuwe kwalificaties voor landen in Nations League',
  standfirst:'De UEFA heeft officiële beslissingen over kwalificatie en promotie binnen de Nations League bekendgemaakt.',
  body:[
   'De organisatie bevestigt de promotie van IJsland naar een hoger niveau binnen het toernooi.',
   'Het officiële overzicht legt daarnaast de kwalificatie van de groepsleiders vast.',
   'Ook de andere kwalificatieplaatsen worden afzonderlijk bevestigd in het besluit.'
  ]};
 const payload={articleKind:'announcement',draft,verifiedFacts:facts,
  primaryAuthority:'association_decision',sources:[{url:source}]};
 const candidate={kind:'announcement',category:'Nations League',
  topic:'Nations League quarter-finals: Last eight confirmed',
  primaryAuthority:'association_decision'};
 let prompt='';
 const result=await reviseDraft(payload,candidate,[{url:source,title:'Official UEFA status overview',text:facts.join(' '),publishedAt:'2026-11-19T10:00:00Z'}],
  'Journalistieke kwaliteit lager dan 85.',{router:{complete:async(messages,options)=>{
   assert.equal(options.task,'revision');
   prompt=messages[0].content;
   return {skip:true};
  }}},[],{dimensions:{journalism:75,reliability:95}});
 assert.equal(result,null);
 assert.match(prompt,/Nederlandstalig betekent niet dat het Nederlands elftal betrokken is/);
 assert.match(prompt,/geen reeks losse standen of losstaande landen/);
 assert.match(prompt,/alleen verifiedFacts zijn bewijs/);
});
