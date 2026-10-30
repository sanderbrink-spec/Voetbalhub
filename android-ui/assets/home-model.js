(function(root){
'use strict';
const isColumn=a=>a&&(/^(column|de derde helft)$/i.test(a.type||'')||/^(column|de derde helft)$/i.test(a.category||''));
function published(rows){const seen=new Set();return(Array.isArray(rows)?rows:[]).filter(a=>a&&a.status==='published'&&a.id&&a.headline&&!seen.has(a.id)&&seen.add(a.id)).sort((a,b)=>(Date.parse(b.publishedAt)||0)-(Date.parse(a.publishedAt)||0));}
function currentMatch(stats,now=Date.now()){const feature=stats?.featured,fixture=feature?.preview?.fixture;if(stats?.schemaVersion!==1||stats?.league?.id!==88||!fixture?.home?.name||!fixture?.away?.name||!['NS','TBD'].includes(fixture.status)||!(Date.parse(fixture.date)>now))return null;return {...feature,fixture};}
function videos(data,now=Date.now()){const seen=new Set();return(Array.isArray(data?.videos)?data.videos:[]).filter(v=>v&&/^[\w-]{11}$/.test(v.id)&&v.title&&Date.parse(v.publishedAt)<=now&&now-Date.parse(v.publishedAt)<=7*86400000&&!seen.has(v.id)&&seen.add(v.id)).sort((a,b)=>Date.parse(b.publishedAt)-Date.parse(a.publishedAt));}
function stadiumImage(m){const review=m?.imageReview,venue=m?.fixture?.venue?.name;const norm=s=>String(s||'').toLowerCase().replace(/[^a-z0-9]/g,'');return review?.method==='fixture-specific-stadium-and-logos-v4'&&venue&&norm(venue)===norm(review.stadiumVenueName)&&/^https:\/\//.test(review.stadiumImageUrl||'')?review.stadiumImageUrl:'';}
function playbackRequest(data,id,top,bottom,now=Date.now()){
 if(!videos(data,now).some(v=>v.id===id)||!Number.isFinite(top)||!Number.isFinite(bottom)||top<0||bottom-top<244||bottom>1800)return null;
 return {id,top,height:Math.ceil(bottom-top)};
}
const model={isColumn,published,currentMatch,videos,stadiumImage,playbackRequest};if(typeof module==='object'&&module.exports)module.exports=model;else root.HomeModel=model;
})(typeof window==='undefined'?globalThis:window);
