'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),sharp=require('sharp');
const {brandImage,badge}=require('../brand-images');
test('Veldio frame replaces only the legacy masthead and retains fixture and photo-credit regions',async()=>{
 const input=await sharp({create:{width:1600,height:900,channels:3,background:'#1020d0'}})
  .composite([{input:Buffer.from('<svg width="1600" height="900"><rect width="1600" height="160" fill="#ed1010"/><rect x="60" y="850" width="100" height="30" fill="#10ed10"/></svg>'),top:0,left:0}]).png().toBuffer();
 const output=await brandImage(input,{kind:'preview',label:'Eredivisie'});const metadata=await sharp(output).metadata();assert.equal(metadata.width,1600);assert.equal(metadata.height,900);
 const pixel=async(x,y)=>sharp(output).extract({left:x,top:y,width:1,height:1}).removeAlpha().raw().toBuffer();
 const middle=await pixel(800,450),credit=await pixel(120,835),header=await pixel(800,40);
 assert.ok(middle[2]>middle[0]+100,'The original fixture graphic must remain visible');
 assert.ok(credit[1]>credit[0]+100,'Bottom photo-credit area must not be cropped out');
 assert.ok(header[0]<100,'The old red masthead must be replaced');
});
test('frame metadata uses the recorded article kind and escapes supplied labels',()=>{
 const preview=badge({kind:'preview',label:'A & <B>'}).toString();assert.match(preview,/VOORBESCHOUWING/);assert.match(preview,/A &amp; &lt;B&gt;/);assert.ok(!preview.includes('A & <B>'));
 assert.match(badge({kind:'report'}).toString(),/NABESCHOUWING/);
 assert.ok(!badge().toString().includes('VOORBESCHOUWING'));
});
