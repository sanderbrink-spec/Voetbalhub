'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),L=require('../image-library49');
test('25 rights-verified approved images (15 prior plus 10 new); invalid metadata fails',()=>{const rows=L.catalog();assert.equal(rows.length,25);assert.equal(rows.filter(a=>a.file.startsWith('public/match-rotations65/')).length,10);for(const change of [{id:'BAD'},{file:'public/missing.webp'},{sha256:'bad'},{approval:'yes'},{categories:[]},{rightsEvidence:''}])assert.throws(()=>L.validate([{...rows[0],...change}]));assert.throws(()=>L.validate([rows[0],rows[0]]));assert.equal(L.choose({category:'club',clubs:[],daypart:'neutral',articleId:'test'},rows.filter(a=>a.approval==='pending')),null);});
test('exact home/away pair, daypart, least-recent use, quiz safety and neutral fallback',()=>{const base=L.catalog().find(a=>a.id==='neutral-arena49');const a={...base,id:'ajax-psv-day',categories:['preview'],clubs:['Ajax','PSV'],daypart:'day'},b={...a,id:'second'},night={...a,id:'night',daypart:'night'},pending={...a,id:'pending',approval:'pending'};const ctx={category:'preview',clubs:['Ajax','PSV'],daypart:'day',articleId:'article'};assert.equal(L.choose(ctx,[a,b,pending],{[a.id]:'2026-11-04'}).id,'second');assert.equal(L.choose({...ctx,daypart:'night'},[a,night]).id,'night');assert.equal(L.choose({...ctx,clubs:['PSV','Ajax']},[a,base]).id,base.id);assert.equal(L.choose({...ctx,clubs:['Ajax','AZ']},[a,base]).id,base.id);assert.equal(L.choose({category:'quiz',questionId:'not-reviewed',articleId:'q'},L.catalog()),null);assert.equal(L.choose({category:'quiz',questionId:'rules49-centre-circle',articleId:'q'},L.catalog()).id,'rules49-centre-circle');});
test('solar day/twilight/night; missing venue or timezone remains neutral',()=>{const f={date:'2026-06-21T12:00:00Z',venue:{latitude:53.2,longitude:6.6}};assert.equal(L.daypart(f),'day');assert.equal(L.daypart({...f,date:'2026-12-21T23:00:00Z'}),'night');assert.equal(L.daypart({...f,date:'2026-03-21T18:00:00Z'}),'twilight');assert.equal(L.daypart({date:f.date}),'neutral');assert.equal(L.daypart({...f,date:'2026-06-21T12:00:00'}),'neutral');});
test('import validates atomically; question mappings contain no random art',()=>{const before=fs.readFileSync('image-library49.json');const {spawnSync}=require('node:child_process');assert.notEqual(spawnSync(process.execPath,['scripts/import-images49.js','/nonexistent']).status,0);assert.deepEqual(fs.readFileSync('image-library49.json'),before);const vm=require('node:vm'),ctx={window:{}};vm.runInNewContext(fs.readFileSync('android-project/app/src/main/assets/quiz-images49.js','utf8'),ctx);assert.equal(ctx.window.QuizImages49.get({id:'venue-de-kuip'}),null);assert.ok(ctx.window.QuizImages49.get({id:'rules49-penalty-mark'}));});

test('fixture cover binds both exact clubs and cannot leak to their next meeting',()=>{
 const article={status:'published',matchId:'sm-19714596',articleKind:'match_report',category:'Eredivisie',
  imageUrl:'https://voetbalhub-redactie.onrender.com/editorial/veldio-arena.webp',
  match:{homeTeam:'SC Heerenveen',awayTeam:'Feyenoord'}};
 const approved=L.applyFixtureCover(article);
 assert.match(approved.imageUrl,/match-covers64\/sm-19714596\.webp$/);
 assert.equal(approved.imageReview.qualityTier,'reviewed-fixture');
 assert.equal(approved.imageReview.noOfficialLogos,true);
 for(const different of [{matchId:'sm-111'},{match:{homeTeam:'Feyenoord',awayTeam:'SC Heerenveen'}},{articleKind:'transfer'}]){
  const row={...article,...different};
  assert.equal(L.applyFixtureCover(row),row);
 }
});
