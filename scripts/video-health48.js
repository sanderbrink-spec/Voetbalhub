'use strict';
const fs=require('node:fs');
const {request}=require('./production-health48');
(async()=>{
 let report={checkedAt:new Date().toISOString(),status:'fail'};
 try{const s=await request('https://voetbalhub-redactie.onrender.com/integrations/videos43');report={...report,playlistStatus:s.playlistStatus,count:s.videos?.length||0,expiresAt:s.expiresAt};if(s.videos?.length&&Date.parse(s.expiresAt)>Date.now())report.status='pass';}catch(e){report.error=e.message;}
 fs.mkdirSync('.quality-output',{recursive:true});fs.writeFileSync('.quality-output/video-health.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));process.exitCode=report.status==='pass'?0:1;
})();
