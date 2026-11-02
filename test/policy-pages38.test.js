'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),http=require('node:http'),{serve}=require('../policy-pages');
test('policy URLs serve honest test status with restrictive CSP, no tracking, and HEAD support',async()=>{
 const server=http.createServer((req,res)=>{if(!serve(req,res,new URL(req.url,'http://localhost').pathname)){res.writeHead(404);res.end();}});await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const base='http://127.0.0.1:'+server.address().port;
 try{for(const path of ['/privacy','/legal']){const r=await fetch(base+path),s=await r.text();assert.equal(r.status,200);assert.match(r.headers.get('content-security-policy'),/default-src 'none'/);assert.match(r.headers.get('content-security-policy'),/frame-ancestors 'none'/);assert.match(s,/nog niet/);assert.doesNotMatch(s,/<script|<iframe|<img/i);const head=await fetch(base+path,{method:'HEAD'});assert.equal(head.status,200);assert.equal(await head.text(),'');assert.equal(head.headers.get('content-length'),r.headers.get('content-length'));}assert.equal((await fetch(base+'/privacy/other')).status,404);assert.equal((await fetch(base+'/legal',{method:'POST'})).status,404);}
 finally{server.closeAllConnections();await new Promise(r=>server.close(r));}
});
