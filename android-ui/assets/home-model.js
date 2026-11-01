(function(root){
'use strict';
const isColumn=a=>a&&(/^(column|de derde helft)$/i.test(a.type||'')||/^(column|de derde helft)$/i.test(a.category||''));
function published(rows){const seen=new Set();return(Array.isArray(rows)?rows:[]).filter(a=>a&&a.status==='published'&&a.id&&a.headline&&!seen.has(a.id)&&seen.add(a.id)).sort((a,b)=>(Date.parse(b.publishedAt)||0)-(Date.parse(a.publishedAt)||0));}
function currentMatch(stats,now=Date.now()){
 if(stats?.schemaVersion!==1||stats?.league?.id!==88)return null;
 function read(feature){const report=feature?.phase==='report',article=report?feature.report:feature?.preview,fixture=article?.fixture;if(!fixture?.home?.name||!fixture?.away?.name)return null;
  if(report&&(!['FT','AET','PEN'].includes(fixture.status)||!Number.isFinite(Date.parse(fixture.date))||Date.parse(fixture.date)>now||![fixture.goals?.home,fixture.goals?.away].every(n=>Number.isInteger(n)&&n>=0)))return null;
  const body=Array.isArray(article.body)&&article.body.length>=3&&article.body.every(p=>typeof p==='string'&&p.trim());
  if(!body&&(report||!['NS','TBD'].includes(fixture.status)||!(Date.parse(fixture.date)>now)))return null;
  const observed=feature.observedFixture;const live=!report&&observed&&String(observed.id)===String(fixture.id)&&['1H','HT','2H','ET','BT','P','LIVE'].includes(observed.status)&&now-Date.parse(stats.updatedAt)<10*60000&&Date.parse(stats.updatedAt)<=now;
  return {...feature,phase:report?'report':live?'live':'preview',fixture:live?observed:fixture,article};
 }
 const next=read(stats.nextFeatured);
 if(next&&next.phase==='preview'&&next.fixture.status==='NS'&&Date.parse(next.fixture.date)>now&&Date.parse(next.publishAt)===Date.parse(next.fixture.date)-72*3600000&&now>=Date.parse(next.publishAt)&&(!stats.rightsPolicyVersion||stats.rightsExpiresAt>now))return next;
 return read(stats.featured);
}
function videos(data,now=Date.now()){const seen=new Set();return(Array.isArray(data?.videos)?data.videos:[]).filter(v=>v&&/^[\w-]{11}$/.test(v.id)&&v.title&&Date.parse(v.publishedAt)<=now&&now-Date.parse(v.publishedAt)<=7*86400000&&!seen.has(v.id)&&seen.add(v.id)).sort((a,b)=>Date.parse(b.publishedAt)-Date.parse(a.publishedAt));}
function stadiumImage(m){if(m?.phase==='report'&&m.imageReview?.method==='own-weekly-score-v1'&&String(m.imageReview.fixtureId)===String(m.fixture?.id)&&JSON.stringify(m.imageReview.goals)===JSON.stringify(m.fixture?.goals)&&/^https:\/\//.test(m.imageUrl||''))return m.imageUrl;const review=m?.imageReview,venue=m?.fixture?.venue?.name;const norm=s=>String(s||'').toLowerCase().replace(/[^a-z0-9]/g,'');return review?.method==='fixture-specific-stadium-and-logos-v4'&&venue&&norm(venue)===norm(review.stadiumVenueName)&&/^https:\/\//.test(review.stadiumImageUrl||'')?review.stadiumImageUrl:'';}
function playbackRequest(data,id,top,bottom,now=Date.now()){
 if(!videos(data,now).some(v=>v.id===id)||!Number.isFinite(top)||!Number.isFinite(bottom)||top<0||bottom-top<244||bottom>1800)return null;
 return {id,top,height:Math.ceil(bottom-top)};
}
function recentArticles(rows){return published(rows).filter(a=>!isColumn(a)).slice(0,3);}
const model={recentArticles,isColumn,published,currentMatch,videos,stadiumImage,playbackRequest};if(typeof module==='object'&&module.exports)module.exports=model;else root.HomeModel=model;
})(typeof window==='undefined'?globalThis:window);
