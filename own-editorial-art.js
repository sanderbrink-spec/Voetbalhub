'use strict';
/** Legacy entry point now uses the registered photographic newsroom. */
const images=require('./newsroom-images');
async function render(payload){return (await images.prepare(payload,{usedHashes:payload.usedImageHashes||[]})).bytes;}
module.exports={STYLE:images.STYLE,render};
