'use strict';
// Deterministic packaging of the existing approved logo. No new logo or app UI.
const fs=require('node:fs'),path=require('node:path'),sharp=require('sharp');
(async()=>{
 const destination=process.argv[2]||'play-assets';fs.mkdirSync(destination,{recursive:true});
 const logo=fs.readFileSync(path.join(__dirname,'../android-ui/drawable-nodpi/veldio_logo.png'));
 await sharp(logo).resize(512,512,{fit:'contain'}).ensureAlpha().png().toFile(path.join(destination,'icon-512.png'));
 const graphic=Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="500"><rect width="1024" height="500" fill="#070d09"/><rect x="455" y="88" width="3" height="324" fill="#b6ff32"/><image x="30" y="40" width="420" height="420" href="data:image/png;base64,${logo.toString('base64')}"/><g font-family="DejaVu Sans, sans-serif"><text x="505" y="235" font-size="76" font-weight="bold" fill="#f7faf7">Veldio</text><text x="508" y="295" font-size="30" fill="#b6ff32">Alles voetbal. Eén plek.</text></g></svg>`);
 await sharp(graphic).flatten({background:'#070d09'}).png().toFile(path.join(destination,'feature-1024x500.png'));
 fs.writeFileSync(path.join(destination,'README.md'),'# Veldio Play-assets\n\nTechnische exports van het bestaande goedgekeurde logo. Bronlogo en appvormgeving blijven ongewijzigd. Icon: 512×512 RGBA PNG. Feature graphic: 1024×500 RGB PNG. Rechten-/merkbevestiging en echte screenshots van de uiteindelijke Android-release blijven vereist. Geen synthetische browserbeelden als echte toestelscreenshots indienen.\n');
 console.log('Store asset formats exported from the unchanged approved logo. Publication rights and real device screenshots remain separate.');
})().catch(()=>{console.error('Play asset export failed.');process.exitCode=1;});
