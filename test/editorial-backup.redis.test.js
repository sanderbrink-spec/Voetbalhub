'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),crypto=require('node:crypto'),B=require('../editorial-backup');
test('encrypted editorial backup restores real Redis values and expiry; corrupt data and overwrite fail closed',{skip:!process.env.REDIS_TEST_URL},async()=>{
 const redis=require('redis').createClient({url:process.env.REDIS_TEST_URL});await redis.connect();const prefix='backup27:'+crypto.randomUUID()+':';const client={get:k=>redis.get(prefix+k),set:(k,v,o)=>redis.set(prefix+k,v,o),keys:async p=>(await redis.keys(prefix+p)).map(k=>k.slice(prefix.length)),eval:(s,o)=>redis.eval(s,{...o,keys:o.keys.map(k=>prefix+k)})};
 const key=crypto.randomBytes(32).toString('base64');try{
 await client.set('article:test',JSON.stringify({headline:'Private fictieve testtekst'}));await client.set('editorial:auto-budget:today','3',{EX:120});await client.set('contact:private','Must not be exported');
 const bytes=await B.exportSnapshot(client,key);assert.equal(bytes.includes(Buffer.from('Private fictieve testtekst')),false);assert.equal(bytes.includes(Buffer.from('contact:private')),false);await assert.rejects(B.restoreEmpty(client,bytes,key),/niet overschreven/);
 await redis.del([prefix+'article:test',prefix+'editorial:auto-budget:today']);assert.equal(await B.restoreEmpty(client,bytes,key),2);assert.equal(JSON.parse(await client.get('article:test')).headline,'Private fictieve testtekst');assert.ok(await redis.pTTL(prefix+'editorial:auto-budget:today')>0);
 const bad=JSON.parse(bytes.toString());bad.tag=crypto.randomBytes(16).toString('base64');await assert.rejects(B.restoreEmpty(client,Buffer.from(JSON.stringify(bad)),key));await assert.rejects(B.restoreEmpty(client,bytes,crypto.randomBytes(32).toString('base64')));
 }finally{const keys=await redis.keys(prefix+'*');if(keys.length)await redis.del(keys);await redis.quit();}
});
