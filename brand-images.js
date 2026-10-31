'use strict';
const fs=require('node:fs'),path=require('node:path'),sharp=require('sharp');
const {ownMedia}=require('./brand');
function badge(){
 const logo=fs.readFileSync(path.join(__dirname,'public/brand/veldio-logo.png')).toString('base64');
 return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="480" height="130"><rect width="480" height="130" rx="12" fill="#04110a"/><image href="data:image/png;base64,${logo}" x="4" y="3" width="124" height="124"/><text x="146" y="64" fill="#f6f8f5" font-family="DejaVu Sans,Arial" font-weight="bold" font-size="46">Veldio</text><text x="147" y="96" fill="#aaff26" font-family="DejaVu Sans,Arial" font-size="18">Alles voetbal. Eén plek.</text></svg>`);
}
async function brandImage(bytes){
 const image=sharp(bytes,{limitInputPixels:4000000});const metadata=await image.metadata();
 if(!metadata.width||metadata.width<600||!metadata.height||metadata.height<300)throw Error('Unsupported editorial image');
 const width=Math.round(metadata.width*0.29),overlay=await sharp(badge()).resize({width}).png().toBuffer();
 return image.composite([{input:overlay,left:0,top:0}]).webp({quality:92}).toBuffer();
}
async function remoteImage(source,fetcher=fetch){
 if(!ownMedia(source))throw Error('Only existing images from the project repository are supported');
 const response=await fetcher(source,{redirect:'error',signal:AbortSignal.timeout(15000)});
 if(!response.ok||!/^image\/(?:png|jpeg|webp)(?:;|$)/i.test(response.headers.get('content-type')||'')||Number(response.headers.get('content-length'))>8000000)throw Error('Image unavailable');
 const reader=response.body.getReader();const chunks=[];let size=0;
 try {while(true){const {value,done}=await reader.read();if(done)break;size+=value.length;if(size>8000000)throw Error('Image too large');chunks.push(value);}}finally{reader.releaseLock();}
 return brandImage(Buffer.concat(chunks));
}
module.exports={badge,brandImage,remoteImage};
