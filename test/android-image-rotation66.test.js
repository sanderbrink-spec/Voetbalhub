'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const read = name => fs.readFileSync('android-project/app/src/main/java/nl/voetbalhub/app/'+name+'.java','utf8');

test('article card and reader use the same approved variant and no legacy bitmap', () => {
 const photos=read('EditorialPhotos'), main=read('MainActivity'), panel=read('FeedPanel'), selection=read('ArticleArtwork');
 assert.match(photos,/boolean central = ArticleArtwork.approved/);
 assert.match(panel,/ArticleArtwork.selected\(activity/);
 assert.match(main,/ArticleArtwork.recordOpen\(this, article\)/);
 assert.match(selection,/getSharedPreferences\("veldio_article_artwork"/);
 assert.match(selection,/\(i \+ 1\) % variants.length/);
 assert.doesNotMatch(main,/Nieuwe Veldio wedstrijdbeelden|MatchArtworkGallery68/);
 assert.doesNotMatch(read('FeedRepository'),/news-bootstrap|raw.githubusercontent.com/);
});
