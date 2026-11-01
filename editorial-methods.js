'use strict';
const fs=require('node:fs'),path=require('node:path'),{digest}=require('./content-rights');
const FILES=['autonomous-editor.js','editorial-methods.js','content-rights.js','editorial-quality-model.js','server.js','editorial-ai.js','editorial-facts.js','editorial-desk-model.js','editorial-drafts.js','editorial-publication.js','own-editorial-art.js','newsroom-images.js','news-photo-catalog.json'];
function descriptor(method){return {id:method.id,version:1,implementation:digest(FILES.map(name=>({name,sha256:require('node:crypto').createHash('sha256').update(fs.readFileSync(path.join(__dirname,name))).digest('hex')}))),feeds:method.feeds,allowedCategories:method.allowedCategories,model:method.model,permissions:method.permissions,limits:{maxPerRun:3,maxPerDay:20,maxAgeHours:24},imageMethod:'licensed-editorial-photo-v1'};}
function load(file=process.env.EDITORIAL_METHODS_FILE||path.join(__dirname,'editorial-methods.json')){try{const d=JSON.parse(fs.readFileSync(file,'utf8'));return d.version===1&&Array.isArray(d.methods)?d.methods:[];}catch{return [];}}
function issues(method){const out=[];if(!/^[a-z][a-z0-9-]{2,60}$/.test(method?.id||''))out.push('Ongeldige methode-identiteit.');
 if(typeof method?.model!=='string'||!method.model.trim())out.push('Model ontbreekt.');
 if(!Array.isArray(method?.allowedCategories)||!method.allowedCategories.length||method.allowedCategories.some(c=>!['Eredivisie','Buitenland','Voetbal'].includes(c)))out.push('Bestaande toegestane categorieën ontbreken.');
 if(!['fetch','store-evidence','ai-input','publish-derived','commercial','own-artwork'].every(k=>method?.permissions?.[k]===true))out.push('Niet alle gebruiksrechten zijn onderbouwd.');
 const feeds=method?.feeds;if(!Array.isArray(feeds)||feeds.length<2||feeds.length>3)return [...out,'Twee of drie toegestane gestructureerde feeds zijn vereist.'];
 for(const f of feeds){try{const u=new URL(f.url);if(u.protocol!=='https:'||u.username||u.password||u.hash||u.search||require('node:net').isIP(u.hostname.replace(/[\[\]]/g,''))||!u.hostname.includes('.')||/\.(local|internal|localhost)$/.test(u.hostname))throw Error();}catch{out.push('Ongeldige vaste bron-URL.');}
 if(f.authEnv&&!/^FEED_[A-Z0-9_]{1,60}$/.test(f.authEnv))out.push('Ongeldige servercredentialverwijzing.');
 if(typeof f.ownerGroup!=='string'||!f.ownerGroup.trim()||typeof f.evidenceRef!=='string'||f.evidenceRef.trim().length<8)out.push('Eigenaarschap of bronrechtdossier ontbreekt.');}
 if(new Set(feeds.map(f=>f.ownerGroup)).size<2)out.push('Bronnen zijn niet onafhankelijk geregistreerd.');return [...new Set(out)];}
module.exports={descriptor,load,issues};
