'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {nationallyRelevant}=require('../scripts/automatic-publication');
const uefa={url:'https://www.uefa.com/uefachampionsleague/news/02ab-1234-5678--round-up/',title:'Champions League highlights and round-up: Real Madrid stay perfect',text:'Real Madrid win their match and take three points.'};
const club={url:'https://www.liverpoolfc.com/news/confirmed-line-up',title:'Confirmed line-up for tonight',text:'Liverpool have confirmed their starting XI for the Champions League match.'};
test('124C official senior European round-ups and confirmed line-ups enter research',()=>{
 assert.equal(nationallyRelevant(uefa,false),true);
 assert.equal(nationallyRelevant(club,false),true);
});
test('124C newly eligible routes exclude youth and unapproved domains',()=>{
 assert.equal(nationallyRelevant({...club,title:'Youth League confirmed line-up'},false),false);
 assert.equal(nationallyRelevant({...club,url:'https://example.org/news/confirmed-line-up'},false),false);
 assert.equal(nationallyRelevant({...club,title:'Predicted line-up for tonight'},false),false);
 assert.equal(nationallyRelevant({...uefa,title:'Champions League tickets and travel'},false),false);
});
