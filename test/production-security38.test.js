'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),http=require('node:http'),path=require('node:path'),{createRequire}=require('node:module');
test('production server hardens responses, rejects arbitrary browser origins and bounds failed protected-route authorization',async()=>{
 const file=path.resolve('server.js'),real=createRequire(file),fake={isReady:true,on(){},get:async()=>null,keys:async()=>[]};
 const context={require:id=>id==='redis'?{createClient:()=>fake}:real(id),process:{env:{REDIS_URL:'test://isolated',HUB_API_SECRET:'test-secret',NODE_ENV:'production',ALLOWED_ORIGINS:'https://allowed.example'}},URL,Buffer,console,fetch,__dirname:path.dirname(file),module:{exports:{}}};
 vm.runInNewContext(fs.readFileSync(file,'utf8').replace(/start\(\);\s*$/,'module.exports={handle};'),context);
 const server=http.createServer((q,r)=>context.module.exports.handle(q,r));await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port;
 try{
  const good=await fetch(base+'/health',{headers:{Origin:'https://allowed.example'}});assert.equal(good.status,200);assert.equal(good.headers.get('access-control-allow-origin'),'https://allowed.example');assert.equal(good.headers.get('x-content-type-options'),'nosniff');assert.match(good.headers.get('strict-transport-security'),/31536000/);
  const dashboard='https://voetbalhub-redactiedashboard.onrender.com';
  const preflight=await fetch(base+'/football-review',{method:'OPTIONS',headers:{Origin:dashboard,'Access-Control-Request-Method':'POST','Access-Control-Request-Headers':'authorization, content-type'}});
  assert.equal(preflight.status,204);assert.equal(preflight.headers.get('access-control-allow-origin'),dashboard);assert.match(preflight.headers.get('access-control-allow-headers'),/Authorization/);assert.match(preflight.headers.get('access-control-allow-methods'),/POST/);
  const rejected=await fetch(base+'/football-review',{method:'OPTIONS',headers:{Origin:'https://evil.example'}});assert.equal(rejected.headers.get('access-control-allow-origin'),null);
  assert.equal((await fetch(base+'/football-review',{method:'POST',headers:{Origin:dashboard,'Content-Type':'application/json'},body:'{}'})).status,401);
  const evil=await fetch(base+'/health',{headers:{Origin:'https://evil.example'}});assert.equal(evil.headers.get('access-control-allow-origin'),null);
  for(let i=0;i<29;i++)assert.equal((await fetch(base+'/inbox')).status,401);
  const blocked=await fetch(base+'/inbox');assert.equal(blocked.status,429);assert.equal(blocked.headers.get('retry-after'),'60');
  assert.equal((await fetch(base+'/inbox',{headers:{Authorization:'Bearer test-secret'}})).status,200);
  assert.equal((await fetch(base+'/health')).status,200);
 }finally{server.closeAllConnections();await new Promise(r=>server.close(r));}
});
