'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const {oranjeDrawGroup}=require('../scripts/editorial-oranje-draw');
const {drawWritingBrief}=require('../scripts/editorial-draw-copy339');
const {validateEvidence,reopenVerifiedDrawDepth345,reviseDraft}=require('../scripts/automatic-publication');
const {createEditorialDraft}=require('../editorial-ai');
const M=require('../editorial-desk-model');

const now=Date.parse('2026-11-20T18:20:00Z');
const knvb={url:'https://www.onsoranje.nl/nieuws/nederlands-elftal-mannen/82847/oranje-tegen-portugal-kwartfinale-nations-league',
 title:'Oranje tegen Portugal in kwartfinale Nations League',publishedAt:'2026-11-20T11:45:00Z',
 text:['Oranje speelt in de kwartfinale van de Nations League twee keer tegen Portugal.',
 'Dat werd vrijdag bepaald tijdens de loting in Nyon, Zwitserland.',
 'De wedstrijden vinden in maart plaats.',
 'De eerste wedstrijd is in Nederland, de return wordt gespeeld in Portugal.',
 'In een eventuele halve finale treft Oranje de winnaar van het duel tussen Spanje en Frankrijk.'].join(' ')
};
const uefa={url:'https://www.uefa.com/uefanationsleague/news/02ab-221d9e23448d-d862e943f6f2-1000--uefa-nations-league-quarter-final-and-play-off-ties-spain-vs/',
 title:'UEFA Nations League knockout draw',publishedAt:'2026-11-20T11:45:00Z',
 text:["Spain will meet France while the Netherlands take on titleholders Portugal in March's UEFA Nations League quarter-finals.",
 'Knockout stage draw results Quarter-final ties Spain vs France Norway vs England Netherlands vs Portugal Belgium vs Germany The quarter-finals are two-legged ties and take place in March 2027.',
 'Winners advance to the Nations League finals.'].join(' ')
};
const profile={url:'https://www.uefa.com/uefanationsleague/news/02ab-2219b45e1aa6-7834fde41ea1-1000--2026-27-nations-league-quarter-finals-get-to-know-the-eight-/',
 title:'2026/27 Nations League quarter-finals: Get to know the eight contenders',
 publishedAt:'2026-11-18T07:00:00Z',
 text:['Get to know the eight contenders.',
  'Netherlands Denzel Dumfries and Donyell Malen celebrate on Matchday 5 How they qualified: Group A2 runners-up Best Nations League performance: Runners-up (2018/19) Coach: Xavi Hernández',
  'Portugal All smiles for Portugal during their win in Wales How they qualified: Group A4 winners Best Nations League performance: Winners (2018/19, 2024/25) Coach: Jorge Jesus'
 ].join(' ')
};
const group=oranjeDrawGroup(knvb,[uefa,profile],now);
test('345: three real official pages create ten verified facts and three distinct themes',()=>{
 assert.equal(group?.length,3);
 assert.equal(group.drawCandidate.facts.length,10);
 assert.deepEqual(validateEvidence(group.drawCandidate,group,now),[]);
 assert.equal(group.drawCandidate.facts.filter(x=>x.evidence[0].source===2).length,2);
 const facts=group.drawCandidate.facts.map(f=>f.text);
 const brief=drawWritingBrief(facts);
 assert.ok(brief?.plan?.alinea3);
 assert.equal(brief.factCards.length,10);
 assert.match(brief.factCards.find(x=>x.role==='Nederlandse groepsfase').gegeven,/groep A2/);
 assert.match(brief.factCards.find(x=>x.role==='Portugese groepsfase').gegeven,/groep A4/);
 assert.deepEqual(brief.factCards.find(x=>x.role==='Portugese groepsfase').nationsLeagueTitels,['2018/19','2024/25']);
 assert.deepEqual(brief.plan.alinea1,['F9','F10']);
 assert.equal(M.briefEligible({articleKind:'announcement',verifiedFacts:facts,sources:group.map(x=>({url:x.url})),verifiedDrawBrief:true}),false);
 for(const fact of facts)assert.ok(!JSON.stringify(brief).includes(fact));
});
test('345: missing or untrusted team profile never silently creates sports history',()=>{
 const noProfile=oranjeDrawGroup(knvb,[uefa],now);
 assert.equal(noProfile.length,2);
 assert.equal(noProfile.drawCandidate.facts.length,8);
 const fake=oranjeDrawGroup(knvb,[uefa,{...profile,url:'https://bad.example.com/not-uefa'}],now);
 assert.equal(fake.length,2);
 const conflict=oranjeDrawGroup(knvb,[uefa,{...profile,text:profile.text.replace('Group A4 winners','Group A4 runners-up')}],now);
 assert.equal(conflict.length,2);
});
test('345: generation and revising use three paragraphs while keeping source quotes out',async()=>{
 const facts=group.drawCandidate.facts.map(f=>f.text),drawBrief=drawWritingBrief(facts);
 const sources=group.map(x=>({url:x.url}));
 let seen;
 await assert.rejects(createEditorialDraft({topic:knvb.title,category:'Nations League',facts,
  sourceUrls:sources.map(x=>x.url),articleKind:'announcement',automaticPublication:true,
  compact:false,drawBrief},{model:'openai/gpt-oss-120b',router:{complete:async messages=>{
   seen=messages;return {skip:true};
  }}}),/Onvoldoende gecontroleerde feiten/);
 assert.match(seen[0].content,/PRECIES drie/);
 assert.doesNotMatch(JSON.stringify(seen[1]),/How they qualified: Group A2 runners-up/);
 assert.equal(JSON.parse(seen[1].content).drawBrief.factCards.length,10);
 let revisedSystem='';
 const revised=await reviseDraft({draft:{headline:'Oud concept',standfirst:'Oud',body:['Oud']},verifiedFacts:facts,
  verifiedDrawBrief:true,articleKind:'announcement',sources},group.drawCandidate,group,
  'Journalistieke kwaliteit lager dan 85.',{router:{complete:async messages=>{revisedSystem=messages[0].content;return {skip:true};}}});
 assert.equal(revised,null);
 assert.match(revisedSystem,/PRECIES drie/);
});
test('345: one old two-source rejection may be revived only with new verified third-page evidence',()=>{
 const error='Kwaliteitscontrole na 3 herschrijvingen: Journalistieke kwaliteit lager dan 85.';
 const sha=crypto.createHash('sha256').update(error).digest('hex');
 const job=()=>({status:'review',failureStage:'quality',failureCategory:'journalistic_rejection',
  errorHash:sha,urls:[knvb.url,uefa.url],checkpoint:{oldCopy:true}});
 const j=job();
 assert.equal(reopenVerifiedDrawDepth345(j,group,now),true);
 assert.equal(j.drawDepthRecovery345,true);
 assert.equal(j.checkpoint,undefined);
 assert.equal(reopenVerifiedDrawDepth345(j,group,now),false);
 assert.equal(reopenVerifiedDrawDepth345({...job(),errorHash:'0'.repeat(64)},group,now),false);
 assert.equal(reopenVerifiedDrawDepth345({...job(),status:'published'},group,now),false);
 assert.equal(reopenVerifiedDrawDepth345(job(),group,now+72*3600000),false);
 const corrupt=[group[0],group[1],{...group[2],text:'Geen profielbewijs'}];
 corrupt.drawCandidate=group.drawCandidate;
 assert.equal(reopenVerifiedDrawDepth345(job(),corrupt,now),false);
});
