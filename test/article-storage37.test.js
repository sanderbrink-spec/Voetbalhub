'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),{readPublished}=require('../article-storage');
test('archive batches include all published records, including latest beyond the old first 200 keys',async()=>{
 const keys=Array.from({length:300},(_,i)=>String(i)),batches=[];const client={mGet:async ks=>{batches.push(ks.length);return ks.map(id=>id==='1'?'bad json':JSON.stringify({id,status:id==='2'?'draft':'published'}));}};const rows=await readPublished(client,keys);assert.equal(rows.length,298);assert.ok(rows.some(r=>r.id==='299'));assert.deepEqual(batches,[64,64,64,64,44]);
});
test('archive storage failure or truncated batch rejects complete response rather than pretending content is missing',async()=>{
 await assert.rejects(readPublished({mGet:async()=>{throw Error('redis unavailable');}},['a']),/redis unavailable/);await assert.rejects(readPublished({mGet:async()=>[]},['a']),/INCOMPLETE/);await assert.rejects(readPublished({},Array(2001)),/ARCHIVE_REVIEW/);
});
test('compatible clients without mGet use at most eight concurrent reads and preserve order',async()=>{
 let active=0,peak=0;const rows=await readPublished({get:async id=>{peak=Math.max(peak,++active);await new Promise(r=>setTimeout(r,1));active--;return JSON.stringify({id,status:'published'});}},Array.from({length:150},(_,i)=>String(i)));assert.equal(peak,8);assert.equal(rows.length,150);assert.equal(rows[149].id,'149');
});
