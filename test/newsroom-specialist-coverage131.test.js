'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const S=require('../scripts/newsroom-specialists128');
const N=require('../scripts/ten-agent-newsroom101');
test('131 rotates only among relevant roles without changing urgent rumour and contradiction routing',()=>{
 const group={subject:'Ajax PSV contract'};
 const preferred=S.assign(group);
 assert.equal(preferred.owner,'tr-contract');
 const next=S.assign(group,{'tr-contract':5,'nl-ajax':3});
 assert.equal(next.owner,'nl-psv');
 assert.equal(S.assign({...group,rumour:true},{'tr-contract':5}).owner,preferred.owner);
 assert.equal(S.assign({...group,contradictory:true},{'inv-sources':5}).owner,'inv-sources');
 assert.equal(S.assign({subject:'Ajax'},{'nl-ajax':5}).owner,'nl-ajax');
});
test('131 counts observed model notes, not configured or assigned roles',()=>{
 const counts=S.activityFromNotes([
  {status:'analysis_only_unverified',deskAssignment:{owner:'nl-ajax',support:['nl-psv']}},
  {status:'provider_unavailable',deskAssignment:{owner:'nl-psv'}}
 ],{'nl-ajax':{attempts:3},'nl-az':{attempts:1}});
 assert.equal(counts['nl-ajax'],3);
 assert.equal(counts['nl-psv'],0);
 const report=S.activityReport(counts,[{subject:'PSV'}]);
 assert.equal(report.researchRoles,47);
 assert.equal(report.observedResearchers,2);
 assert.equal(report.remainingResearchers.length,45);
 assert.equal(report.remainingResearchers.find(r=>r.id==='nl-psv').matchedCurrentDossier,true);
 assert.equal(report.oversightMeasuredSeparately,true);
 assert.equal(report.oversightRoles.length,3);
});
test('131 rotated owner is actually used in model request',async()=>{
 let calls=0;
 const result=await N.analyzeWithAI({group:{subject:'Ajax PSV contract',sources:[],outlets:['vi','nos']},
 agent:N.AGENTS.find(a=>a.id==='ajax'),apiKey:'test',specialistActivity:{'tr-contract':3,'nl-ajax':2},
 fetcher:async(_url,options)=>{
  calls++;const body=JSON.parse(options.body);
  assert.match(body.messages[0].content,/Verantwoordelijke specialist: PSV/);
  return Response.json({choices:[{message:{content:JSON.stringify({angle:'Onderzoek de clubmelding',questions:['Welke onafhankelijke bron kan dit bevestigen?'],caution:'Nog onbevestigd.'})}}]});
 }});
 assert.equal(calls,1);
 assert.equal(result.deskAssignment.owner,'nl-psv');
 assert.equal(result.publicationAllowed,false);
});
