'use strict';
const {githubFile}=require('./eredivisie-data');
// Official channel identities verified from each channel's externalId.
const CHANNELS=[
 {id:'UCXnPiEv1DoUCDAqDUXT9shQ',name:'ESPN NL'},
 {id:'UCGpf7WX7R1one-NwOvg_PbQ',name:'AFC Ajax'},
 {id:'UC_2ynsXrRrKP8zYrU7Hc06A',name:'PSV'},
 {id:'UCg_DGzRRIQlXpHxCrMMiAIQ',name:'Feyenoord'}
];
const MAX_AGE=7*86400000;
function decode(s){return String(s||'').replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g,'$1').replace(/&(#x[0-9a-f]+|#\d+|amp|lt|gt|quot|apos);/gi,(_,x)=>x[0]==='#'?String.fromCodePoint(Math.min(0x10ffff,parseInt(x.slice(x[1].toLowerCase()==='x'?2:1),x[1].toLowerCase()==='x'?16:10)||32)):({amp:'&',lt:'<',gt:'>',quot:'"',apos:"'"}[x.toLowerCase()])).trim();}
function parseFeed(xml,channel){
 if(!xml.includes('<feed')||!xml.includes('</feed>'))throw Error('Ongeldige YouTube-feed.');
 return [...xml.matchAll(/<entry>([\s\S]*?)<\/entry>/g)].map(([,entry])=>{
  const tag=name=>decode((entry.match(new RegExp('<'+name+'>([\\s\\S]*?)</'+name+'>'))||[])[1]);
  if(tag('yt:channelId')!==channel.id)return null;
  const id=tag('yt:videoId');if(!/^[\w-]{11}$/.test(id))return null;
  return {id,title:tag('title'),description:tag('media:description'),publishedAt:tag('published'),channel:channel.name,channelId:channel.id,url:'https://www.youtube.com/watch?v='+id,thumbnail:'https://i.ytimg.com/vi/'+id+'/hqdefault.jpg'};
 }).filter(Boolean);
}
function selectVideos(rows,{now=Date.now(),clubs=[]}={}){
 const names=['Ajax','PSV','Feyenoord','AZ','FC Twente','Twente','FC Groningen','Groningen','FC Utrecht','Utrecht','NEC','N.E.C.','Heerenveen','Fortuna Sittard','Go Ahead Eagles','PEC Zwolle','Sparta Rotterdam','NAC Breda','Excelsior','Telstar','Volendam','Cambuur','Willem II',...clubs];
 const esc=s=>s.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
 const relevant=new RegExp('(?:^|[^a-z0-9])(?:eredivisie|'+names.map(esc).join('|')+')(?:$|[^a-z0-9])','i');
 const excluded=/\b(jong ajax|jong psv|jong az|jong utrecht|jeugd|onder \d{2}|o1[0-9]|u[0-9]{1,2}s?|under[- ]?[0-9]{1,2}s?|rising stars|legacy|legends|pubquiz|messi cup|fcbayern|barça|barcelona|vriendenwedstrijd|oefenwedstrijd|friendly|vrouwen|women|champions league|europa league|conference league|knvb|beker|keuken kampioen|kkd|oranje|nederlands elftal|premier league|bundesliga|terugblik op|jaar geleden|throwback|retro|archief|historisch|classic)\b/i;
 const seen=new Set();return rows.filter(v=>{
  const date=Date.parse(v.publishedAt),text=(v.title+' '+(v.description||'').slice(0,400)).normalize('NFKC');
  if(!CHANNELS.some(c=>c.id===v.channelId)||!/^[\w-]{11}$/.test(v.id)||!v.title||!Number.isFinite(date)||date>now||now-date>MAX_AGE||!relevant.test(text)||excluded.test(text)||seen.has(v.id))return false;
  seen.add(v.id);return true;
 }).sort((a,b)=>Date.parse(b.publishedAt)-Date.parse(a.publishedAt)).slice(0,18).map(({description,...v})=>v);
}
async function collect({now=Date.now(),fetcher=fetch,token,save=true}={}){
 if(save)require('../rights-policy').requirePermission('youtubeSelection');
 const results=await Promise.allSettled(CHANNELS.map(async c=>{
  const r=await fetcher('https://www.youtube.com/feeds/videos.xml?channel_id='+c.id,{signal:AbortSignal.timeout(25000)});
  if(!r.ok)throw Error(c.name+': HTTP '+r.status);return parseFeed(await r.text(),c);
 }));
 const succeeded=results.filter(r=>r.status==='fulfilled');if(!succeeded.length)throw Error('Geen YouTube-kanaal bereikbaar; vorige selectie blijft behouden.');
 const snapshot={schemaVersion:1,updatedAt:new Date(now).toISOString(),maxAgeDays:7,source:'Officiële YouTube-kanalen',videos:selectVideos(succeeded.flatMap(r=>r.value),{now}),warnings:results.flatMap((r,i)=>r.status==='rejected'?[CHANNELS[i].name+' tijdelijk niet bereikbaar']:[])};
 if(save)await githubFile('videos/eredivisie.json',JSON.stringify(snapshot),{token,fetcher});
 return snapshot;
}
if(require.main===module)collect({token:process.env.GITHUB_TOKEN}).then(s=>console.log(JSON.stringify({updatedAt:s.updatedAt,videos:s.videos.length,warnings:s.warnings}))).catch(e=>{console.error(e.message);process.exitCode=1;});
module.exports={CHANNELS,MAX_AGE,decode,parseFeed,selectVideos,collect};
