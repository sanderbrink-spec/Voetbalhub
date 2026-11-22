'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),{collect}=require('../youtube-catalog43');
const mock=(status,data)=>({ok:status===200,status,json:async()=>data});
const channelId='UC12345678901234567890',uploads='UU12345678901234567890';
const published=new Date(Date.now()-2*86400000).toISOString();
const embed=id=>({author_name:'NOS Sport',author_url:'https://www.youtube.com/@nossport',title:'Samenvatting',html:'<iframe src="https://www.youtube.com/embed/'+id+'"></iframe>'});
test('official oEmbed fallback labels archive and never fabricates playlist membership or dates',async()=>{let calls=[];const d=await collect({now:1000,fetcher:async url=>{calls.push(String(url));const id=new URL(new URL(url).searchParams.get('url')).searchParams.get('v');return mock(200,embed(id));}});assert.equal(d.videos.length,5);assert.equal(d.playlistStatus,'api-key-missing');assert.ok(d.videos.every(v=>v.archive&&v.publishedAt===null&&v.embeddable===false&&v.embedStatus==='not-confirmed-open-on-youtube'));assert.ok(calls.every(u=>u.startsWith('https://www.youtube.com/oembed?')));});
test('playlist API filters private, removed and foreign channels; blocked embeds retain external link',async()=>{const id='abcdefghijk';const d=await collect({key:'test',fetcher:async url=>{const u=new URL(url);if(u.pathname.endsWith('channels'))return mock(200,{items:[{id:channelId,contentDetails:{relatedPlaylists:{uploads}}}]});if(u.pathname.endsWith('playlistItems'))return mock(200,{items:[{contentDetails:{videoId:id}}]});return mock(200,{items:[{id,snippet:{title:'Samenvatting Ajax - PSV | Eredivisie',channelTitle:'NOS Sport',channelId,publishedAt:published},status:{privacyStatus:'public',uploadStatus:'processed',embeddable:false}},{id:'zzzzzzzzzzz',snippet:{channelTitle:'Fake'},status:{privacyStatus:'public'}}]});}});assert.equal(d.playlistStatus,'available');assert.equal(d.videos.length,1);assert.equal(d.videos[0].embeddable,false);assert.equal(d.videos[0].archive,undefined);});
test('outage preserves only an unexpired previous catalogue',async()=>{const previous={expiresAt:new Date(2000).toISOString(),videos:[{id:'abcdefghijk'}]};const fetcher=async()=>mock(404,{});assert.equal((await collect({now:1000,previous,fetcher})).videos.length,1);assert.equal((await collect({now:3000,previous,fetcher})).videos.length,0);});
test('oEmbed rejects forged channel identity and malformed embeds',async()=>{const d=await collect({fetcher:async()=>mock(200,{author_name:'NOS Sport',author_url:'https://attacker.test/@nossport',title:'fake',html:'<iframe>'})});assert.equal(d.videos.length,0);});

test('only verified Data API embedding status enables the official in-app player',async()=>{const id='abcdefghijk';const d=await collect({key:'test',fetcher:async url=>{const u=new URL(url);if(u.pathname.endsWith('channels'))return mock(200,{items:[{id:channelId,contentDetails:{relatedPlaylists:{uploads}}}]});if(u.pathname.endsWith('playlistItems'))return mock(200,{items:[{contentDetails:{videoId:id}}]});return mock(200,{items:[{id,snippet:{title:'Samenvatting Ajax - PSV | Eredivisie',channelTitle:'NOS Sport',channelId,publishedAt:published},status:{privacyStatus:'public',uploadStatus:'processed',embeddable:true}}]});}});assert.equal(d.videos[0].embeddable,true);assert.equal(d.videos[0].verification,'youtube-data-api');});

test('108C uses the official upload playlist, not a stale hard-coded ID',async()=>{
 const requests=[];
 const d=await collect({key:'test',fetcher:async url=>{
  const u=new URL(url);requests.push(u);
  if(u.pathname.endsWith('channels'))return mock(200,{items:[{id:channelId,contentDetails:{relatedPlaylists:{uploads}}}]});
  if(u.pathname.endsWith('playlistItems'))return mock(200,{items:[{contentDetails:{videoId:'abcdefghijk'}}]});
  if(u.pathname.endsWith('videos'))return mock(200,{items:[{id:'abcdefghijk',
   snippet:{title:'Samenvatting Ajax - PSV | Eredivisie',channelTitle:'NOS Sport',channelId,publishedAt:published},
   status:{privacyStatus:'public',uploadStatus:'processed',embeddable:false}}]});
  throw Error('unexpected '+u.pathname);
 }});
 assert.equal(d.playlistUrl,'https://www.youtube.com/playlist?list='+uploads);
 assert.ok(requests.some(x=>x.pathname.endsWith('playlistItems')&&x.searchParams.get('playlistId')===uploads));
 assert.ok(requests.some(x=>x.pathname.endsWith('channels')&&x.searchParams.get('part')==='id,contentDetails'));
 assert.equal(d.videos.length,1);
 assert.equal(d.videos[0].embeddable,false);
});
test('108C never invents a playlist or embed rights when verification fails',async()=>{
 const d=await collect({key:'test',fetcher:async url=>{
  const u=new URL(url);
  if(u.pathname.endsWith('channels'))return mock(200,{items:[{id:channelId}]});
  return mock(404,{});
 }});
 assert.equal(d.videos.length,0);
 assert.equal(d.playlistStatus,'unavailable');
 assert.equal(d.playlistUrl,'https://www.youtube.com/@nossport');
});
test('metadata without a readable title never creates an empty video card',async()=>{const d=await collect({fetcher:async()=>mock(200,{...embed('abcdefghijk'),title:'  '})});assert.equal(d.videos.length,0);});
