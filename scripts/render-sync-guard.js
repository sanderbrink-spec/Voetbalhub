'use strict';

// Reconciles public Render readiness with the current GitHub main SHA.
// Does not print API credentials, roll back releases or deploy an old commit.
const SERVICE = 'srv-dbdn1duq1p3s73965iq0';
const API = 'https://api.render.com/v1/services/' + SERVICE;
const READY = 'https://voetbalhub-redactie.onrender.com/ready';
const SHA = /^[a-f0-9]{40}$/;
const ACTIVE = new Set(['created','queued','build_in_progress','pre_deploy_in_progress','update_in_progress']);
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

function deploysFromApi(payload) {
 if (!Array.isArray(payload)) throw Error('Ongeldig antwoord van Render deployments API.');
 return payload.map(row => row?.deploy || row).filter(row => row && typeof row.status === 'string');
}
function deploymentDecision({deploys,sha,ready,graceExpired,requestedFor}) {
 if (!SHA.test(sha)) throw Error('Ongeldige GitHub hoofdversie.');
 if (ready?.ready === true && ready.revision === sha) return 'synced';
 const currentLive = deploys.find(d => d.status === 'live');
 const inProgress = deploys.find(d => ACTIVE.has(d.status));
 // A running deploy must finish before any recovery request.
 if (inProgress) return 'wait_deploy';
 // The exact commit is already live. A Redis/readiness failure is not
 // a reason to rebuild the same commit repeatedly.
 if (currentLive?.commit?.id === sha) return 'wait_readiness';
 if (requestedFor === sha) return 'wait_recovery';
 if (!graceExpired) return 'wait_autodeploy';
 return 'recover';
}
async function json(fetcher,url,options={}) {
 const response=await fetcher(url,{...options,signal:AbortSignal.timeout(14000)});
 if (!response.ok) throw Error('HTTP '+response.status);
 return response.json();
}
function githubRequestHeaders(env) {
 return {'Accept':'application/vnd.github+json','X-GitHub-Api-Version':'2022-11-28',
  ...(env.GITHUB_TOKEN?{'Authorization':'Bearer '+env.GITHUB_TOKEN}:{})};
}
async function mainRevision(fetcher,env) {
 const name=env.GITHUB_REPOSITORY;
 if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(name||'')) throw Error('GITHUB_REPOSITORY ontbreekt.');
 const ref=await json(fetcher,'https://api.github.com/repos/'+name+'/git/ref/heads/main',
  {headers:githubRequestHeaders(env)});
 const sha=ref?.object?.sha;
 if (!SHA.test(sha||'')) throw Error('GitHub main SHA ontbreekt.');
 return sha;
}
async function readiness(fetcher) {
 try {
  const r=await json(fetcher,READY);
  return {ready:r?.ready===true,revision:r?.revision??null};
 }catch{return {ready:false,revision:null};}
}
async function fetchDeploys(fetcher,env) {
 if (!env.RENDER_API_KEY) throw Error('RENDER_API_KEY ontbreekt; herstel niet mogelijk.');
 return deploysFromApi(await json(fetcher,API+'/deploys?limit=12',
  {headers:{'Authorization':'Bearer '+env.RENDER_API_KEY,'Accept':'application/json'}}));
}
async function recover(fetcher,env,sha) {
 // Pin the expected main SHA: never unintentionally deploy an older ref or a
 // moving implicit latest commit after a concurrent merge.
 const result=await json(fetcher,API+'/deploys',{
  method:'POST',
  headers:{'Authorization':'Bearer '+env.RENDER_API_KEY,'Content-Type':'application/json'},
  body:JSON.stringify({commitId:sha,clearCache:'do_not_clear'})
 });
 return result?.id??result?.deploy?.id??null;
}
async function reconcile({mode='guard',env=process.env,fetcher=fetch,clock=Date.now,pause=sleep,log=console.log,
 maxMs}={}) {
 if (!['guard','verify'].includes(mode)) throw Error('Ongeldige syncmodus.');
 const runtime=Number.isInteger(maxMs)?maxMs:(mode==='guard'?15*60*1000:9*60*1000);
 const start=clock();
 let previousSha='',shaSince=start,requestedFor='',recoveredOnce=false,cycle=0,latestDecision='';
 while (clock()-start<runtime) {
  cycle++;
  const sha=await mainRevision(fetcher,env);
  if (mode==='verify' && env.GITHUB_SHA!==sha) throw Error('Build-commit is niet meer de actuele main; verouderde APK/publicatie geweigerd.');
  if (sha!==previousSha) {
   previousSha=sha;
   shaSince=clock();
   log('Controle van GitHub main: '+sha);
  }
  const live=await readiness(fetcher);
  if (live.ready && live.revision===sha) {
   log('Bevestigd: Render /ready en GitHub main zijn identiek: '+sha);
   return {synced:true,sha,recovered:recoveredOnce};
  }
  if (mode==='verify') {
   if (cycle===1 || cycle%6===0) log('Build wacht op dezelfde gezonde Render-revisie: '+sha);
  } else {
   const deploys=await fetchDeploys(fetcher,env);
   const decision=deploymentDecision({deploys,sha,ready:live,
    graceExpired:clock()-shaSince>=45000,requestedFor});
   if (decision!==latestDecision) {
    log('Render status: '+decision+' voor commit '+sha);
    latestDecision=decision;
   }
   if (decision==='recover') {
    if (recoveredOnce) {
     // A branch update during a prior recovery is handled by the next push
     // guard, not by stacking requests in this run.
     log('Er is al één hersteluitrol aangevraagd; geen dubbele uitrol.');
    } else {
     // Prevent race with another guard: check main and Render once more.
     const stillMain=await mainRevision(fetcher,env);
     const newest=await fetchDeploys(fetcher,env);
     const finalDecision=deploymentDecision({deploys:newest,sha:stillMain,ready:await readiness(fetcher),
      graceExpired:clock()-shaSince>=45000,requestedFor});
     if (stillMain===sha && finalDecision==='recover') {
      await recover(fetcher,env,sha);
      requestedFor=sha;
      recoveredOnce=true;
      log('Eenmalige hersteluitrol gestart voor huidige main: '+sha);
     }
    }
   }
  }
  await pause(10000);
 }
 throw Error(mode==='guard'
  ?'Render is na de controles niet aantoonbaar gelijk aan GitHub main. Geen tweede hersteluitrol gestart.'
  :'Build geblokkeerd: Render is niet aantoonbaar gezond op dezelfde GitHub-main-commit.');
}
if (require.main===module) {
 reconcile({mode:process.argv[2]||'guard'}).catch(e=>{
  // Never echo raw HTTP response bodies that could contain credentials.
  console.error('Veldio Render synchronisatie: '+e.message);
  process.exitCode=1;
 });
}
module.exports={ACTIVE,deploysFromApi,deploymentDecision,mainRevision,readiness,reconcile};
