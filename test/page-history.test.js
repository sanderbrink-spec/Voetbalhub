'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),Trail=require('../android-ui/assets/page-history');
test('Page history restores the previous club list, search query, tab and scroll without storing articles',()=>{
 const trail=new Trail(),clubs={tab:'clubs',clubId:null,scrollY:210};trail.push(clubs);clubs.tab='changed';assert.equal(trail.pop().tab,'clubs');
 const current={mode:'search',query:'Groningen',scrollY:330};trail.push({mode:'favorites',tab:'saved',scrollY:90});const stored=trail.capture(current),restored=new Trail();assert.deepEqual(restored.restore(JSON.stringify(stored)),current);assert.equal(restored.pop().tab,'saved');assert.equal(restored.pop(),null);
});
test('Internal Back is bounded and never includes full news records',()=>{const t=new Trail();for(let i=0;i<70;i++)t.push({tab:'stand',clubId:i});assert.equal(t.entries.length,40);assert.equal(t.pop().clubId,69);assert.equal(t.capture({tab:'stand'}).entries[0].clubId,30);});
