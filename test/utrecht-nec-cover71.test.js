'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const crypto=require('node:crypto');
const L=require('../image-library49');
const rotation=require('../image-rotation65');

const id='veldio71-utrecht-nec-report';
const fixture={
 matchId:'sm-19714594',status:'published',articleKind:'match_report',
 imageCategory:'report',category:'Eredivisie',
 match:{homeTeam:'FC Utrecht',awayTeam:'NEC Nijmegen',playedAt:'2026-11-08'}
};

test('Fase 71: original fixture artwork is hashed, distinct, full-stands and commercially owned',()=>{
 const asset=L.catalog().find(a=>a.id===id);
 assert.ok(asset);
 assert.equal(asset.rights,'original-vector');
 assert.equal(asset.imageKind,'report');
 assert.equal(asset.stadiumOccupancy,'full');
 assert.equal(asset.stadiumIdentity,'home:fcutrecht');
 assert.equal(asset.fixtureId,'sm-19714594');
 assert.deepEqual(asset.clubs,['FC Utrecht','NEC Nijmegen']);
 assert.equal(asset.daypart,'neutral');
 assert.equal(asset.sha256,crypto.createHash('sha256').update(fs.readFileSync(asset.file)).digest('hex'));
 assert.match(fs.readFileSync(asset.file,'utf8'),/AI-ILLUSTRATIE/);
});
test('Fase 71: image cannot leak into reversed, other-club, different-fixture or preview stories',()=>{
 const resolved=rotation.resolve(fixture);
 assert.equal(resolved.assignment.state,'approved');
 assert.equal(resolved.assignment.assetIds[0],id);
 assert.match(resolved.article.imageUrl,/utrecht-nec-report\.webp$/);
 assert.equal(resolved.article.imageReview.imageKind,'report');
 assert.equal(resolved.article.imageReview.stadiumOccupancy,'full');
 assert.equal(resolved.article.imageReview.stadiumIdentity,'home:fcutrecht');
 for(const changed of [
  {match:{...fixture.match,homeTeam:'NEC Nijmegen',awayTeam:'FC Utrecht'}},
  {match:{...fixture.match,awayTeam:'Ajax'}},
  {matchId:'sm-19714595'},
  {articleKind:'match_preview',imageCategory:'preview'}
 ]){
  const row={...fixture,...changed};
  assert.ok(!rotation.resolve(row).assignment.assetIds.includes(id));
 }
});
test('Fase 71: original SVG serves rasterized WEBP to Android, including HEAD and cache',async()=>{
 const url='/article-art71/utrecht-nec-report.webp';
 const fetchImage=(method)=>new Promise((resolve,reject)=>{
  let status,headers;
  const res={writableEnded:false,writeHead(code,meta){status=code;headers=meta;},end(data){this.writableEnded=true;resolve({status,headers,body:data});}};
  try{assert.equal(L.serve({method},res,url),true);}catch(error){reject(error);}
 });
 const image=await fetchImage('GET');
 assert.equal(image.status,200);
 assert.equal(image.headers['Content-Type'],'image/webp');
 assert.equal(image.body.toString('ascii',0,4),'RIFF');
 assert.equal(image.body.toString('ascii',8,12),'WEBP');
 const metadata=await require('sharp')(image.body).metadata();
 assert.equal(metadata.width,1280);
 assert.equal(metadata.height,720);
 const head=await fetchImage('HEAD');
 assert.equal(head.status,200);
 assert.equal(head.body,undefined);
 assert.equal(head.headers['Content-Length'],image.body.length);
 assert.equal(L.serve({method:'POST'},{},url),false);
});
