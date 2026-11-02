'use strict';
async function dailyQuota(response) {
 if(response.status!==429||typeof response.clone!=='function')return false;
 try {
  const data=await response.clone().json();
  return /tokens per day|requests per day|\bTPD\b|\bRPD\b|daily (?:token |request )?(?:quota|limit)/i.test(String(data.error?.message||''));
 } catch {return false;}
}
function quotaError(){const error=new Error('Daglimiet redactionele AI bereikt; deze redactieronde is gestopt.');error.code='GROQ_DAILY_QUOTA';return error;}
module.exports={dailyQuota,quotaError};
