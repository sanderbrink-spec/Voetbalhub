'use strict';
// Import existing, independently reviewed assets only. This script never
// invents a visual score, turns a draft into approval, or buys an image.
// Usage: node scripts/import-images49.js checked-assets.json [--dry-run]
const fs=require('node:fs'),path=require('node:path');
const L=require('../image-library49');
const premium=require('../premium-match-images72');
const {inspect}=require('./premium-raster-preflight72');
async function importImages(file,{dryRun=false}={}){
 if(!file)throw Error('Geef een JSON-bestand met beoordeelde afbeeldingen op.');
 const incoming=JSON.parse(fs.readFileSync(file,'utf8'));
 if(!Array.isArray(incoming.assets)||!incoming.assets.length)throw Error('Geen beelden aangeleverd.');
 const outfile=path.join(__dirname,'../image-library49.json');
 const existing=JSON.parse(fs.readFileSync(outfile,'utf8'));
 const ids=new Set(existing.assets.map(a=>a.id));
 for(const asset of incoming.assets){
  if(ids.has(asset.id))throw Error('Bestaand beeld wordt niet automatisch overschreven: '+asset.id);
  if(!premium.isMatch(asset))continue;
  if(!premium.accepted(asset))throw Error('Nieuw wedstrijdbeeld mist onafhankelijke 8,5-goedkeuring en SHA-gebonden controle: '+asset.id);
  const scan=await inspect(asset.file);
  if(!scan.accepted||scan.sha256!==asset.sha256)
   throw Error('Rastercontrole mislukt voor '+asset.id+': '+[...scan.problems,...(scan.sha256===asset.sha256?[]:['Bestandshash wijkt af.'])].join(' '));
 }
 const merged=[...existing.assets,...incoming.assets];
 L.validate(merged);
 if(!dryRun){
  const next=outfile+'.next-'+process.pid;
  try{fs.writeFileSync(next,JSON.stringify({...existing,assets:merged},null,2)+'\n');fs.renameSync(next,outfile);}
  finally{if(fs.existsSync(next))fs.unlinkSync(next);}
 }
 return {count:incoming.assets.length,dryRun,reviewedPremium:incoming.assets.filter(premium.isMatch).length};
}
if(require.main===module)importImages(process.argv[2],{dryRun:process.argv.includes('--dry-run')})
 .then(result=>console.log(JSON.stringify(result)))
 .catch(error=>{console.error(error.message);process.exitCode=1;});
module.exports={importImages};
