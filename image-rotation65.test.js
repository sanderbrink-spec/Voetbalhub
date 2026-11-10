'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const {eligible, resolve, migrate} = require('./image-rotation65');
const match = {id:'article-1',status:'published',articleKind:'match_report',category:'Eredivisie',
  matchId:'sm-111',headline:'Groningen speelt tegen Ajax',body:['Oorspronkelijk verslag.'],
  match:{homeTeam:'FC Groningen',awayTeam:'Ajax',playedAt:'2026-11-09'}};

function asset(id, extras = {}) {
  return {id,file:'public/article-art69/'+id+'.webp',categories:['report'],clubs:['FC Groningen','Ajax'],
    imageKind:'report',stadiumOccupancy:'full',stadiumIdentity:'home:fcgroningen',competitions:[],daypart:'neutral',approval:'approved',rights:'original-ai',reviewer:'Veldio',
    sha256:id,rightsEvidence:'Original illustration',caption:'AI-illustratie',...extras};
}
test('approved variants are distinct, bounded and served in a stable order', () => {
  const rows = Array.from({length:8}, (_,i) => asset('v'+i, {sha256:'digest'+Math.max(1,i)}));
  const {article,assignment} = resolve({...match,imageAsset:'legacy.webp',imageUrl:'https://old.invalid'}, {rows});
  assert.equal(article.imageVariants.length,6);
  assert.equal(article.imageAssetId,'v0');
  assert.equal(article.imageAsset,undefined);
  assert.equal(article.body,match.body);
  assert.equal(assignment.reason,'ordered-fixture');
});
test('exact match checks home, away, fixture ID, verified time, approval and rights', () => {
  const rows = [asset('away',{clubs:['FC Groningen','PSV']}), asset('reversed',{clubs:['Ajax','FC Groningen']}),
    asset('fixture',{fixtureId:'sm-222'}), asset('night',{daypart:'night'}),asset('proof',{rightsEvidence:''}),
    asset('pending',{approval:'pending'}),asset('correct',{fixtureId:'sm-111'})];
  assert.deepEqual(eligible(match,rows).map(row=>row.id),['correct']);
  const timed = {...match,match:{...match.match,playedAt:'2026-11-09T19:00:00Z',venue:{latitude:53.2,longitude:6.56}}};
  assert.ok(eligible(timed,rows).some(row=>row.id==='night'));
});
test('transfer never uses a match or a generic image, even with matching club names', () => {
  const transfer = {...match,articleKind:'transfer'};
  const rows = [asset('generic',{clubs:[],categories:['neutral']}),asset('match',{categories:['transfer']}),
    asset('topic',{clubs:[],categories:['transfer']})];
  assert.deepEqual(eligible(transfer,rows).map(row=>row.id),['topic']);
  const result = resolve({...transfer,imageUrl:'https://old.invalid'}, {rows:rows.slice(0,2)});
  assert.equal(result.article,null);
  assert.equal(result.assignment.state,'unpublished_image_quality');
});
test('migration stores decisions separately and only writes changed assignments', async () => {
  let writes=0;
  const storage={};
  const redis={hGetAll:async()=>({...storage}),hSet:async(key,change)=>{writes++;Object.assign(storage,change);}};
  const article={...match,id:'image-migration-test',articleKind:'transfer',imageUrl:'https://old.invalid'};
  const unavailable={...match,id:'image-migration-hidden',match:{homeTeam:'Onbekende club',awayTeam:'PSV'}};
  const original=JSON.stringify([article,unavailable]);
  const visible=await migrate(redis,[article,unavailable]);
  assert.equal(visible[0].imageRotation.method,'approved-article-v69');
  assert.equal(visible.length,1);
  assert.equal(JSON.parse(storage[unavailable.id]).state,'unpublished_image_quality');
  await migrate(redis,[article,unavailable]);
  assert.equal(writes,1);
  assert.equal(JSON.stringify([article,unavailable]),original);
});

test('preview and report reject unreviewed, mismatched or wrong-stadium artwork', () => {
  const preview = {...match,articleKind:'match_preview'};
  const report = asset('full', {categories:['preview','report']});
  const empty = asset('empty', {categories:['preview','report'],imageKind:'preview',stadiumOccupancy:'empty'});
  const rows = [report,empty,asset('old',{imageKind:undefined,stadiumOccupancy:undefined}),
    asset('wrong-stadium',{stadiumIdentity:'venue:other'}),
    asset('wrong-occupancy',{stadiumOccupancy:'empty'})];
  const reportArticle = resolve(match,{rows}).article;
  const previewArticle = resolve(preview,{rows}).article;
  assert.deepEqual(reportArticle.imageVariants.map(v=>v.id),['full']);
  assert.deepEqual(previewArticle.imageVariants.map(v=>v.id),['empty']);
  assert.equal(previewArticle.imageReview.imageKind,'preview');
  assert.equal(previewArticle.imageVariants[0].review.stadiumOccupancy,'empty');
  assert.equal(reportArticle.imageReview.stadiumOccupancy,'full');
  assert.notEqual(reportArticle.imageReview.imageIdentity,previewArticle.imageReview.imageIdentity);
  assert.equal(resolve(preview,{rows:[report]}).article,null);
});
