'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),http=require('node:http'),vm=require('node:vm'),{createRequire}=require('node:module'),{spawnSync}=require('node:child_process');
const root=path.join(__dirname,'..');
test('logo assets have PNG bytes matching their PNG filename and response type',()=>{
 for(const name of ['android-ui/drawable-nodpi/veldio_logo.png','public/brand/veldio-logo.png'])assert.equal(fs.readFileSync(path.join(root,name)).subarray(0,8).toString('hex'),'89504e470d0a1a0a');
});
test('all external automation CLI routes stop before credentials, HTTP or writes',()=>{
 for(const name of ['automatic-publication','auto-editor','eredivisie-official','eredivisie-data','eredivisie-covers','sync-article-covers','refresh-automatic-covers','youtube-videos','publish-one-trial','publish-column']){
  const r=spawnSync(process.execPath,[path.join(root,'scripts',name+'.js')],{cwd:root,encoding:'utf8',env:{PATH:process.env.PATH}});
  if(name==='automatic-publication'){assert.equal(r.status,1,name+': '+r.stderr);assert.match(r.stdout,/rights_blocked/,name);}
  else{assert.equal(r.status,0,name+': '+r.stderr);assert.match(r.stdout,/Veilig gestopt/,name);}
 }
 assert.equal(require('../launch-policy').allowed('not_a_scope'),false);
});
test('production-default server blocks automatic reservation and old automatic publication; serves legal pages',async()=>{
 const file=path.join(root,'server.js'),realRequire=createRequire(file);
 const fake={isReady:true,on(){},get:async()=>JSON.stringify({automation:{key:'1793448000000-11111111-1111-4111-8111-111111111111'},payload:{},status:'approved'})};
 const context={require:id=>id==='redis'?{createClient:()=>fake}:realRequire(id),process:{env:{REDIS_URL:'test://isolated',HUB_API_SECRET:'test-only'}},URL,Buffer,console,fetch,__dirname:root,module:{exports:{}}};
 vm.runInNewContext(fs.readFileSync(file,'utf8').replace(/start\(\);\s*$/,'module.exports={handle};'),context);
 const server=http.createServer((q,r)=>context.module.exports.handle(q,r));await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const base='http://127.0.0.1:'+server.address().port;
 try{
  for(const [url,body]of [['/editorial-drafts',{operation:'reserve_automatic',key:'x'}],['/publish',{editorialDraftId:'1793448000000-11111111-1111-4111-8111-111111111111',approved:true}]]){
   const response=await fetch(base+url,{method:'POST',headers:{Authorization:'Bearer test-only','Content-Type':'application/json'},body:JSON.stringify(body)});assert.equal(response.status,403);assert.match((await response.json()).error,/uitgeschakeld|geblokkeerd/);
  }
  assert.equal((await(await fetch(base+'/health')).json()).automaticEditorial.enabled,false);
  for(const url of ['/privacy','/legal']){const response=await fetch(base+url);assert.equal(response.status,200);assert.match(response.headers.get('content-security-policy'),/frame-ancestors 'none'/);assert.match(await response.text(),/nog niet/);}
 }finally{server.closeAllConnections();await new Promise(r=>server.close(r));}
});
test('contact sends no message without privacy readiness even if provider credentials exist',async()=>{
 let sent=0;const handler=require('../contact-mail').createContactHandler({env:{RESEND_API_KEY:'test-only',CONTACT_FROM:'test@example.com'},fetchImpl:()=>{sent++;throw Error('Must not send');}});
 const server=http.createServer(handler);await new Promise(r=>server.listen(0,'127.0.0.1',r));
 try{const response=await fetch('http://127.0.0.1:'+server.address().port,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:'Test',email:'test@example.com',subject:'Vraag',topic:'Vraag over de app',message:'Een voldoende lang testbericht voor controle.',website:'',requestId:'test-request-id-12345'})});assert.equal(response.status,503);assert.equal((await response.json()).accepted,undefined);assert.equal(sent,0);}finally{server.closeAllConnections();await new Promise(r=>server.close(r));}
});
