'use strict';
// Read-only technical precheck. Does not replace the operational/legal launch decision.
async function checkBackend(endpoint,{fetcher=fetch,now=Date.now()}={}){
 const url=new URL(endpoint);
 if(url.protocol!=='https:'||url.username||url.password||url.search||url.hash||url.pathname!=='/articles')throw Error('Release requires a fixed HTTPS /articles endpoint.');
 async function get(path){const r=await fetcher(url.origin+path,{redirect:'error',signal:AbortSignal.timeout(20000),headers:{Accept:'application/json'}});if(!r.ok)throw Error('Backend precheck unavailable: '+path);return r.json();}
 const [health,ready,feed]=await Promise.all([get('/health'),get('/ready'),get('/articles')]);
 if(health.ok!==true||health.storage!=='connected'||health.launchPolicyVersion<28||!Number.isFinite(health.launchPolicyVersion)||ready.ready!==true||ready.launchPolicyVersion<28||!Number.isFinite(ready.launchPolicyVersion))throw Error('Tested production backend or readiness not confirmed.');
 if(health.contact?.configured!==true)throw Error('Mail configuration is incomplete; actual delivery still needs separate evidence.');
 if(feed.rightsPolicyVersion!==26||!Number.isFinite(feed.rightsExpiresAt)||feed.rightsExpiresAt<=now||feed.rightsExpiresAt>now+310000||!Array.isArray(feed.articles)||!feed.articles.length)throw Error('Current rights-cleared production content is missing.');
 if(feed.articles.some(a=>!a||a.status!=='published'||typeof a.headline!=='string'||!a.headline.trim()||!Array.isArray(a.body)||!a.body.some(p=>typeof p==='string'&&p.trim())))throw Error('Production feed contains malformed articles.');
 return {technicalPrecheck:true,articles:feed.articles.length,launchDecision:'separate evidence required'};
}
if(require.main===module)checkBackend(process.env.EDITORIAL_API_URL||'https://voetbalhub-redactie.onrender.com/articles').then(r=>console.log(JSON.stringify(r))).catch(e=>{console.error(e.message);process.exitCode=1;});
module.exports={checkBackend};
