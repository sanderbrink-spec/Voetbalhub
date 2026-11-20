'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const {repairVerifiedDrawStyle,generationIssues}=require('../editorial-ai');
const {drawWritingBrief}=require('../scripts/editorial-draw-copy339');
const {oranjeDrawGroup}=require('../scripts/editorial-oranje-draw');
const {reopenVerifiedDrawName344}=require('../scripts/automatic-publication');

const now=Date.parse('2026-11-20T18:40:00Z');
const knvb={
 url:'https://www.onsoranje.nl/nieuws/nederlands-elftal-mannen/82847/oranje-tegen-portugal-kwartfinale-nations-league',
 title:'Oranje tegen Portugal in kwartfinale Nations League',publishedAt:'2026-11-20T11:45:00Z',
 text:[
  'Oranje speelt in de kwartfinale van de Nations League twee keer tegen Portugal.',
  'Dat werd vrijdag bepaald tijdens de loting in Nyon, Zwitserland.',
  'De wedstrijden vinden in maart plaats.',
  'De eerste wedstrijd is in Nederland, de return wordt gespeeld in Portugal.',
  'In een eventuele halve finale treft Oranje de winnaar van het duel tussen Spanje en Frankrijk.'
 ].join(' ')
};
const uefa={
 url:'https://www.uefa.com/uefanationsleague/news/02ab-221d9e23448d-d862e943f6f2-1000--uefa-nations-league-quarter-final-and-play-off-ties-spain-vs/',
 title:'UEFA Nations League knockout draw',publishedAt:'2026-11-20T11:45:00Z',
 text:[
  "Spain will meet France while the Netherlands take on titleholders Portugal in March's UEFA Nations League quarter-finals.",
  'Knockout stage draw results Quarter-final ties Spain vs France Norway vs England Netherlands vs Portugal Belgium vs Germany The quarter-finals are two-legged ties and take place in March 2027.',
  'Winners advance to the Nations League finals.'
 ].join(' ')
};
const group=oranjeDrawGroup(knvb,[uefa],now);
const brief=drawWritingBrief(group.drawCandidate.facts.map(f=>f.text));
const draft={
 headline:'Oranje treft Portugal in kwartfinale Nations League',
 standfirst:'De officiële loting bevestigt dat Oranje in de kwartfinale van de Nations League tegen de regerend kampioen Portugal speelt.',
 body:[
  'Het eerste duel wordt in Nederland gespeeld, de terugwedstrijd in Portugal, beide gepland voor maart 2027 als een twee‑legige confrontatie volgens de UEFA‑kalender.',
  'De loting vond vrijdag plaats in Nyon, Zwitserland; de winnaar van deze kwartfinale plaatst zich voor de Nations League-finaleronde en, bij een halve‑finale, ontmoet de winnaar van Spanje‑Frankrijk.'
 ]
};
test('344: exact production rejection becomes ordinary proven Dutch tournament phrase',()=>{
 const fixed=repairVerifiedDrawStyle(draft,brief);
 assert.match(fixed.body[0],/als een tweeluik/);
 assert.match(fixed.body[1],/voor de finaleronde van de Nations League/);
 assert.doesNotMatch(fixed.body.join(' '),/Nations League-finaleronde|twee‑legige/);
 assert.equal(fixed.headline,draft.headline);
 assert.equal(fixed.standfirst,draft.standfirst);
 const issues=generationIssues(fixed,group.drawCandidate.facts.map(f=>f.text),null,true,'','announcement');
 assert.ok(!issues.some(x=>x.includes('Nations League-finaleronde')),issues.join('; '));
});
test('344: without independently source-backed fact cards, no automatic rewrite',()=>{
 assert.equal(repairVerifiedDrawStyle(draft,null),draft);
 const incomplete={factCards:brief.factCards.filter(card=>!['sportief toernooigevolg','officiële UEFA-speelperiode'].includes(card.role))};
 assert.equal(repairVerifiedDrawStyle(draft,incomplete),draft);
 const changed={...draft,body:[...draft.body,'Onbewezen uitkomst: Oranje wint met 3-0.']};
 const fixed=repairVerifiedDrawStyle(changed,brief);
 assert.ok(fixed.body[2].includes('3-0'),'unproven results must not be repaired away');
});
test('344: only recorded false-name failure gets one audited queue retry',()=>{
 const error='Concept na herstel nog niet geschikt: Controleer namen die niet in de aangeleverde feiten staan: Nations League-finaleronde.';
 const hash=crypto.createHash('sha256').update(error).digest('hex');
 const job=()=>({status:'review',failureStage:'generation',failureCategory:'generator_failure',
  errorHash:hash,urls:[knvb.url,uefa.url],checkpoint:{rejectedDraft:true}});
 const j=job();
 assert.equal(reopenVerifiedDrawName344(j,group,now),true);
 assert.equal(j.status,'pending');
 assert.equal(j.checkpoint,undefined);
 assert.equal(reopenVerifiedDrawName344(j,group,now),false);
 assert.equal(reopenVerifiedDrawName344({...job(),errorHash:'0'.repeat(64)},group,now),false);
 assert.equal(reopenVerifiedDrawName344({...job(),status:'published'},group,now),false);
 assert.equal(reopenVerifiedDrawName344(job(),group,now+72*3600000),false);
 const tampered=[group[0],{...group[1],text:'No independent draw'}];
 tampered.drawCandidate=group.drawCandidate;
 assert.equal(reopenVerifiedDrawName344(job(),tampered,now),false);
});
