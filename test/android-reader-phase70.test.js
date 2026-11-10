'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const java = file => fs.readFileSync('android-project/app/src/main/java/nl/voetbalhub/app/'+file+'.java','utf8');
const main = java('MainActivity');
const photos = java('EditorialPhotos');

test('article reader puts metadata and byline before image, reading controls before the first paragraph', () => {
  const section = main.substring(main.indexOf('private void showEditorialArticle('), main.indexOf('private void addEditorialNewsSection('));
  for (const token of ['page.addView(title)', 'page.addView(metadata)', 'page.addView(byline)', 'page.addView(cover, coverLp)', 'page.addView(introText)', 'page.addView(tools,toolsLp)', 'page.addView(bodyText)']) {
    assert.ok(section.includes(token), 'missing '+token);
  }
  const pos = str => section.indexOf(str);
  assert.ok(pos('page.addView(title)') < pos('page.addView(metadata)'));
  assert.ok(pos('page.addView(metadata)') < pos('page.addView(byline)'));
  assert.ok(pos('page.addView(byline)') < pos('page.addView(cover, coverLp)'));
  assert.ok(pos('page.addView(introText)') < pos('page.addView(tools,toolsLp)'));
  assert.ok(pos('page.addView(tools,toolsLp)') < pos('page.addView(bodyText)'));
});
test('sources render below article body, not between cover and lead', () => {
  assert.ok(main.indexOf('page.addView(bodyText)') < main.indexOf('EditorialPhotos.sources(this, article)'));
  assert.match(main,/page\.addView\(sourcesHeading\)/);
  assert.match(main,/page\.addView\(sources\)/);
  assert.doesNotMatch(photos,/Wedstrijdbronnen: /);
});
test('caption does not repeat its own author credit; rights hyperlinks remain present', () => {
  assert.match(photos,/creditAlreadyInCaption/);
  assert.match(photos,/captionText\.toLowerCase/);
  assert.match(photos,/new URLSpan\(source\)/);
  assert.match(photos,/new URLSpan\(license\)/);
});
test('body remains scalable, scrollable and preserves image rotation', () => {
  assert.match(main,/prefs\.getInt\("readerFontSize",17\)/);
  assert.match(main,/page\.addView\(tools,toolsLp\)/);
  assert.match(main,/ArticleArtwork\.recordOpen\(this, article\)/);
  assert.match(main,/WindowInsetsCompat\.Type\.displayCutout/);
  assert.match(main,/getConfiguration\(\)\.screenWidthDp < 360/);
});
