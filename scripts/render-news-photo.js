'use strict';
// One local, rights-registered photographic renderer shared by both legacy entry points.
const fs=require('node:fs'),path=require('node:path');
(async()=>{let raw='';for await(const chunk of process.stdin){raw+=chunk;if(raw.length>1000000)throw Error('Artikelinvoer te groot.');}const media=await require('../editorial-pipeline43').prepare(JSON.parse(raw));const output=process.argv[2];if(!output)throw Error('Uitvoerpad ontbreekt.');fs.mkdirSync(path.dirname(output),{recursive:true});fs.writeFileSync(output,media.bytes);console.log(media.imageReview.assetSha256);})().catch(e=>{console.error(e.message);process.exitCode=1;});
