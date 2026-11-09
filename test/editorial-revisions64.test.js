'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const {contentHash} = require('../article-covers');
const {prepare, apply, registrationMatches} = require('../editorial-revisions64');
const rows = require('../editorial-evidence/reviewed-revisions64.json');

function fixture(row) {
 const {homeTeam, awayTeam, homeScore, awayScore} = row.match;
 return {...row.registration, id:row.matchId, status:'FT', competition:'eredivisie',
  resultSource:'Sportmonks Football API', home:{name:homeTeam}, away:{name:awayTeam},
  goals:{home:homeScore, away:awayScore}};
}

test('persisted correction replaces the non-breaking-hyphen story only with matching Sportmonks evidence', () => {
 const row = rows[0];
 const previous = {id:row.id, matchId:row.matchId, match:row.match, category:row.category, status:'published',
  headline:'Heerenveen keert verlies om in 5-3 overwinning op Feyenoord',
  standfirst:'SC Heerenveen versloeg Feyenoord met 5-3 in de Eredivisie, speelronde 12 op 8 november 2026.',
  body:['De wedstrijd maakte deel uit van de Eredivisie, speelronde twaalf, en werd op 8 november 2026 gespeeld tussen SC Heerenveen en Feyenoord. Na de eerste helft stond het resultaat 1‑2.',
   'In de 25e minuut opende Anis Hadj Moussa de score voor Feyenoord, waarna de stand 0‑1 werd. Zes minuten later zette Nacho Ferri de voorsprong uit een strafschop uit op 0‑2. In blessuretijd van de eerste helft bracht Maas Willemsen Heerenveen op 1‑2, en twee minuten later maakte Levi Smans gelijk op 2‑2.',
   'Na rust kwam Ringo Meerveld in de 61e minuut op het scorespoor voor Heerenveen, waardoor de stand 3‑2 werd. Sem Steijn herstelde Feyenoord in de 69e minuut tot 3‑3. Meerveld vond opnieuw de treffer in de 84e minuut, 4‑3, en zette de eindstand met een doelpunt in blessuretijd (90+3) op 5‑3.']};
 assert.equal(contentHash(previous), row.previousCopy);
 const registered = fixture(row);
 const next = prepare(previous,row,registered,'2026-11-09T19:00:00Z');
 assert.match(next.body[0],/Willemsen.*1-2.*ruststand/);
 assert.match(next.body[1],/^Na rust maakte Levi Smans in de 47e minuut gelijk/);
 assert.throws(() => prepare(next,row,registered),/opgeslagen versie/);
 assert.throws(() => prepare(previous,row,{...registered,halfTime:{home:0,away:2}}),/Sportmonks/);
 assert.throws(() => prepare(previous,row,{...registered,competition:'knvb-beker'}),/Sportmonks/);
 assert.match(previous.body[1],/1‑2, en twee minuten later/);
});

test('no registry request or rewrite is made once the original is already archived', async () => {
 await apply({mGet:async () => ['stored article','archived original']}, async () => {
  assert.fail('already applied revisions must not be requested again');
 });
});

test('all three registration records require the verified competition, participants and score', () => {
 for (const row of rows) {
  const actual = fixture(row);
  assert.equal(registrationMatches(row, actual), true);
  assert.equal(registrationMatches(row, {...actual,home:{name:'Other'}}), false);
  assert.equal(registrationMatches(row, {...actual,goals:{home:99,away:0}}), false);
 }
});
