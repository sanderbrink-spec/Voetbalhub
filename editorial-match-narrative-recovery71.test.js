'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {repairUnverifiedMatchComeback}=require('./editorial-match-narrative71');
const {evidenceIssues}=require('./editorial-facts');
const {reopenUtrechtNecNarrativeV71}=require('./editorial-recovery136');

const verifiedFacts=[
 'FC Utrecht – NEC Nijmegen eindigde in 2-3.',
 'Eredivisie, speelronde 12, gespeeld op 2026-11-08.',
 'Ruststand 0-2.',
 'Volgens de Sportmonks-wedstrijdregistratie viel in minuut 34 een doelpunt van Kevin Kers, waarna de stand 0-1 was. De Sportmonks-participantregistratie koppelt Kevin Kers als doelpuntenmaker aan NEC Nijmegen.',
 'Volgens de Sportmonks-wedstrijdregistratie viel in minuut 38 een doelpunt van Dusan Tadic, waarna de stand 0-2 was. De Sportmonks-participantregistratie koppelt Dusan Tadic als doelpuntenmaker aan NEC Nijmegen.',
 'Volgens de Sportmonks-wedstrijdregistratie viel in minuut 56 een doelpunt van Yoann Cathline, waarna de stand 1-2 was. De Sportmonks-participantregistratie koppelt Yoann Cathline als doelpuntenmaker aan FC Utrecht.',
 'Volgens de Sportmonks-wedstrijdregistratie viel in minuut 58 een doelpunt van Dusan Tadic, waarna de stand 1-3 was. De Sportmonks-participantregistratie koppelt Dusan Tadic als doelpuntenmaker aan NEC Nijmegen.',
 'Volgens de Sportmonks-wedstrijdregistratie viel in minuut 64 een doelpunt van Dani de Wit, waarna de stand 2-3 was. De Sportmonks-participantregistratie koppelt Dani de Wit als doelpuntenmaker aan FC Utrecht.'
];
const match={homeTeam:'FC Utrecht',awayTeam:'NEC Nijmegen',homeScore:2,awayScore:3,playedAt:'2026-11-08'};
const record={matchId:'sm-19714594',articleKind:'match_report',publishedAt:'2026-11-08T16:00:00Z',match,verifiedFacts};
const manuscript={
 headline:'NEC Nijmegen wint met 2-3 van FC Utrecht na spannende wedstrijd',
 standfirst:'In de Eredivisie speelde FC Utrecht op 8 november 2026 thuis tegen NEC Nijmegen. De wedstrijd eindigde in 2-3, met een ruststand van 0-2.',
 body:[
  'De wedstrijd tussen FC Utrecht en NEC Nijmegen vond plaats op 8 november 2026 in de Eredivisie, speelronde 12. Volgens de Sportmonks-wedstrijdregistratie stond het bij rust 0-2 in het voordeel van NEC Nijmegen. De eerste helft kende geen doelpunten van FC Utrecht, terwijl NEC Nijmegen twee keer scoorde.',
  'In de eerste helft scoorde Kevin Kers namens NEC Nijmegen in de 34e minuut het openingsdoelpunt. Kort daarna, in de 38e minuut, verdubbelde Dusan Tadic de voorsprong voor NEC Nijmegen naar 0-2. Deze doelpunten bepaalden de ruststand volgens de Sportmonks-wedstrijdregistratie.',
  'Na de rust kwam FC Utrecht terug in de wedstrijd met een doelpunt van Yoann Cathline in de 56e minuut, waarmee de stand op 1-2 kwam. NEC Nijmegen reageerde snel met een treffer van Dusan Tadic in de 58e minuut, die de marge weer op drie bracht. Vervolgens maakte Dani de Wit in de 64e minuut de 2-3 voor FC Utrecht, maar dit was niet genoeg om de achterstand om te buigen.'
 ]
};

test('10 november echte revisie: geen onbewezen comeback of onjuiste marge; doelen blijven',()=>{
 const fixed=repairUnverifiedMatchComeback(manuscript,record);
 assert.notEqual(fixed,manuscript);
 const text=fixed.body.join(' ');
 assert.match(text,/Na de rust scoorde Yoann Cathline in minuut 56 voor FC Utrecht/);
 assert.doesNotMatch(text,/achterstand|comeback|terug in de wedstrijd|marge weer op drie/i);
 for(const player of ['Kevin Kers','Dusan Tadic','Yoann Cathline','Dani de Wit'])assert.match(text,new RegExp(player));
 for(const score of ['0-2','1-2','2-3'])assert.ok(text.includes(score));
 assert.equal(fixed.headline,manuscript.headline);
 assert.equal(fixed.standfirst,manuscript.standfirst);
 assert.ok(!evidenceIssues(fixed,verifiedFacts,match,'Sportmonks Football API').some(x=>/achterstand of comeback/.test(x)));
});

test('verkeerde speler-clubregistratie krijgt nooit een bevestigende herschrijving',()=>{
 const unverifiable={...record,verifiedFacts:verifiedFacts.map(f=>f.replace(
  'koppelt Yoann Cathline als doelpuntenmaker aan FC Utrecht',
  'koppelt Yoann Cathline als doelpuntenmaker aan NEC Nijmegen'))};
 const corrected=repairUnverifiedMatchComeback(manuscript,unverifiable);
 assert.match(corrected.body.join(' '),/FC Utrecht terug in de wedstrijd met een doelpunt/);
 assert.ok(evidenceIssues(corrected,unverifiable,match,'Sportmonks Football API').some(x=>/achterstand of comeback/.test(x)));
});

test('onbekende wedstrijd of ontbrekende brongegevens worden niet aangepast',()=>{
 assert.equal(repairUnverifiedMatchComeback(manuscript,{...record,articleKind:'announcement'}),manuscript);
 assert.equal(repairUnverifiedMatchComeback(manuscript,{...record,verifiedFacts:[]}).body[2].includes('terug in de wedstrijd'),true);
});

test('alleen exact gelogde productieafwijzing heropent één nieuwe volledige beoordeling',()=>{
 const now=Date.parse('2026-11-10T19:30:00Z');
 const hash='e6d65c46095e7da26e5ffa5f80463c05343faabe60d43ac2ca274f9289b88e03';
 const job=()=>({matchId:record.matchId,status:'review',failureStage:'quality',
  failureCategory:'journalistic_rejection',errorHash:hash,
  checkpoint:{draft:'rejected'},attempts:2,nextAttemptAt:Infinity});
 const j=job();
 assert.equal(reopenUtrechtNecNarrativeV71(j,record,now),true);
 assert.equal(j.checkpoint,undefined);
 assert.equal(j.status,'pending');
 assert.equal(j.utrechtNecNarrativeRecoveryV71,true);
 assert.equal(reopenUtrechtNecNarrativeV71(j,record,now),false);
 assert.equal(reopenUtrechtNecNarrativeV71({...job(),errorHash:'different'},record,now),false);
 assert.equal(reopenUtrechtNecNarrativeV71(job(),{...record,matchId:'sm-999'},now),false);
 assert.equal(reopenUtrechtNecNarrativeV71(job(),record,Date.parse('2026-11-12T20:00:00Z')),false);
 assert.equal(reopenUtrechtNecNarrativeV71({...job(),status:'published'},record,now),false);
});
