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
