'use strict';
/** Legacy entry point now uses the registered photographic newsroom. */
const images=require('./editorial-pipeline43');
async function render(payload){return (await images.prepare(payload,{usedHashes:payload.usedImageHashes||[],usedPerceptualHashes:payload.usedPerceptualHashes||[]})).bytes;}
module.exports={STYLE:images.STYLE,render};
