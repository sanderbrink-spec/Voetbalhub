'use strict';
const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const http = require('node:http');
const {createRequire} = require('node:module');
const runtime = require('../runtime-health');

test('real routes probe readiness and bound stalled feed reads without claiming a successful empty feed', async () => {
  const file=path.join(__dirname, '../server.js'), real=createRequire(file);
  let pong='PONG', pingCalls=0, deadline;
  const client={isReady:true,on(){},ping:async()=>{pingCalls++;return pong;},keys:()=>new Promise(()=>{})};
  const sha='4c2f54a550ac2edd6e5f43b61bd5b4c520c7f82b';
  const context={require:id=>id==='redis'?{createClient:()=>client}:id==='./runtime-health'?{...runtime,withDeadline:(fn,ms)=>{deadline=ms;return runtime.withDeadline(fn,20);}}:real(id),process:{env:{REDIS_URL:'test://isolated',RENDER_GIT_COMMIT:sha}},URL,Buffer,console,__dirname:path.dirname(file),module:{exports:{}}};
  vm.runInNewContext(fs.readFileSync(file,'utf8').replace(/start\(\);\s*$/, 'module.exports={handle};'),context);
  const server=http.createServer((req,res)=>context.module.exports.handle(req,res).catch(()=>{res.writeHead(500);res.end();}));
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const base='http://127.0.0.1:'+server.address().port;
  try {
    const health=await (await fetch(base+'/health')).json();
    assert.equal(health.revision,sha);
    assert.equal(pingCalls,0);
    let response=await fetch(base+'/ready');assert.equal(response.status,200);assert.equal((await response.json()).ready,true);
    pong='unexpected';response=await fetch(base+'/ready');assert.equal(response.status,503);assert.equal((await response.json()).ready,false);
    assert.equal(pingCalls,2);
    response=await fetch(base+'/articles');assert.equal(response.status,503);assert.match((await response.json()).error,/tijdelijk niet beschikbaar/);assert.equal(deadline,9000);
  } finally {
    server.closeAllConnections();await new Promise(resolve=>server.close(resolve));
  }
});
