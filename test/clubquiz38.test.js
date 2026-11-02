'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),E=require('../android-ui/assets/clubquiz-engine');
const c={window:{}};vm.runInNewContext(fs.readFileSync('android-ui/assets/clubquiz-bank.js','utf8'),c);const bank=JSON.parse(JSON.stringify(c.window.CLUBQUIZ_BANK));
test('Clubkenner contains twenty questions concerning the chosen club, never unrelated random questions',()=>{
 assert.ok(E.clubs(bank).length>=2);for(const club of E.clubs(bank)){const r=E.createRound(bank,{mode:'club',club:club.name});assert.equal(r.questions.length,20);assert.ok(r.questions.every(q=>q.clubs.includes(club.name)));assert.equal(r.meta.club,club.name);}
 assert.throws(()=>E.createRound(bank,{mode:'club',club:'Not a club'}),/Kies een club/);
});
test('Expert ignores an easy input, thematic rounds only use verified topic pools',()=>{
 assert.ok(E.createRound(bank,{mode:'expert',level:'easy'}).questions.every(q=>q.level==='hard'));
 for(const mode of ['stadium','player']){const r=E.createRound(bank,{mode,level:'hard'});assert.equal(r.questions.length,10);assert.ok(r.questions.every(q=>q.topic===mode));assert.equal(new Set(r.questions.map(q=>q.id)).size,10);}
});
test('new historical questions have individually retrieved facts matching their exact answer and source receipt',()=>{
 const rows=require('../quiz/research38.json').receipts;assert.ok(rows.length>=60);
 for(const q of bank.filter(q=>q.id.startsWith('edition38-'))){const r=rows.find(r=>q.id.startsWith('edition38-'+r.competition+'-'+r.year+'-'));assert.ok(r,q.id);assert.equal(q.source,r.source);assert.match(r.sha256,/^[a-f0-9]{64}$/);assert.ok(r.canonicalTeams.includes(r.canonicalWinner));if(q.id.endsWith('-winner'))assert.equal(q.correct,r.canonicalWinner);}
 assert.equal(bank.filter(q=>q.topic==='player').length,require('../quiz/player-research38.json').facts.length);assert.ok(bank.length>=500);
});
