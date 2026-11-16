'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const config=require('../automatic-editorial.json');
const {articleUrl}=require('../scripts/editorial-discovery53');
const {nationallyRelevant}=require('../scripts/automatic-publication');

test('League A matchday reporting is discovered from the existing official UEFA domain',()=>{
 const url='https://www.uefa.com/uefanationsleague/news/02ab-221287e5a66c-f9855de4b857-1000--uefa-nations-league-matchday-6-preview-germany-welcome-nethe/';
 assert.equal(articleUrl(url,config.newsIndexes),url);
 const doc={url,title:'UEFA Nations League Matchday 6 preview: Germany welcome Netherlands, Greece host Serbia',
  text:'The key players and storylines to follow as the league phase concludes. Denmark vs Norway and Wales vs Portugal decide quarter-final places.'};
 assert.equal(nationallyRelevant(doc),true);
});
test('Men-only filter excludes irrelevant headlines and avoids treating a fixture calendar as proof of an article',()=>{
 const base='https://www.uefa.com/uefanationsleague/news/';
 assert.equal(nationallyRelevant({url:base+'02ab-sample/',title:'UEFA Nations League women preview and lineup',text:'Preview of Women Nations League'}),false);
 assert.equal(nationallyRelevant({url:base+'02ab-sample/',title:'Merchandise and stadium tickets',text:'UEFA Nations League tickets on sale'}),false);
 assert.equal(articleUrl('https://www.uefa.com/uefanationsleague/matches/',config.newsIndexes),null);
});
