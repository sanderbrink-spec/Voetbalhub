'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {overview}=require('../stadium-desk74');
const gate=require('../premium-match-images72');
const assets=require('../image-library49.json').assets;
test('Fase 81: gefaseerde beeldreview heeft precies 28 reguliere en 8 herstelgevallen',()=>{
 const data=overview();
 assert.equal(data.clubsTotal,18);
 assert.equal(data.slotsTotal,36);
 assert.deepEqual(data.reviewPlan.firstReview,28);
 assert.deepEqual(data.reviewPlan.repairFirst,8);
 assert.equal(data.issuesForExtraReview,8);
 const p=data.slots.flatMap(s=>s.pendingImages);
 assert.equal(p.length,36);
 assert.equal(p.filter(a=>a.reviewPriority==='first-review').length,28);
 assert.equal(p.filter(a=>a.reviewPriority==='repair-first').length,8);
 assert.equal(p.filter(a=>a.canRequestApproval).length,28);
 assert.ok(p.filter(a=>a.reviewPriority==='repair-first').every(a=>a.knownIssue));
 assert.ok(p.filter(a=>a.reviewPriority==='first-review').every(a=>!a.knownIssue));
 assert.deepEqual(new Set(data.slots.map(s=>s.club)).size,18);
 assert.ok(data.slots.slice(0,28).every(s=>s.pendingImages[0].reviewPriority==='first-review'));
 assert.ok(data.slots.slice(28).every(s=>s.pendingImages[0].reviewPriority==='repair-first'));
 for(const a of assets.filter(x=>x.homeClubReusable===true)){
  assert.equal(a.approval,'pending');
  assert.equal(gate.accepted(a),false,'Geen ongekeurde publicatie: '+a.id);
 }
});
test('Fase 81: desk toont prioriteit 1 en herstel zonder te doen alsof er goedkeuring is',()=>{
 const js=fs.readFileSync(path.resolve(__dirname,'../public/desk.js'),'utf8');
 assert.match(js,/Prioriteit 1: afzonderlijk beoordelen/);
 assert.match(js,/Prioriteit 2: eerst herstellen/);
 assert.match(js,/reviewPriority==='first-review'/);
 assert.match(js,/Onvolledige fasering/);
 assert.match(js,/Geen automatische goedkeuring/);
});
