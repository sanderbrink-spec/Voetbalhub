'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),sharp=require('sharp');
const I=require('../newsroom-images'),C=require('../news-photo-catalog.json'),D=require('../editorial-drafts'),R=require('../content-rights'),H=require('../android-ui/assets/home-model');
const packet=name=>({draft:{headline:name+' bespreekt plannen met supporters'}});
test('all registered photographs meet resolution, hash, photographic quality and licensed attribution requirements',async()=>{
 for(const p of C.photos){const x=await I.prepare(packet(p.club),{entries:[p]});assert.equal(x.imageReview.contextOnly,true);assert.equal(I.sha(x.bytes),p.sha256);assert.match(x.imageCredit,new RegExp(p.license.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')));const meta=await sharp(x.bytes).metadata();assert.equal(meta.width,1280);assert.equal(meta.height,720);assert.ok(x.bytes.length<250000);assert.ok(p.sourceWidth>=1280&&p.sourceHeight>=720);}
});
test('incorrect subjects, missing rights, revocation, low resolution, pending visual review and reused bytes are rejected',async()=>{
 const p=structuredClone(C.photos.find(p=>p.club==='Ajax'));
 for(const change of [{author:''},{licenseUrl:'https://example.org/stolen'},{approved:false},{revoked:true},{width:640},{sha256:'f'.repeat(64)},{visualReview:{approved:false}},{expiresAt:'2020-01-01'}])await assert.rejects(I.prepare(packet('Ajax'),{entries:[{...p,...change}]}),/Geen passend/);
 await assert.rejects(I.prepare(packet('NEC'),{entries:[p]}),/Geen passend/);await assert.rejects(I.prepare(packet('Ajax'),{usedHashes:[p.sha256]}),/Geen passend/);
 assert.equal(I.kind(packet('Ajax contract')),'transfer');assert.equal(I.kind(packet('Ajax interview')),'interview');assert.equal(I.relevant(C.photos[3],packet('Ajaxied')),false);
});
test('image licence, source, context caption and reviewed byte identity survive draft normalization and bind publication rights',async()=>{
 const x=await I.prepare(packet('Ajax')),p={...packet('Ajax'),imageUrl:'https://example.org/a.webp',...x};delete p.bytes;delete p.photo;
 const clean=D.cleanPayload(p);assert.equal(clean.imageCaption,x.imageCaption);assert.equal(clean.imageLicenseUrl,x.imageLicenseUrl);assert.equal(clean.imageReview.assetSha256,x.imageReview.assetSha256);assert.equal(clean.imageReview.contextOnly,true);
 assert.notEqual(R.digest(R.articleContent(p)),R.digest(R.articleContent({...p,imageLicenseUrl:'https://example.org/wrong'})));
});
test('spotlight rotates eligible top clubs, ignores drafts, future, stale and unchecked news, and falls back to a club profile',()=>{
 const now=Date.parse('2026-11-01T18:00:00Z'),make=club=>({id:club,status:'published',headline:club+' actueel nieuws',publishedAt:new Date(now-60000).toISOString(),editorialChecks:{claimsIndependentlyChecked:true,originalSourceReviewed:true}}),rows=['Ajax','Feyenoord','PSV'].map(make);
 const picks=[0,1,2].map(day=>H.spotlight(rows.map(a=>({...a,publishedAt:new Date(now+day*86400000-60000).toISOString()})),now+day*86400000).club);assert.equal(new Set(picks).size,3);
 assert.notEqual(H.spotlight(rows,now,H.spotlight(rows,now).club).club,H.spotlight(rows,now).club);
 for(const changed of [{status:'draft'},{publishedAt:'2020-01-01'},{publishedAt:new Date(now+1000).toISOString()},{editorialChecks:{}}])assert.equal(H.spotlight([{...make('Ajax'),...changed}],now).article,null);
 assert.equal(H.spotlight([{...make('NEC')}],now).article,null);assert.ok(['Ajax','PSV','Feyenoord'].includes(H.spotlight([],now).club));
});
test('scoped replacements retain exact content and old-image binding and have bundled matching assets',()=>{
 const entries=require('../android-ui/assets/presentation-covers.json');for(const p of entries){assert.match(p.contentHash,/^[a-f0-9]{64}$/);assert.ok(p.previousUrls.length>=2);assert.equal(I.sha(fs.readFileSync(path.join(__dirname,'../public',p.imageAsset))),p.sha256);assert.equal(p.imageRights,'licensed');assert.ok(p.imageCaption.includes('Archiefbeeld'));}
});
