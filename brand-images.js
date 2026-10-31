'use strict';
const path=require('node:path'),sharp=require('sharp');
const {ownMedia}=require('./brand');
const cache=new Map();
const escape=value=>String(value||'').slice(0,50).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));
function badge({kind='',label=''}={}){
 const section=kind==='preview'?'VOORBESCHOUWING':kind==='report'?'NABESCHOUWING':'WEDSTRIJD';
 return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="1600" height="900"><defs><linearGradient id="paper" x2="1" y2="1"><stop stop-color="#132d1e"/><stop offset="1" stop-color="#040a06"/></linearGradient><linearGradient id="rule"><stop stop-color="#b7ff31"/><stop offset="1" stop-color="#1adf72"/></linearGradient></defs><rect width="1600" height="900" fill="url(#paper)"/><path d="M1120 0h90l110 130L1430 0h105l-170 190h-77z" fill="#96ed31" opacity=".075"/><g font-family="DejaVu Sans,Arial,sans-serif"><text x="170" y="77" fill="#f0f6f1" font-size="48" font-weight="700">Veldio</text><text x="173" y="111" fill="#a9ff35" font-size="21">Alles voetbal. Eén plek.</text><text x="1540" y="64" text-anchor="end" fill="#a9ff35" font-size="23" font-weight="700">${section}</text><text x="1540" y="104" text-anchor="end" fill="#cadbd0" font-size="22">${escape(label)}</text></g><rect x="30" y="145" width="1540" height="3" rx="1" fill="url(#rule)"/><rect x="29" y="154" width="1542" height="714" rx="15" fill="#06100a" stroke="#416147"/><rect x="728" y="883" width="144" height="3" rx="1" fill="#a9ff35"/></svg>`);
}
async function brandImage(bytes,context={}){
 const image=sharp(bytes,{limitInputPixels:4000000});const metadata=await image.metadata();
 if(!metadata.width||metadata.width<600||!metadata.height||metadata.height<300)throw Error('Unsupported editorial image');
 // Legacy fixture graphics reserve their top 18% for the old masthead. Replace
 // that chrome; the teams, fixture facts, stadium and bottom photo credit remain.
 const top=Math.round(metadata.height*160/900);
 const content=await image.extract({left:0,top,width:metadata.width,height:metadata.height-top}).resize({width:1540,height:712,fit:'contain',background:'#06100a'}).png().toBuffer();
 const logo=await sharp(path.join(__dirname,'public/brand/veldio-logo.png')).resize(116,116).png().toBuffer();
 return sharp(badge(context)).composite([{input:content,left:30,top:155},{input:logo,left:32,top:14}]).webp({quality:94}).toBuffer();
}
async function remoteImage(source,fetcher=fetch,context={}){
 if(!ownMedia(source))throw Error('Only existing images from the project repository are supported');
 const key=source+'\n'+String(context.kind||'')+'\n'+String(context.label||'').slice(0,50);
 const hit=cache.get(key);if(hit&&Date.now()-hit.at<3600000)return hit.bytes;
 const response=await fetcher(source,{redirect:'error',signal:AbortSignal.timeout(15000)});
 if(!response.ok||!/^image\/(?:png|jpeg|webp)(?:;|$)/i.test(response.headers.get('content-type')||'')||Number(response.headers.get('content-length'))>8000000)throw Error('Image unavailable');
 const reader=response.body.getReader();const chunks=[];let size=0;
 try {while(true){const {value,done}=await reader.read();if(done)break;size+=value.length;if(size>8000000){await reader.cancel();throw Error('Image too large');}chunks.push(value);}}finally{reader.releaseLock();}
 const bytes=await brandImage(Buffer.concat(chunks),context);if(cache.size>=16)cache.delete(cache.keys().next().value);cache.set(key,{at:Date.now(),bytes});return bytes;
}
module.exports={badge,brandImage,remoteImage};
