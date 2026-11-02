"use strict";
const {timingSafeEqual,createHash}=require('node:crypto');
function authorized(header,secret){if(!secret||!secret.trim()||typeof header!=='string')return false;const a=Buffer.from(header),b=Buffer.from('Bearer '+secret);return a.length===b.length&&timingSafeEqual(a,b);}
function createLimiter({now=Date.now,maxKeys=10000}={}){
 const buckets=new Map();return (key,limit=60)=>{const time=now();for(const [k,v] of buckets)if(v.until<=time)buckets.delete(k);
 const hash=createHash('sha256').update(key).digest('hex');if(!buckets.has(hash)){if(buckets.size>=maxKeys)return false;buckets.set(hash,{until:time+60000,count:0});}return ++buckets.get(hash).count<=limit;};
}
function originAllowed(origin,configured){if(!origin)return false;return String(configured||'').split(',').map(x=>x.trim()).filter(x=>{try{const u=new URL(x);return u.origin===x&&u.protocol==='https:';}catch{return false;}}).includes(origin);}
function harden(req,res,env=process.env){
 res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Referrer-Policy','strict-origin-when-cross-origin');res.setHeader('X-Frame-Options','DENY');res.setHeader('Permissions-Policy','camera=(), microphone=(), geolocation=()');
 if(env.NODE_ENV==='production')res.setHeader('Strict-Transport-Security','max-age=31536000');
 if(originAllowed(req.headers.origin,env.ALLOWED_ORIGINS)){res.setHeader('Access-Control-Allow-Origin',req.headers.origin);res.setHeader('Vary','Origin');}
}
module.exports={authorized,createLimiter,originAllowed,harden};
