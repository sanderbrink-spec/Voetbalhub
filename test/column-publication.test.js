'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),crypto=require('node:crypto');
const {prepareColumn,publishColumn}=require('../column-publication'),{publish}=require('../scripts/publish-column');
const request=()=>{const p=JSON.parse(fs.readFileSync('redactie/columns/publish.json','utf8'));delete p.manuscriptPath;return {...p,manuscript:fs.readFileSync('redactie/columns/ajax-buijs.md','utf8')};};
function memory(){const records=new Map();return {records,async get(k){return records.get(k)||null;},async keys(){return [...records.keys()];},async set(k,v,o){if(o?.NX&&records.has(k))return null;records.set(k,v);return 'OK';}};}
test('Full personally approved column retains every paragraph, short sentence, section and closing line',()=>{
 const r=request(),a=prepareColumn(r,'2026-10-30T22:00:00Z');assert.equal(a.headline,'Ajax pakt de punten, maar Danny Buijs steelt mijn bewondering');assert.equal(a.author,'Sander Brink');assert.equal(a.type,'column');assert.equal(a.manuscript,r.manuscript.trim());assert.ok(a.body.length>40);assert.ok(a.body.includes('Danny Buijs.'));assert.ok(a.body.includes('Dat is trainerswerk.'));assert.equal(a.blocks.filter(x=>x.type==='heading').length,5);assert.equal(a.body.at(-1),'Een mening hoeft niet iedereen te bevallen. Als hij maar ergens op gebaseerd is.');assert.equal(a.verificationStatus,'author_supplied_not_independently_audited');assert.equal(a.autoPublish,false);assert.match(a.id,/^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/);
});
test('Missing author approval, changed manuscript and malformed author cannot publish',()=>{for(const change of [{approved:false},{authorApproved:false},{intent:'news'},{author:'Other author'},{manuscript:request().manuscript+'\n\nToevoeging.'},{author:'Sander\nBrink'}])assert.throws(()=>prepareColumn({...request(),...change}));});
test('Repeated publication is idempotent and a changed column with the same title cannot create a duplicate',async()=>{
 const client=memory(),r=request(),first=await publishColumn(client,r);assert.equal(first.alreadyPublished,false);assert.equal((await publishColumn(client,r)).alreadyPublished,true);assert.equal(client.records.size,1);
 const changed={...r,manuscript:r.manuscript.trim()+'\n\nEen nieuwe passage.'};changed.expectedContentHash=crypto.createHash('sha256').update(changed.author+'\n'+changed.manuscript).digest('hex');await assert.rejects(publishColumn(client,changed),/al gepubliceerd/);assert.equal(client.records.size,1);
});
test('Publication runner requires the deployed capability and verifies exact public content',async()=>{
 const packet=request(),article=prepareColumn(packet),calls=[];
 const fetcher=async(url,options)=>{calls.push({url,options});if(url.endsWith('/health'))return {ok:true,json:async()=>({manualAuthorColumns:true,storage:'connected'})};if(url.endsWith('/publish-column'))return {ok:true,json:async()=>({status:'published',article,alreadyPublished:false})};return {ok:true,json:async()=>({articles:[article]})};};
 const result=await publish({packet,secret:'test-only',fetcher,attempts:1});assert.equal(result.id,article.id);assert.equal(calls[1].options.headers.Authorization,'Bearer test-only');assert.equal(JSON.parse(calls[1].options.body).manuscript,packet.manuscript);
 await assert.rejects(publish({packet,secret:'test-only',attempts:1,fetcher:async()=>({ok:true,json:async()=>({storage:'connected'})})}),/nog niet beschikbaar/);
});
