'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),model=require('../android-ui/assets/home-model');
test('a new publication replaces the oldest slide, ignores drafts and deduplicates IDs',()=>{
 const make=(id,date,status='published')=>({id,headline:'Artikel '+id,status,publishedAt:date});
 const old=[make('a','2026-11-01T12:00:00Z'),make('b','2026-11-01T11:00:00Z'),make('c','2026-11-01T10:00:00Z')];
 assert.deepEqual(model.recentArticles([...old,make('new','2026-11-01T13:00:00Z'),old[0],make('draft','2026-11-01T14:00:00Z','draft')]).map(a=>a.id),['new','a','b']);
 assert.equal(model.recentArticles([{...old[0],type:'column'}]).length,0);
});
