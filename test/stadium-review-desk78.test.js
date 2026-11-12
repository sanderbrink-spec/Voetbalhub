'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
test('Fase 78B: protected stadium review is part of the existing editorial desk without automatic approval',()=>{
 const html=fs.readFileSync(path.resolve(__dirname,'../public/publish-desk.html'),'utf8');
 const js=fs.readFileSync(path.resolve(__dirname,'../public/desk.js'),'utf8');
 assert.match(html,/id="loadStadiumReview"/);
 assert.match(html,/id="stadiumReviewGrid"/);
 assert.match(js,/\/editorial\/stadium-review74/);
 assert.match(js,/Authorization:'Bearer '\+secret/);
 assert.match(js,/URL\.revokeObjectURL/);
 assert.doesNotMatch(js,/autoApproveStadium|approval='approved'/);
 assert.match(js,/Geen automatische goedkeuring/);
});
