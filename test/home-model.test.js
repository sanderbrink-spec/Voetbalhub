'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),model=require('../android-ui/assets/home-model');
test('Latest article ignores drafts and duplicate IDs; column remains a separate subject',()=>{
 const a=(id,date,type='news')=>({id,publishedAt:date,headline:id,type,status:'published'});
 const rows=model.published([a('old','2026-10-29'),a('column','2026-10-30','column'),a('new','2026-10-30T20:00:00Z'),a('new','2026-10-30T20:00:00Z'),{...a('private','2026-10-31'),status:'draft'}]);assert.equal(rows.find(a=>!model.isColumn(a)).id,'new');assert.equal(rows.find(model.isColumn).id,'column');assert.equal(rows.length,3);
});
test('Finished and stale weekly matches are never offered as an upcoming preview',()=>{
 const now=Date.parse('2026-10-30');const stats={schemaVersion:1,league:{id:88},featured:{preview:{fixture:{status:'NS',date:'2026-10-31',home:{name:'Ajax'},away:{name:'AZ'}}}}};assert.ok(model.currentMatch(stats,now));assert.equal(model.currentMatch(stats,now+2*86400000),null);stats.featured.preview.fixture.status='FT';assert.equal(model.currentMatch(stats,now),null);
});
test('Cached videos expire on the device even if the refresh service fails',()=>{const now=Date.parse('2026-10-30T20:00Z');assert.equal(model.videos({videos:[{id:'AAAAAAAAAAA',title:'Ajax',publishedAt:'2026-10-20'}]},now).length,0);});

test('A stadium backdrop must match the verified venue, never use a cover with baked-in text',()=>{const m={fixture:{venue:{name:'Philips Stadion'}},imageReview:{method:'fixture-specific-stadium-and-logos-v4',stadiumVenueName:'Johan Cruijff Arena',stadiumImageUrl:'https://example.org/arena.png'}};assert.equal(model.stadiumImage(m),'');m.imageReview.stadiumVenueName='Philips Stadion';assert.equal(model.stadiumImage(m),'https://example.org/arena.png');});
