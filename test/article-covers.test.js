'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const {createRequire}=require('node:module');
const {contentHash,readCover,withArticleCover}=require('../article-covers');
const manifest=require('../article-covers.json');
const packets=[require('../redactie/curated/articles.json')[0],require('../redactie/trial/article.json')];
test('both checked articles receive different match-specific images in feed and publish shapes',()=>{
 const urls=[];
 for(const [index,packet] of packets.entries()){
  const payload=packet.payload, published={...payload.draft,status:'published'};
  const linked=withArticleCover(payload), feed=withArticleCover(published);
  assert.equal(contentHash(published),manifest[index].contentHash);
  assert.equal(feed.imageUrl,linked.imageUrl);
  assert.ok(linked.imageUrl.endsWith(manifest[index].file));
  assert.equal(linked.imageRights,'cleared');
  assert.match(linked.imageCredit,/AI-illustratie/);
  assert.equal(linked.imageReview.aiDisclosureVerified,true);
  assert.equal(readCover(manifest[index].file).toString('ascii',8,12),'WEBP');
  assert.equal(payload.imageUrl,undefined);
  urls.push(linked.imageUrl);
 }
 assert.notEqual(urls[0],urls[1]);
});
test('changed score, date, opponent, intro or body cannot inherit reviewed artwork',()=>{
 const original=packets[0].payload;
 for(const modify of [
  p=>p.draft.headline+=' gewijzigd',
  p=>p.draft.standfirst=p.draft.standfirst.replace('0-2','2-0'),
  p=>p.draft.body[0]=p.draft.body[0].replace('29 oktober','30 oktober'),
  p=>p.draft.standfirst=p.draft.standfirst.replace('FC Emmen','Ajax'),
  p=>p.draft.body[1]+=' Een extra wedstrijdfeit.'
 ]){const p=structuredClone(original);modify(p);assert.equal(withArticleCover(p).imageUrl,undefined);}
});
test('an editor-selected cover is retained and unknown filenames or paths cannot be served',()=>{
 const p={...packets[0].payload,imageUrl:'https://example.org/manual.webp'};
 assert.equal(withArticleCover(p),p);
 for(const name of ['../server.js','unknown.webp',manifest[0].file+'?x=1','%2e%2e%2fserver.js'])assert.equal(readCover(name),null);
});
test('modified asset bytes fail closed even when filename and article match',()=>{
 const file=path.join(__dirname,'../article-covers.js'),realRequire=createRequire(file);
 const context={require:id=>id==='node:fs'?{readFileSync:()=>Buffer.from('different artwork')}:realRequire(id),__dirname:path.dirname(file),module:{exports:{}}};
 vm.runInNewContext(fs.readFileSync(file,'utf8'),context,{filename:file});
 assert.equal(context.module.exports.readCover(manifest[0].file),null);
 assert.equal(context.module.exports.withArticleCover(packets[0].payload).imageUrl,undefined);
});
