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

test('Utrecht–NEC revision archives the live copy under the same ID and requires the verified goals', async () => {
 const [row] = require('../editorial-evidence/reviewed-revisions96.json');
 const previous = {
  id:row.id, matchId:row.matchId, match:row.match, category:row.category, status:'published',
  headline:'NEC Nijmegen wint met 2-3 van FC Utrecht in Eredivisie',
  standfirst:'In speelronde 12 van de Eredivisie versloeg NEC Nijmegen op 8 november 2026 FC Utrecht met 2-3. De ruststand was 0-2 in het voordeel van NEC.',
  body:[
   'De Eredivisie-wedstrijd tussen FC Utrecht en NEC Nijmegen vond plaats op 8 november 2026 en maakte deel uit van speelronde 12. Bij rust stond NEC Nijmegen met 0-2 voor tegen FC Utrecht, een voorsprong die zij hadden opgebouwd zonder dat FC Utrecht tot scoren was gekomen.',
   'In de eerste helft opende Kevin Kers de score voor NEC Nijmegen in de 34e minuut, gevolgd door een doelpunt van Dusan Tadic in de 38e minuut, waarmee NEC Nijmegen de ruststand op 0-2 bracht.',
   'Na de rust wist FC Utrecht via Yoann Cathline in de 56e minuut de 1-2 te maken. Kort daarna, in de 58e minuut, vergrootte Dusan Tadic de voorsprong van NEC Nijmegen opnieuw tot 1-3. FC Utrecht kwam nog terug tot 2-3 door een doelpunt van Dani de Wit in de 64e minuut.'
  ],
  publishedAt:'2026-11-10T21:33:34.993Z', imageUrl:'https://voetbalhub-redactie.onrender.com/article-art72/utrecht-nec-report.webp'
 };
 const registered = fixture(row);
 const changedGoals = registered.goalTimeline.map((event, i) => i === 0 ? {...event,minute:33} : event);
 assert.throws(() => prepare(previous, row, {...registered,goalTimeline:changedGoals}), /Sportmonks/);
 const key = 'article:' + row.id;
 const history = 'article-revision:96:' + row.id;
 const original = JSON.stringify(previous);
 const stored = new Map([[key,original]]);
 const client = {
  mGet: async keys => keys.map(id => stored.get(id)),
  eval: async (_script,{keys,arguments:args}) => {
   assert.deepEqual(keys,[key,history]);
   assert.equal(stored.get(key),args[0]);
   assert.equal(stored.has(history),false);
   stored.set(history,args[0]);
   stored.set(key,args[1]);
   return 1;
  }
 };
 await apply(client, async () => [registered], {info:()=>{}});
 const article = JSON.parse(stored.get(key));
 assert.equal(stored.get(history),original);
 assert.equal(article.id,previous.id);
 assert.equal(article.publishedAt,previous.publishedAt);
 assert.equal(article.imageUrl,previous.imageUrl);
 assert.deepEqual(article.body,row.draft.body);
 assert.match(article.body[2],/Barkas/);
 await apply(client, async () => assert.fail('already archived'));
});
