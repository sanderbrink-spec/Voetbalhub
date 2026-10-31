'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {assertMatch,svg,safeAsset}=require('../scripts/match-cover');
const fixture={id:1,date:'2026-11-01T12:00:00Z',status:'NS',home:{id:1,name:'Thuisclub',logo:'https://media.api-sports.io/a.png'},away:{id:2,name:'Uitclub',logo:'https://media.api-sports.io/b.png'},venue:{name:'Bevestigd stadion'},goals:{home:null,away:null}};
test('previews require the actual verified stadium, never a generic replacement',()=>{assert.throws(()=>assertMatch({kind:'preview',fixture}),/stadionbeeld/);const m={kind:'preview',fixture,venueVerified:true,stadiumImage:'https://media.api-sports.io/venue.png'};const s=svg(m,{home:'home',away:'away',stadium:'stadium'});assert.ok(s.includes('stadium'));assert.ok(s.includes('VOORBESCHOUWING'));assert.ok(!s.includes('EINDSTAND'));assert.ok(s.indexOf('Thuisclub')<s.indexOf('Uitclub'));});
test('reports require a completed result and show logos with the exact score',()=>{assert.throws(()=>assertMatch({kind:'report',fixture}),/eindstand/);const m={kind:'report',fixture:{...fixture,status:'FT',goals:{home:0,away:2}}};const s=svg(m,{home:'home',away:'away'});assert.ok(s.includes('0 – 2'));assert.ok(s.includes('EINDSTAND'));assert.ok(s.includes('NABESCHOUWING'));assert.ok(!s.includes('undefined'));});
test('fixture content and type determine a unique image, uncontrolled image hosts are blocked',()=>{const m={kind:'report',fixture:{...fixture,status:'FT',goals:{home:1,away:1}}};assert.notEqual(svg(m,{home:'x',away:'y'}),svg({...m,fixture:{...m.fixture,goals:{home:2,away:1}}},{home:'x',away:'y'}));assert.equal(safeAsset('https://media.api-sports.io/x.png'),true);assert.equal(safeAsset('https://evil.example/x.png'),false);});
test('a WebP stadium served with a PNG header is normalized and actually visible in the rendered cover',async()=>{
 const sharp=require('sharp'),{asset}=require('../scripts/match-cover'),{Resvg}=require('@resvg/resvg-js');
 const bytes=await sharp({create:{width:400,height:200,channels:3,background:{r:0,g:20,b:220}}}).webp().toBuffer();
 const policy=require('../rights-policy.json');
 const before=structuredClone(policy);
 policy.thirdPartyVisuals=true;
 policy.evidence.thirdPartyVisuals={commercialUse:true,reference:'Unit test: locally generated blue image only',expiresAt:'2099-01-01T00:00:00Z'};
 let normalized;
 try { normalized=await asset('https://media.api-sports.io/stadium.png',async()=>({ok:true,headers:new Headers({'content-type':'image/png'}),arrayBuffer:async()=>bytes})); } finally { Object.assign(policy,before); }
 assert.ok(normalized.startsWith('data:image/png;base64,'));
 const m={kind:'preview',fixture,venueVerified:true,stadiumImage:'https://media.api-sports.io/stadium.png'};
 const png=new Resvg(svg(m,{home:normalized,away:normalized,stadium:normalized})).render().asPng();
 const pixel=await sharp(png).extract({left:10,top:300,width:1,height:1}).removeAlpha().raw().toBuffer();
 assert.ok(pixel[2]>pixel[0]+30,'The verified stadium must remain visible, rather than silently disappearing.');
});
test('official short club names resolve to exact provider identities without choosing a similarly named foreign club',async()=>{
 const {resolveTeam}=require('../scripts/eredivisie-covers');
 const mock=async()=>({ok:true,json:async()=>({errors:[],response:[{team:{id:10,name:'PSV Eindhoven',country:'Netherlands',logo:'https://media.api-sports.io/logo.png'},venue:{id:20,name:'Philips Stadion'}}]})});
 assert.equal((await resolveTeam('PSV','key',mock)).venue.name,'Philips Stadion');
});
test('the same stadium photograph cannot be reused under another venue name even with a different provider ID',()=>{
 const {assertStadiumIdentity}=require('../scripts/match-cover');
 const arena='d3bae91b1f90f85b75da205cf43b18fe94743c33d83814afd02b832a4bc7af83';
 assert.doesNotThrow(()=>assertStadiumIdentity(arena,'Johan Cruijff Arena'));
 assert.throws(()=>assertStadiumIdentity(arena,'Philips Stadion'),/Verkeerd stadionbeeld/);
});
test('the PSV override is bound to the exact reviewed file and source stadium',async()=>{
 const fs=require('node:fs'),path=require('node:path'),{hash}=require('../scripts/eredivisie-data');
 const {stadiumFor}=require('../scripts/match-cover');
 const entry=require('../stadium-assets.json').reviewed.find(e=>e.venue==='Philips Stadion');
 assert.equal(hash(fs.readFileSync(path.join(__dirname,'../public/stadiums',entry.file))),entry.sha256);
 const choice=await stadiumFor({name:'Philips Stadion',provider:'API-SPORTS',id:1143},'',()=>{throw Error('Wrong provider image must not be requested');});
 assert.equal(choice.stadiumAsset,entry.file);assert.match(choice.stadiumSourceUrl,/www\.psv\.nl/);
});
