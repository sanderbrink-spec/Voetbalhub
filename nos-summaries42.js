'use strict';
const HANDLE='nossport',CHANNEL_URL='https://www.youtube.com/@nossport';
const CLUBS=['FC Groningen','Sparta Rotterdam','Ajax','AZ','Feyenoord','Fortuna Sittard','PSV','Willem II','sc Heerenveen','NEC','N.E.C.','FC Twente','FC Utrecht','Go Ahead Eagles','PEC Zwolle','Telstar','Excelsior','FC Volendam','NAC Breda','SC Cambuur','ADO Den Haag'];
function select(items,channelId,now=Date.now()){
 const seen=new Set();return items.flatMap(v=>{
  const s=v.snippet||{},status=v.status||{},text=(s.title+' '+(s.description||'')).normalize('NFKC'),at=Date.parse(s.publishedAt);
  const round=text.match(/\bspeelronde\s*[:#-]?\s*(\d{1,2})\b/i);
  const season=text.match(/\b(20\d{2})\s*[-/]\s*(20\d{2}|\d{2})\b/);
  const teams=CLUBS.filter(c=>new RegExp('(?:^|[^a-zà-ž])'+c.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'(?:$|[^a-zà-ž])','i').test(s.title||''));
  if(!/^[\w-]{11}$/.test(v.id||'')||s.channelId!==channelId||status.privacyStatus!=='public'||!round||+round[1]<1||+round[1]>34||!season||!(/eredivisie/i.test(text))||!(/samenvatting/i.test(s.title||''))||teams.length!==2||!Number.isFinite(at)||at>now||now-at>30*86400000||/\b(vrouwen|jeugd|beker|oefen|archief|throwback)\b/i.test(text)||seen.has(v.id))return [];
  const start=+season[1],end=+season[2]<100?2000+(+season[2]):+season[2];if(end!==start+1)return [];
  seen.add(v.id);return [{id:v.id,title:s.title,match:teams.join(' – '),channel:'NOS Sport',channelId,publishedAt:s.publishedAt,round:+round[1],season:start+'-'+end,thumbnail:'https://i.ytimg.com/vi/'+v.id+'/hqdefault.jpg',url:'https://www.youtube.com/watch?v='+v.id,embeddable:status.embeddable===true}];
 });
}
function snapshot(rows,previous={},now=Date.now()){
 const groups=new Map();for(const r of rows){const k=r.season+':'+r.round;if(!groups.has(k))groups.set(k,[]);const g=groups.get(k);if(!g.some(v=>v.match===r.match))g.push(r);}
 const sorted=[...groups.values()].sort((a,b)=>b[0].season.localeCompare(a[0].season)||b[0].round-a[0].round);
 let selected=sorted.find(g=>g.length>=3);
 const previousFresh=previous.videos?.length&&Date.parse(previous.expiresAt)>now;
 if(previousFresh&&(!selected||previous.season>selected[0].season||previous.season===selected[0].season&&previous.round>selected[0].round))return previous;
 if(!selected&&previousFresh)return previous;
 selected=selected||[];
 return {schemaVersion:42,source:'NOS Sport · YouTube Data API v3',channelUrl:CHANNEL_URL,updatedAt:new Date(now).toISOString(),expiresAt:new Date(now+86400000).toISOString(),round:selected[0]?.round||null,season:selected[0]?.season||null,complete:selected.length===9,pendingRound:sorted[0]?.[0]?.round||null,videos:selected.sort((a,b)=>b.publishedAt.localeCompare(a.publishedAt)),message:selected.length?'Nog niet alle samenvattingen zijn beschikbaar.':'Open NOS Sport op YouTube voor de beschikbare samenvattingen.'};
}
async function collect({key,fetcher=fetch,previous={},now=Date.now()}={}){
 if(!key)return {...snapshot([],previous,now),warning:'YouTube Data API is nog niet geconfigureerd; veilige kanaallink blijft beschikbaar.'};
 async function api(resource,args){const url=new URL('https://www.googleapis.com/youtube/v3/'+resource);for(const [k,v]of Object.entries({...args,key}))url.searchParams.set(k,v);const r=await fetcher(url,{signal:AbortSignal.timeout(12000)});if(!r.ok)throw Error('YouTube API niet beschikbaar (HTTP '+r.status+')');return r.json();}
 const channels=await api('channels',{part:'id,contentDetails',forHandle:HANDLE});const c=channels.items?.[0];if(!c?.id||!c.contentDetails?.relatedPlaylists?.uploads)throw Error('Officieel NOS-kanaal niet bevestigd');
 const uploads=await api('playlistItems',{part:'contentDetails',playlistId:c.contentDetails.relatedPlaylists.uploads,maxResults:50});const ids=(uploads.items||[]).map(v=>v.contentDetails?.videoId).filter(id=>/^[\w-]{11}$/.test(id));if(!ids.length)throw Error('Geen video-ID’s beschikbaar');
 const videos=await api('videos',{part:'snippet,status,contentDetails',id:ids.join(',')});return snapshot(select(videos.items||[],c.id,now),previous,now);
}
module.exports={select,snapshot,collect,CHANNEL_URL};
