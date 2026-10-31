'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const brand=require('../brand');
test('rebranding changes presentation while preserving article identity and the approved original',()=>{
 const source={id:'existing-id',author:'VoetbalHub Redactie',headline:'Een eigen verhaal',body:['VoetbalHub brengt eigen nieuws.'],manuscript:'De Column | VoetbalHub',sources:[{url:'https://voetbalhub-redactie.onrender.com'}],contentHash:'unchanged'};
 const result=brand.article(source);
 assert.equal(result.author,'Veldio Redactie');assert.equal(result.body[0],'Veldio brengt eigen nieuws.');
 assert.equal(result.id,source.id);assert.equal(result.contentHash,source.contentHash);assert.equal(result.manuscript,source.manuscript);
 assert.equal(source.author,'VoetbalHub Redactie');assert.equal(source.body[0],'VoetbalHub brengt eigen nieuws.');assert.deepEqual(result.sources,source.sources);
});
test('old fixture graphics use the branded presentation endpoint, preserving their source URL',()=>{
 const source='https://raw.githubusercontent.com/sanderbrink-spec/Voetbalhub/editorial-media/matches/test.webp';
 const row=brand.article({imageUrl:source,imageReview:{method:'fixture-specific-stadium-and-logos-v4'}});
 const url=new URL(row.imageUrl);assert.equal(url.pathname,'/brand/fixture-image');assert.equal(url.searchParams.get('source'),source);
});
test('branding image service cannot fetch arbitrary hosts, repositories or credentials',()=>{
 assert.equal(brand.ownMedia('https://raw.githubusercontent.com/sanderbrink-spec/Voetbalhub/main/test.png'),true);
 for(const value of ['http://raw.githubusercontent.com/sanderbrink-spec/Voetbalhub/a.png','https://raw.githubusercontent.com.evil/sanderbrink-spec/Voetbalhub/a.png','https://user:password@raw.githubusercontent.com/sanderbrink-spec/Voetbalhub/a.png','https://raw.githubusercontent.com/other/repo/a.png','http://127.0.0.1/'])assert.equal(brand.ownMedia(value),false);
});
