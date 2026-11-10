'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {repairUnverifiedMatchComeback}=require('./editorial-match-narrative71');
const {evidenceIssues}=require('./editorial-facts');
const {reopenUtrechtNecVerifiedGoalClauseV71}=require('./editorial-recovery136');
const match={homeTeam:'FC Utrecht',awayTeam:'NEC Nijmegen',homeScore:2,awayScore:3,playedAt:'2026-11-08'};
const facts=[
 'FC Utrecht – NEC Nijmegen eindigde in 2-3.',
 'Eredivisie, speelronde 12, gespeeld op 2026-11-08.',
 'Ruststand 0-2.',
 'Volgens de Sportmonks-wedstrijdregistratie viel in minuut 34 een doelpunt van Kevin Kers, waarna de stand 0-1 was. De Sportmonks-participantregistratie koppelt Kevin Kers als doelpuntenmaker aan NEC Nijmegen.',
 'Volgens de Sportmonks-wedstrijdregistratie viel in minuut 38 een doelpunt van Dusan Tadic, waarna de stand 0-2 was. De Sportmonks-participantregistratie koppelt Dusan Tadic als doelpuntenmaker aan NEC Nijmegen.',
 'Volgens de Sportmonks-wedstrijdregistratie viel in minuut 56 een doelpunt van Yoann Cathline, waarna de stand 1-2 was. De Sportmonks-participantregistratie koppelt Yoann Cathline als doelpuntenmaker aan FC Utrecht.',
 'Volgens de Sportmonks-wedstrijdregistratie viel in minuut 58 een doelpunt van Dusan Tadic, waarna de stand 1-3 was. De Sportmonks-participantregistratie koppelt Dusan Tadic als doelpuntenmaker aan NEC Nijmegen.',
 'Volgens de Sportmonks-wedstrijdregistratie viel in minuut 64 een doelpunt van Dani de Wit, waarna de stand 2-3 was. De Sportmonks-participantregistratie koppelt Dani de Wit als doelpuntenmaker aan FC Utrecht.'
];
const record={matchId:'sm-19714594',articleKind:'match_report',publishedAt:'2026-11-08T19:00:00Z',match,verifiedFacts:facts};
const original={
 headline:'NEC Nijmegen boekt nipte zege bij FC Utrecht in Eredivisie',
 standfirst:'In de twaalfde speelronde van de Eredivisie versloeg NEC Nijmegen FC Utrecht met 2-3. De ruststand was 0-2 in het voordeel van de bezoekers.',
 body:[
  'De Eredivisie-wedstrijd tussen FC Utrecht en NEC Nijmegen vond plaats op 8 november 2026. Bij rust stond NEC met 0-2 voor, een voorsprong die zij in de tweede helft wisten vast te houden. Volgens de Sportmonks-wedstrijdregistratie waren er geen andere geregistreerde incidenten dan de doelpunten tot aan de pauze.',
  'In de eerste helft opende Kevin Kers de score voor NEC Nijmegen in de 34e minuut. Kort daarna, in de 38e minuut, verdubbelde Dusan Tadic de voorsprong voor NEC. Deze twee doelpunten bepaalden de ruststand op 0-2, zoals geregistreerd door Sportmonks.',
  'Na rust scoorde Yoann Cathline voor FC Utrecht in minuut 56. NEC reageerde snel via een tweede treffer van Dusan Tadic in de 58e minuut, waarmee de stand op 1-3 kwam. FC Utrecht bleef aandringen en verkleinde de achterstand in de 64e minuut door een doelpunt van Dani de Wit. De wedstrijd eindigde uiteindelijk in 2-3 voor NEC Nijmegen.'
 ]
};
test('exact afgekeurde revisie: controleer doelpunt en verwijder onbewezen spelduiding',()=>{
 const fixed=repairUnverifiedMatchComeback(original,record);
 assert.notEqual(fixed,original);
 assert.equal(fixed.headline,original.headline);
 assert.equal(fixed.standfirst,original.standfirst);
 assert.doesNotMatch(fixed.body[2],/bleef aandringen|achterstand/i);
 assert.match(fixed.body[2],/Dani de Wit scoorde voor FC Utrecht in minuut 64, waardoor de stand 2-3 werd/);
 for(const name of ['Yoann Cathline','Dusan Tadic','Dani de Wit'])assert.match(fixed.body[2],new RegExp(name));
 assert.equal(evidenceIssues(fixed,facts,match,'Sportmonks Football API').some(x=>/achterstand of comeback/.test(x)),false);
});
test('onbewezen minuut, speler of club worden nooit gecorrigeerd of vrijgegeven',()=>{
 const invalid=[
  {...record,verifiedFacts:facts.filter(f=>!f.includes('minuut 64 een doelpunt van Dani de Wit'))},
  {...record,verifiedFacts:facts.map(f=>f.replace('Dani de Wit als doelpuntenmaker aan FC Utrecht','Dani de Wit als doelpuntenmaker aan NEC Nijmegen'))},
  {...record,verifiedFacts:facts.map(f=>f.replace('minuut 64 een doelpunt van Dani de Wit','minuut 65 een doelpunt van Dani de Wit'))}
 ];
 for(const item of invalid) {
  const result=repairUnverifiedMatchComeback(original,item);
  assert.match(result.body[2],/FC Utrecht bleef aandringen en verkleinde de achterstand/);
 }
});
test('oudere of andere wedstrijd, goedgekeurde tekst of andere fout heropenen nooit',()=>{
 const now=Date.parse('2026-11-10T19:30:00Z');
 const make=()=>({matchId:'sm-19714594',status:'review',failureStage:'quality',failureCategory:'journalistic_rejection',errorHash:'e6d65c46095e7da26e5ffa5f80463c05343faabe60d43ac2ca274f9289b88e03',checkpoint:{draft:'rejected'},attempts:2,nextAttemptAt:Infinity});
 const job=make();
 assert.equal(reopenUtrechtNecVerifiedGoalClauseV71(job,record,now),true);
 assert.equal(job.checkpoint,undefined);
 assert.equal(job.status,'pending');
 assert.equal(reopenUtrechtNecVerifiedGoalClauseV71(job,record,now),false);
 assert.equal(reopenUtrechtNecVerifiedGoalClauseV71({...make(),errorHash:'other'},record,now),false);
 assert.equal(reopenUtrechtNecVerifiedGoalClauseV71({...make(),status:'published'},record,now),false);
 assert.equal(reopenUtrechtNecVerifiedGoalClauseV71(make(),{...record,matchId:'sm-8888'},now),false);
 assert.equal(reopenUtrechtNecVerifiedGoalClauseV71(make(),record,Date.parse('2026-11-12T19:30:00Z')),false);
});
