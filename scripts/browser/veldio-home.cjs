'use strict';
const {chromium}=require('playwright'),fs=require('node:fs'),assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({headless:true});
 try{
  const [articles,stats]=await Promise.all([
   fetch('https://voetbalhub-redactie.onrender.com/articles').then(r=>{assert.ok(r.ok);return r.json();}),
   fetch('https://raw.githubusercontent.com/sanderbrink-spec/Voetbalhub/editorial-media/statistics/eredivisie.json').then(r=>{assert.ok(r.ok);return r.json();})
  ]);
  const html=fs.readFileSync('android-ui/assets/home-features.html','utf8').replace('<script src="home-model.js"></script>','<script>'+fs.readFileSync('android-ui/assets/home-model.js','utf8')+'</script>');
  const photo='data:image/webp;base64,'+fs.readFileSync('android-ui/drawable-nodpi/column_sander_brink_clean.webp').toString('base64');
  const errors=[];fs.mkdirSync('.browser-output',{recursive:true});
  for(const width of [320,360,393,412,550,768]){
   const page=await browser.newPage({viewport:{width,height:950}});page.on('pageerror',e=>errors.push(e.message));
   await page.setContent(html.replaceAll('column-portrait.webp',photo));
   await page.evaluate(x=>{window.calls=[];window.HomeHub={resize:()=>{},openColumn:()=>calls.push('column'),openMatch:()=>calls.push('match'),openArticle:id=>calls.push(id)};window.setData(JSON.stringify(x));},{articles:articles.articles,stats,videos:{videos:[]},loading:false});
   await page.locator('.column-card img').evaluate(i=>i.decode());
   const geometry=await page.evaluate(()=>{
    const card=document.querySelector('.column-card'),image=card.querySelector('img'),p=image.getBoundingClientRect(),rect=card.getBoundingClientRect();
    // Bounds of the face within the exact reference crop, before any scaling.
    const faceLeft=p.left+p.height*178/566,faceRight=p.left+p.height*450/566;
    const text=[...card.querySelectorAll('h2,.author,.tagline,.mini-label')].map(node=>{const range=document.createRange();range.selectNodeContents(node);return [...range.getClientRects()].map(r=>({right:r.right,bottom:r.bottom}));}).flat();
    return {overflow:document.documentElement.scrollWidth>innerWidth,faceLeft,faceRight,cardRight:rect.right,text};
   });
   assert.equal(geometry.overflow,false,'Horizontal overflow at '+width);
   assert.ok(geometry.faceRight<=geometry.cardRight+2,'Face cropped at '+width);
   assert.ok(geometry.text.every(r=>r.right<=geometry.faceLeft+2),'Text covers the face at '+width+': '+JSON.stringify(geometry));
   assert.equal(await page.locator('.slide').count(),3);
   const headline=await page.locator('.news-slide h1').innerText();assert.ok(articles.articles.some(a=>a.headline===headline));
   await page.locator('.column-card').click();assert.deepEqual(await page.evaluate(()=>calls),['column']);
   await page.getByRole('button',{name:'Vorig onderwerp'}).click();await page.getByRole('button',{name:'Volgend onderwerp'}).click();
   if(width===393)await page.screenshot({path:'.browser-output/veldio-home-mobile.png',fullPage:true});
   await page.close();
  }
  assert.deepEqual(errors,[]);console.log('Veldio home: 320–768 px, no horizontal overflow, exact photo face fully visible and clear of text, three slides, existing article content and column callback passed.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
