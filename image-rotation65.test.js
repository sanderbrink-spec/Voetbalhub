'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {eligible,present}=require('./image-rotation65');
const match={id:'article-1',status:'published',articleKind:'match_report',category:'Eredivisie',matchId:'sm-111',match:{homeTeam:'FC Groningen',awayTeam:'Ajax',playedAt:'2026-11-09'}};
function asset(id,opts={}){
 return {id,file:'public/match-rotations65/'+id+'.webp',categories:['report'],
 clubs:['FC Groningen','Ajax'],competitions:['Eredivisie'],daypart:'neutral',approval:'approved',
 rights:'original-ai',reviewer:'Veldio image review',sha256:id,rightsEvidence:'artwork review',
 caption:'AI-illustratie; geen wedstrijdfoto.',...opts};
}
test('six exact-match variants rotate on successive API reads without changing editorial content',()=>{
 const rows=Array.from({length:7},(_,i)=>asset('v'+i));
 const choices=eligible(match,rows);
 assert.equal(choices.length,6);
 const images=Array.from({length:6},(_,round)=>present(match,{round,rows}));
 assert.equal(new Set(images.map(v=>v.imageAssetId)).size,6);
 assert.ok(images.every(v=>v.headline===match.headline && v.match===match.match));
 assert.ok(images.every(v=>v.imageRights==='cleared' && v.imageReview.generated===true));
 assert.ok(images.every(v=>v.imageVariants.length===6 && v.imageRotation.maximum===6));
});
test('different opponent, reversed fixture, or mismatched fixtureId is excluded',()=>{
 const rows=[asset('wrong-away',{clubs:['FC Groningen','Feyenoord']}),
 asset('reversed',{clubs:['Ajax','FC Groningen']}),
 asset('wrong-fixture',{fixtureId:'sm-222'}),
 asset('correct',{fixtureId:'sm-111'})];
 assert.deepEqual(eligible(match,rows).map(v=>v.id),['correct']);
});
test('daypart artwork requires verified context and never guesses evening from a date',()=>{
 assert.deepEqual(eligible(match,[asset('night',{daypart:'night'})]),[]);
 assert.equal(eligible(match,[asset('neutral')]).length,1);
});
test('licensed, human-reviewed or copy-locked images are kept intact',()=>{
 const rows=[asset('one'),asset('two')];
 for(const article of [
  {...match,imageRights:'licensed',imageUrl:'https://licensed.example/photo.jpg'},
  {...match,imageReview:{method:'manual',reviewedAt:'2026-11-09T00:00:00Z'}},
  {...match,imageReview:{contentHash:'trusted'}}
 ])assert.equal(present(article,{rows,round:2}),article);
});
test('old and archived published articles can be decorated without editing stored article',()=>{
 const rows=[asset('one'),asset('two')],before=JSON.stringify(match);
 const presented=present(match,{rows,round:1});
 assert.notEqual(presented,match);
 assert.ok(presented.imageUrl.includes('/match-rotations65/'));
 assert.equal(JSON.stringify(match),before);
});
test('no unrelated match image is ever used for a non-match article or column',()=>{
 const rows=[asset('one'),asset('two')];
 const item={id:'news',status:'published',headline:'Trainer bespreekt de tactiek',category:'Voetbal'};
 assert.deepEqual(eligible(item,rows),[]);
 const column={...item,type:'column',match:match.match};
 assert.equal(present(column,{rows}),column);
});
test('unapproved or incomplete image rights are excluded',()=>{
 assert.deepEqual(eligible(match,[
  asset('pending',{approval:'pending'}),
  asset('no-proof',{rightsEvidence:''}),
  asset('no-hash',{sha256:''})
 ]),[]);
});
test('neutral topic images rotate only within the same non-match subject class',()=>{
 const article={id:'news-1',status:'published',headline:'De club presenteert een nieuwe huisstijl',category:'Voetbal',articleKind:'club'};
 const rows=[asset('topic1',{clubs:[],categories:['club'],competitions:[]}),
 asset('topic2',{clubs:[],categories:['club'],competitions:[]}),
 asset('match',{categories:['club']})];
 const result=present(article,{rows,round:1});
 assert.equal(result.imageVariants.length,2);
 assert.ok(!result.imageVariants.some(v=>v.id==='match'));
});
