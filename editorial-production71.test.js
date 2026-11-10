'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {EditorialQueue}=require('./editorial-production45');

test('onvoldoende gecontroleerde feiten is redactionele afwijzing, geen uitval',()=>{
 const queue=new EditorialQueue();
 const now=Date.parse('2026-11-10T14:00:00Z');
 const job=queue.enqueue([{url:'https://www.fcgroningen.nl/nieuws/voorbeeld/',text:'gecontroleerd bewijs'}],now);
 const error=new Error('Onvoldoende gecontroleerde feiten voor een inhoudelijk concept. Vul zo nodig aanvullende, verschillende feiten aan.');
 error.status=422;
 queue.fail(job,error,now,{stage:'generation'});
 assert.equal(job.status,'review');
 assert.equal(job.failureCategory,'journalistic_rejection');
 assert.equal(job.reason,'insufficient_verified_facts');
 assert.equal(queue.due(job,now+3600000),false);
});
test('echte generatiefout blijft technische fout',()=>{
 const queue=new EditorialQueue(), now=Date.parse('2026-11-10T14:00:00Z');
 const job=queue.enqueue([{url:'https://www.fcgroningen.nl/nieuws/voorbeeld/',text:'gecontroleerd bewijs'}],now);
 queue.fail(job,new TypeError('undefined is not an object'),now,{stage:'generation'});
 assert.equal(job.failureCategory,'generator_failure');
 assert.equal(job.reason,'software_error');
});
