'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path='android-project/app/src/main/java/nl/voetbalhub/app/';
const reader=fs.readFileSync(path+'MainActivity.java','utf8');
const fallback=fs.readFileSync(path+'TopicArtwork39.java','utf8');
const cards=fs.readFileSync(path+'NewsListCard.java','utf8');
const gradle=fs.readFileSync('android-project/app/build.gradle.kts','utf8');

test('article toolbar scrolls with content rather than masking paragraph lines',()=>{
 assert.match(reader,/page\.addView\(tools,toolsLp\)/);
 assert.doesNotMatch(reader,/root\.addView\(tools,toolsLp\)/);
 const toolbar=reader.indexOf('page.addView(tools,toolsLp)');
 const paragraph=reader.indexOf('page.addView(bodyText)');
 assert.ok(toolbar>0&&paragraph>toolbar);
});

test('news fallback never prints headlines or fabricated club badges into thumbnails',()=>{
 assert.match(fallback,/class TopicArtwork39/);
 assert.doesNotMatch(fallback,/drawText\s*\(/);
 assert.match(fallback,/drawRoundRect/);
 assert.match(fallback,/Sparta Rotterdam/);
 assert.match(fallback,/SC Heerenveen/);
 assert.match(fallback,/FC Twente/);
 assert.match(fallback,/ADO Den Haag/);
});

test('updated signed APK advances versionCode to allow a same-certificate update',()=>{
 assert.match(gradle,/versionCode\s*=\s*95\b/);
 assert.match(gradle,/versionName\s*=\s*"4\.55"/);
});

test('reader and news cards share cover selection and reject generic match imagery',()=>{
 const photos=fs.readFileSync(path+'EditorialPhotos.java','utf8');
 assert.match(cards,/EditorialPhotos\.bind\(activity,image,article,640\)/);
 assert.match(reader,/EditorialPhotos\.bind/);
 assert.match(photos,/approved-library49/);
 assert.match(photos,/optJSONArray\("clubs"\)/);
 assert.match(photos,/new TopicArtwork39\(article\)/);
 assert.match(photos,/length\(\) != 2/);
 assert.match(reader,/WindowInsetsCompat\.Type\.displayCutout/);
});
