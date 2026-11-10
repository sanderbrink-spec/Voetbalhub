'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {runExitCode}=require('./scripts/automatic-publication');
test('expliciete productieproef is nooit groen bij geselecteerd nieuws maar nul gepubliceerde artikelen',()=>{
 const report={status:'no_new_verified_articles',counts:{selected:1,published:0}};
 assert.equal(runExitCode(report,{GITHUB_EVENT_NAME:'push'}),1);
 assert.equal(runExitCode(report,{GITHUB_EVENT_NAME:'workflow_dispatch'}),1);
 assert.equal(runExitCode(report,{GITHUB_EVENT_NAME:'schedule'}),0);
});
test('normale lege nieuwsronde blijft een geldige automatische broncontrole',()=>{
 const report={status:'no_new_verified_articles',counts:{selected:0,published:0}};
 assert.equal(runExitCode(report,{GITHUB_EVENT_NAME:'push'}),0);
 assert.equal(runExitCode({...report,focusSourceUrl:'https://www.fcgroningen.nl/nieuws/voorbeeld/'},{GITHUB_EVENT_NAME:'schedule'}),1);
});
test('zichtbaar gepubliceerd artikel mag na geslaagde redactiecontrole groen',()=>{
 assert.equal(runExitCode({status:'completed',counts:{selected:1,published:1}},{GITHUB_EVENT_NAME:'push'}),0);
});