'use strict';
const {createRouter,MODELS}=require('../editorial-provider-router');
async function preflight(env=process.env,fetcher=fetch){
 const router=createRouter({env,fetcher});const result={providers:router.configured(),costIncurred:0};
 for(const provider of result.providers){
  if(!provider.enabled){provider.access='not_tested';continue;}
  try{
   if(provider.provider==='openrouter'){
    const key=await fetcher('https://openrouter.ai/api/v1/key',{headers:{Authorization:'Bearer '+env.OPENROUTER_API_KEY},signal:AbortSignal.timeout(20000)});
    provider.access=key.ok?'valid_key':'unavailable';provider.zeroPriceEndpoint=await router.verifyOpenrouter();
   }else if(provider.provider==='groq'){
    const models=await fetcher('https://api.groq.com/openai/v1/models',{headers:{Authorization:'Bearer '+env.GROQ_API_KEY},signal:AbortSignal.timeout(20000)});
    provider.access=models.ok&&(await models.json()).data?.some(m=>m.id===MODELS.groq)?'valid_key_model_present':'unavailable';
   }else provider.access='generation_probe_required';
  }catch{provider.access='unavailable';}
 }
 return result;
}
if(require.main===module)preflight().then(result=>console.log(JSON.stringify(result)));
module.exports={preflight};
