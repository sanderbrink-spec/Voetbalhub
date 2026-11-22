'use strict';
const HANDLE='nossport',PLAYLIST=null,TTL=24*60*60*1000;
const SEEDS=['8KFVxwMh0AY','3ttUN4--l8w','Qin52W-dlHs','N4GqqpkZ8_I','6IDlDFBzDvA'];
const valid=id=>/^[A-Za-z0-9_-]{11}$/.test(id||'');
async function json(url,fetcher){const r=await fetcher(url,{signal:AbortSignal.timeout(12000),redirect:'error'});if(!r.ok)throw Error('YouTube HTTP '+r.status);return r.json();}
async function collect({key,fetcher=fetch,now=Date.now(),previous}={}){
 let videos=[],playlistStatus='api-key-missing',warnings=[];
 let playlistUrl='https://www.youtube.com/@'+HANDLE;
 if(key){
  const api=(resource,args)=>{const u=new URL('https://www.googleapis.com/youtube/v3/'+resource);for(const [k,v]of Object.entries({...args,key}))u.searchParams.set(k,v);return json(u,fetcher);};
  try{
   // A channel's uploads playlist is owned by the verified channel and avoids
   // the stale, hand-written playlist ID that produced empty health checks.
   const channel=await api('channels',{part:'id,contentDetails',forHandle:HANDLE});
   const first=Array.isArray(channel.items)&&channel.items.length===1?channel.items[0]:null;
   const channelId=first?.id,uploads=first?.contentDetails?.relatedPlaylists?.uploads;
   if(!/^UC[A-Za-z0-9_-]{15,}$/.test(String(channelId||''))||
      !/^UU[A-Za-z0-9_-]{15,}$/.test(String(uploads||'')))
    throw Error('Officieel NOS-kanaal of upload-afspeellijst niet bevestigd');
   playlistUrl='https://www.youtube.com/playlist?list='+uploads;
   const items=[];let pageToken;
   for(let page=0;page<2;page++){
    const data=await api('playlistItems',{part:'contentDetails',playlistId:uploads,maxResults:50,...(pageToken?{pageToken}:{})});
    items.push(...(data.items||[]));pageToken=data.nextPageToken;
    if(!pageToken)break;
   }
   const ids=[...new Set(items.map(x=>x.contentDetails?.videoId).filter(valid))];
   for(let i=0;i<ids.length;i+=50){
    const data=await api('videos',{part:'snippet,status,contentDetails',id:ids.slice(i,i+50).join(',')});
    for(const v of data.items||[]){
     const s=v.snippet||{},published=Date.parse(s.publishedAt||'');
     if(typeof s.title!=='string'||!s.title.trim()||!valid(v.id)||
        v.status?.privacyStatus!=='public'||v.status?.uploadStatus!=='processed'||
        s.channelTitle!=='NOS Sport'||s.channelId!==channelId||
        !Number.isFinite(published)||published>now||now-published>30*86400000||
        !/\beredivisie\b/i.test(s.title))continue;
     videos.push({id:v.id,title:s.title,channel:s.channelTitle,channelId:s.channelId,
      publishedAt:new Date(published).toISOString(),url:'https://www.youtube.com/watch?v='+v.id,
      thumbnail:'https://i.ytimg.com/vi/'+v.id+'/hqdefault.jpg',
      embeddable:v.status.embeddable===true,verification:'youtube-data-api',
      verifiedAt:new Date(now).toISOString()});
    }
   }
   playlistStatus=videos.length?'available':'empty-or-no-verified-NOS-videos';
  }catch(e){playlistStatus='unavailable';warnings.push(e.message);}
 }
 // Official oEmbed, never watch-page scraping. Older highlights are visibly labelled as archive.
 if(!videos.length){for(const id of SEEDS){try{const d=await json('https://www.youtube.com/oembed?format=json&url='+encodeURIComponent('https://www.youtube.com/watch?v='+id),fetcher);if(typeof d.title!=='string'||!d.title.trim()||d.author_name!=='NOS Sport'||!/^https:\/\/www\.youtube\.com\/(?:@nossport|channel\/[A-Za-z0-9_-]+)\/?$/i.test(d.author_url||''))continue;videos.push({id,title:d.title,channel:d.author_name,channelUrl:d.author_url,publishedAt:null,url:'https://www.youtube.com/watch?v='+id,thumbnail:'https://i.ytimg.com/vi/'+id+'/hqdefault.jpg',embeddable:false,embedStatus:'not-confirmed-open-on-youtube',verification:'official-oembed',archive:true,verifiedAt:new Date(now).toISOString()});}catch(e){warnings.push(id+': '+e.message);}}}
 if(!videos.length&&previous&&Date.parse(previous.expiresAt)>now)return {...previous,warnings,playlistStatus};
 return {schemaVersion:43,updatedAt:new Date(now).toISOString(),expiresAt:new Date(now+TTL).toISOString(),playlistUrl,playlistStatus,source:playlistStatus==='available'?'Aangeleverde afspeellijst':'Geselecteerde NOS Sport-archiefvideo’s',videos,warnings};
}
module.exports={collect,valid,PLAYLIST,TTL};
