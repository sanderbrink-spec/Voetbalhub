'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

test('v66 native news prioritizes server-approved rotating artwork over legacy packaged covers', () => {
 const photos = fs.readFileSync('android-project/app/src/main/java/nl/voetbalhub/app/EditorialPhotos.java','utf8');
 assert.match(photos, /"approved-exact-topic-v65"\.equals\(rotation\.optString\("method"\)\)/);
 assert.match(photos, /"approved-library49"\.equals\(review\.optString\("method"\)\)/);
 assert.match(photos, /url\.startsWith\("https:\/\/voetbalhub-redactie\.onrender\.com\/"\)/);
 assert.match(photos, /Bitmap local = approvedRotation \? null : bitmap\(activity, article, width\)/);
});
test('v66 newly opened approved image starts an asynchronous feed update for subsequent opens', () => {
 const main = fs.readFileSync('android-project/app/src/main/java/nl/voetbalhub/app/MainActivity.java','utf8');
 assert.match(main, /if \(article\.optJSONObject\("imageRotation"\) != null\)\s*\{\s*FeedRepository\.configure\(this, EDITORIAL_API_URL\);\s*FeedRepository\.refresh\(true\);/);
});
test('v66 APK build uses increased Android release version and release certificate checks', () => {
 const gradle = fs.readFileSync('android-project/app/build.gradle.kts','utf8');
 const yaml = fs.readFileSync('.github/workflows/build.yml','utf8');
 assert.match(gradle,/versionCode = 98/);
 assert.match(gradle,/versionName = "4\.57"/);
 assert.match(yaml,/Veldio-58\.apk/);
 assert.match(yaml,/versionCode='98'/);
 assert.match(yaml,/apksigner" verify --verbose --print-certs/);
});

// New artwork is visible on the news page without associating unrelated clubs with an article.
test('v67 shows reviewed gallery previews on the home feed',()=>{const main=fs.readFileSync('android-project/app/src/main/java/nl/voetbalhub/app/MainActivity.java','utf8');const server=fs.readFileSync('server.js','utf8');assert.match(main,/matchArtworkPreview67\(\)/);assert.match(main,/Nieuwe Veldio wedstrijdbeelden/);assert.match(server,/url\.pathname==="\/beeldcollectie"/);});
