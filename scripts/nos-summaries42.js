'use strict';
const fs=require('node:fs'),{collect}=require('../nos-summaries42');
(async()=>{const file='videos/nos42.json',previous=JSON.parse(fs.readFileSync(file));if(!process.env.YOUTUBE_API_KEY){console.log('Geen bestaande YouTube API-configuratie. Kanaallink blijft actief; geen dienst geactiveerd.');return;}const data=await collect({key:process.env.YOUTUBE_API_KEY,previous});fs.writeFileSync(file,JSON.stringify(data,null,2)+'\n');console.log(JSON.stringify({videos:data.videos.length,round:data.round}));})().catch(e=>{console.error(e.message);process.exitCode=1;});
