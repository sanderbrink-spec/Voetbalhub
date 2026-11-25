'use strict';

const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const sharp=require('sharp');
const library=require('../image-library49');
const rotation=require('../image-rotation65');
const service=require('../editorial-image44-service');
const premium=require('../premium-match-images72');
const selection=require('../stadium-selection116');
const preflight=require('../scripts/premium-raster-preflight72');
const rows=require('../stadium-catalog116.json').assets;
const fixture={id:'sm-90001',date:'2026-11-25T19:00:00+01:00',status:'NS',
 home:{id:'sm-629',name:'Ajax'},away:{name:'PSV'},venue:{name:'Johan Cruijff ArenA',latitude:52.314,longitude:4.942}};
const probe=(f=fixture,articleKind='match_preview')=>({fixture:f,articleKind,draft:{headline:'Ajax ontvangt PSV'}});

test('116: each registered file passes native raster checks and the exact rights and branding gates',async()=>{
 for(const row of rows){
  const result=await preflight.inspect(row.file);
  assert.equal(result.accepted,true,row.id+': '+result.problems.join(', '));
  assert.equal(result.sha256,row.sha256);
  assert.equal(result.width*9,result.height*16);
  assert.ok(result.width>=1280&&result.height>=720);
  assert.ok(result.bytes<=375000);
  assert.equal((await sharp(row.file).metadata()).format,'webp');
  assert.ok(row.provenance.nativeDimensions[0]>=result.width);
  assert.ok(row.provenance.nativeDimensions[1]>=result.height);
  assert.equal(premium.brandingAllowed(row),true);
  assert.equal(premium.accepted(row),true);
  if(row.imageKind){
   const c=row.visualReview.components;
   const weighted=c.stadium*.25+c.photorealism*.25+c.branding*.20+c.occupancy*.10+c.lighting*.10+c.technical*.10;
   assert.ok(Math.abs(row.visualReview.score-weighted)<=0.00500001);
   assert.ok(row.visualReview.score>=8.5);
  }
 }
});
test('116: exact Ajax stadium, category and local sunlight work through the editorial service',async()=>{
 const variants=[['preview','2026-06-25T19:00:00+02:00','day'],['preview',fixture.date,'night'],
 ['report','2026-06-25T19:00:00+02:00','day'],['report',fixture.date,'night']];
 for(const [kind,date,light] of variants){
  const p=probe({...fixture,date,status:kind==='report'?'FT':'NS'},'match_'+kind);
  const result=await service.create(p);
  assert.equal(result.assetId,'stadium116-ajax-'+kind+'-'+light);
  assert.equal(result.imageReview.stadiumOccupancy,kind==='preview'?'empty':'full');
  assert.equal(library.choose(library.context(p)).id,result.assetId);
  assert.match(result.imageCaption,/AI-illustratie/);
  assert.deepEqual(Buffer.from(result.base64,'base64'),fs.readFileSync(rows.find(a=>a.id===result.assetId).file));
 }
 assert.equal(selection.lighting({...fixture,date:'2026-06-25T19:00:00'}),'neutral');
});
test('116: a neutral illustration is fixture-bound and never presented as the actual stadium',async()=>{
 const payload=probe({...fixture,neutralVenue:true,venue:undefined});
 const result=await service.create(payload);
 assert.equal(result.assetId,'stadium116-neutral-football');
 assert.equal(result.imageReview.neutralFootballIllustration,true);
 assert.equal(result.imageReview.stadiumIdentity,undefined);
 const send=data=>service.remote(payload,{secret:'test',fetcher:async()=>Response.json(data)});
 assert.equal((await send(result)).assetId,result.assetId);
 await assert.rejects(send({...result,assetId:'stadium116-ajax-preview-night'}));
 assert.equal(rotation.resolve(probe({...fixture,venue:{...fixture.venue,name:'Ander stadion'}})).article.imageAssetId,result.assetId);
 assert.equal(rotation.resolve(probe({...fixture,status:'PST'})).article,null);
 assert.equal(rotation.resolve(probe(fixture,'match_report')).article,null);
 assert.equal(rotation.resolve(probe({...fixture,away:undefined})).article,null);
});
test('116: a rejected hash cannot re-enter under a different ID; assets support conditional GET',()=>{
 const asset=rows[0];
 const denied=require('../owner-replacement-queue115e.json').items[0].rejectedSha256;
 assert.equal(premium.accepted({...asset,id:'alternate',sha256:denied}),false);
 let status;
 const res={writeHead:s=>{status=s;},end:body=>assert.equal(body,undefined)};
 assert.equal(library.serve({method:'GET',headers:{'if-none-match':'"'+asset.sha256+'"'}},res,'/'+asset.file.slice(7)),true);
 assert.equal(status,304);
});
