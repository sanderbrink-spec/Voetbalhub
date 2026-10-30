'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {CHANNELS,parseFeed,selectVideos,collect}=require('../scripts/youtube-videos');
const now=Date.parse('2026-10-30T22:00:00Z');
const video=(id,title,age=0)=>({id,title,channelId:CHANNELS[0].id,publishedAt:new Date(now-age).toISOString(),channel:'ESPN NL'});
test('YouTube selection excludes stale, future, archive and non-Eredivisie clips; newest first and unique',()=>{
 const rows=[video('AAAAAAAAAAA','PSV bereidt zich voor',3600000),video('BBBBBBBBBBB','Ajax en AZ: de voorbeschouwing'),video('CCCCCCCCCCC','Ajax wint in Champions League'),video('DDDDDDDDDDD','Feyenoord beker samenvatting'),video('EEEEEEEEEEE','Ajax vrouwen'),video('FFFFFFFFFFF','PSV',8*86400000),video('GGGGGGGGGGG','Eredivisie',-1000),video('HHHHHHHHHHH','15 jaar geleden: Groningen wint van Feyenoord'),video('IIIIIIIIIII','Real Madrid wint'),{...video('JJJJJJJJJJJ','PSV'),channelId:'untrusted'},video('BBBBBBBBBBB','Ajax en AZ: de voorbeschouwing')];
 assert.deepEqual(selectVideos(rows,{now}).map(v=>v.id),['BBBBBBBBBBB','AAAAAAAAAAA']);
});
test('Official feed preserves real IDs and safely decodes titles and ignores mismatched channels',()=>{
 const xml='<feed><entry><yt:channelId>'+CHANNELS[0].id+'</yt:channelId><yt:videoId>AAAAAAAAAAA</yt:videoId><title>Ajax &amp; AZ &#x26BD;</title><published>2026-10-30T18:00:00Z</published><media:description><![CDATA[Eredivisie]]></media:description></entry></feed>';
 const rows=parseFeed(xml,CHANNELS[0]);assert.equal(rows[0].title,'Ajax & AZ ⚽');assert.equal(rows[0].url,'https://www.youtube.com/watch?v=AAAAAAAAAAA');assert.equal(parseFeed(xml,CHANNELS[1]).length,0);assert.throws(()=>parseFeed('<html>blocked</html>',CHANNELS[0]));
});
test('A complete source outage never replaces the previous selection with an empty snapshot',async()=>{await assert.rejects(collect({save:false,now,fetcher:async()=>{throw Error('offline');}}),/vorige selectie/);});
