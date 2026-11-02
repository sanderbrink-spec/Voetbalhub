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
function stadiumImage(m){if(m?.phase==='report'&&['own-weekly-score-v1','licensed-weekly-photo-v1'].includes(m.imageReview?.method)&&String(m.imageReview.fixtureId)===String(m.fixture?.id)&&JSON.stringify(m.imageReview.goals)===JSON.stringify(m.fixture?.goals)&&/^https:\/\//.test(m.imageUrl||''))return m.imageUrl;const review=m?.imageReview,venue=m?.fixture?.venue?.name;const norm=s=>String(s||'').toLowerCase().replace(/[^a-z0-9]/g,'');return review?.method==='fixture-specific-stadium-and-logos-v4'&&venue&&norm(venue)===norm(review.stadiumVenueName)&&/^https:\/\//.test(review.stadiumImageUrl||'')?review.stadiumImageUrl:'';}
function playbackRequest(data,id,top,bottom,now=Date.now()){
 if(!videos(data,now).some(v=>v.id===id)||!Number.isFinite(top)||!Number.isFinite(bottom)||top<0||bottom-top<244||bottom>1800)return null;
 return {id,top,height:Math.ceil(bottom-top)};
}
function recentArticles(rows){return published(rows).filter(a=>!isColumn(a)).slice(0,3);}
const clubPhotos=[{"name":"Ajax","venue":"Johan Cruijff ArenA","cover":"news-photos/ajax-4c77b7ad3973.webp"},{"name":"Feyenoord","venue":"De Kuip","cover":"news-photos/feyenoord-d71e48ea2e5b.webp"},{"name":"PSV","venue":"Philips Stadion","cover":"news-photos/psv-bbbb1cfe5eae.webp"}];
const CLUBS=['Ajax','Feyenoord','PSV'];
function clubFor(article){const text=[article?.headline,article?.category,...(article?.topicTeams||[])].join(' ');return CLUBS.filter(c=>new RegExp('\\b'+c+'\\b','i').test(text));}
function spotlight(rows,now=Date.now(),previous=''){
 const today=Math.floor(now/86400000),order=CLUBS.map((_,i)=>CLUBS[(today+i)%3]);
 const recent=published(rows).filter(a=>!isColumn(a)&&Date.parse(a.publishedAt)<=now&&now-Date.parse(a.publishedAt)<=72*3600000&&a.editorialChecks?.claimsIndependentlyChecked===true&&a.editorialChecks?.originalSourceReviewed===true);
 const candidates=order.map(club=>({club,article:recent.find(a=>clubFor(a).includes(club))})).filter(x=>x.article);
 return candidates.find(x=>x.club!==previous)||candidates[0]||{club:order[0],article:null};
}
const model={clubPhotos,spotlight,clubFor,recentArticles,isColumn,published,currentMatch,videos,stadiumImage,playbackRequest};if(typeof module==='object'&&module.exports)module.exports=model;else root.HomeModel=model;
})(typeof window==='undefined'?globalThis:window);
