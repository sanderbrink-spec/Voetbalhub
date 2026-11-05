'use strict';
// Review source files before invoking. This import never grants approval itself.
const fs=require('node:fs'),path=require('node:path'),L=require('../image-library49');
if(require.main===module){try{const incoming=JSON.parse(fs.readFileSync(process.argv[2],'utf8'));const existing=require('../image-library49.json');const merged=[...existing.assets,...incoming.assets];L.validate(merged);fs.writeFileSync(path.join(__dirname,'../image-library49.json'),JSON.stringify({...existing,assets:merged},null,2)+'\n');console.log('Geïmporteerd:',incoming.assets.length);}catch(e){console.error(e.message);process.exitCode=1;}}
