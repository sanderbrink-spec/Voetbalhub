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
 assert.match(feed,/DeadlineHttp\.get\(address,/);
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
 assert.match(gradle,/versionCode\s*=\s*110/);
 assert.match(gradle,/versionName\s*=\s*"4\.70"/);
 assert.match(workflow,/versionCode='110'\.\*versionName='4\.70'/);
 assert.match(workflow,/name: Veldio-70/);
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


test('Veldio 4.62 bundles the approved compact competition and match UI',()=>{
 const fixtures=read('android-project/app/src/main/assets/destinations39.html');
 const predictions=read('android-project/app/src/main/assets/predictions49.html');
 const style=read('android-project/app/src/main/assets/veldio-ui86.css');
 assert.match(fixtures,/\['championsleague','CL','Champions League'\]/);
 assert.match(fixtures,/\['europaleague','EL','Europa League'\]/);
 assert.match(fixtures,/\['conferenceleague','UCL','UEFA Conference League'\]/);
 assert.match(fixtures,/match-filter86/);
 assert.match(fixtures,/team87-home/);
 assert.match(fixtures,/aria-label="Veldio versie 4\.70"/);
 assert.match(predictions,/aria-label="Veldio versie 4\.70"/);
 assert.match(style,/grid-template-columns:minmax\(0,1fr\) minmax\(72px,80px\) minmax\(0,1fr\)/);
});
