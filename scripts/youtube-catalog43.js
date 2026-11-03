'use strict';
const fs=require('node:fs'),{collect}=require('../youtube-catalog43');
(async()=>{let previous;try{previous=JSON.parse(fs.readFileSync('videos/catalog43.json'));}catch{}const data=await collect({key:process.env.YOUTUBE_API_KEY,previous});fs.writeFileSync('videos/catalog43.json',JSON.stringify(data,null,2)+'\n');fs.writeFileSync('android-ui/assets/youtube-catalog43.json',JSON.stringify(data)+'\n');console.log(JSON.stringify({videos:data.videos.length,playlistStatus:data.playlistStatus,warnings:data.warnings}));})().catch(e=>{console.error(e.message);process.exitCode=1;});
