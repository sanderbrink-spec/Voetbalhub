'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const root=path.join(__dirname,'..');

const read=relative=>fs.readFileSync(path.join(root,relative),'utf8');
const activityPath='android-project/app/src/main/java/nl/voetbalhub/app/MainActivity.java';
const feedPath='android-project/app/src/main/java/nl/voetbalhub/app/FeedRepository.java';

test('Android news API base URL points at the actual Render production service',()=>{
 const activity=read(activityPath);
 assert.match(activity,/EDITORIAL_API_URL\s*=\s*"https:\/\/voetbalhub-redactie\.onrender\.com"/);
 assert.doesNotMatch(activity,/voetbalhub-redactie-api\.onrender\.com/);
});

test('FeedRepository normalizes API base URL to public GET /articles',()=>{
 const feed=read(feedPath);
 assert.match(feed,/endpoint=root\.endsWith\("\/articles"\)\?root:root\+"\/articles"/);
 assert.match(feed,/DeadlineHttp\.get\(url,/);
 assert.match(feed,/endpoint="https:\/\/voetbalhub-redactie\.onrender\.com\/articles"/);
});

test('Signed Android build version and source checksums match current package',()=>{
 const source=JSON.parse(read('android-project/source-provenance.json'));
 const gradle=read('android-project/app/build.gradle.kts');
 const workflow=read('.github/workflows/build.yml');
 for(const file of [activityPath,feedPath]){
  const name=file.replace(/^android-project\//,'');
  const actual=crypto.createHash('sha256').update(fs.readFileSync(path.join(root,file))).digest('hex');
  assert.equal(source.files[name],actual, file+' provenance hash');
 }
 assert.match(gradle,/versionCode\s*=\s*98/);
 assert.match(gradle,/versionName\s*=\s*"4\.58"/);
 assert.match(workflow,/versionCode='98'\.\*versionName='4\.58'/);
 assert.match(workflow,/name: Veldio-58/);
});

test('Nieuws is de startpagina en behoudt alle redactionele artikelen',()=>{
 const activity=read(activityPath);
 const panel=read('android-project/app/src/main/java/nl/voetbalhub/app/FeedPanel.java');
 assert.ok(activity.includes('private void showHome39(){active="Voor jou";articleDisplayLimit=20;buildChips();showNews();}'));
 assert.ok(activity.includes('new FeedPanel(this,active,false,this::showEditorialArticle,0,3)'));
 assert.ok(activity.includes('new FeedPanel(this,active,false,this::showEditorialArticle,3,60)'));
 assert.ok(activity.includes('new MatchStrip40(this'));
 assert.ok(panel.includes('presentationIndex<startIndex'));
 assert.ok(activity.includes('addMoreFeature(list,"Video"'));
 assert.ok(activity.includes('addMoreFeature(list,"Column"'));
 assert.ok(activity.includes('addMoreFeature(list,"Clubquiz"'));
});
