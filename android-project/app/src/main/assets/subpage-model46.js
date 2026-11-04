(function(root){
'use strict';
const normalize=v=>String(v??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
const groups=[['psv','psv eindhoven'],['az','az alkmaar'],['fc twente','twente'],['fc groningen','groningen'],['sc heerenveen','heerenveen'],['nec','n e c']];
function aliases(name){const n=normalize(name);return groups.find(g=>g.includes(n))||[n];}
function same(a,b){return !!normalize(a)&&!!normalize(b)&&aliases(a).some(x=>aliases(b).includes(x));}
function mentions(a,club){const text=' '+normalize([a.headline,a.standfirst,...(Array.isArray(a.tags)?a.tags:[])].join(' '))+' ';return aliases(club).some(x=>x&&text.includes(' '+x+' '));}
function articles(rows,{club='',competition='',now=Date.now(),maxAge=14*86400000}={}){
 const ids=new Set(),heads=new Set();return (rows||[]).filter(a=>a&&a.status==='published'&&a.id&&a.headline&&Number.isFinite(Date.parse(a.publishedAt))&&Date.parse(a.publishedAt)<=now&&now-Date.parse(a.publishedAt)<=maxAge).sort((a,b)=>Date.parse(b.publishedAt)-Date.parse(a.publishedAt)).filter(a=>{
  const key=normalize(a.headline);if(ids.has(a.id)||heads.has(key))return false;ids.add(a.id);heads.add(key);
  if(club&&!mentions(a,club))return false;
  return !competition||[a.competition,a.category,...(Array.isArray(a.tags)?a.tags:[])].some(x=>normalize(x)===normalize(competition));
 });
}
function current(s,now=Date.now()){const t=Date.parse(s?.updatedAt);return s?.rightsPolicyVersion===26&&s.rightsExpiresAt>now&&Number.isFinite(t)&&t<=now&&now-t<=36*3600000;}
function clubData(s,name,now=Date.now()){
 if(!current(s,now))return {available:false,last:[],next:null,standing:null};
 const matches=(s.fixtures||[]).filter(f=>f.home?.name&&f.away?.name&&Number.isFinite(Date.parse(f.date))&&(same(f.home.name,name)||same(f.away.name,name)));
 const seen=new Set(),last=matches.filter(f=>['FT','AET','PEN'].includes(f.status)&&Date.parse(f.date)<=now&&Number.isInteger(f.goals?.home)&&f.goals.home>=0&&Number.isInteger(f.goals?.away)&&f.goals.away>=0).sort((a,b)=>Date.parse(b.date)-Date.parse(a.date)).filter(f=>!seen.has(String(f.id))&&seen.add(String(f.id))).slice(0,5).map(f=>{
  const home=same(f.home.name,name),own=home?f.goals.home:f.goals.away,other=home?f.goals.away:f.goals.home;return {...f,result:own>other?'W':own===other?'G':'V'};
 });
 return {available:true,standing:(s.standings||[]).find(r=>same(r.team?.name,name))||null,last,next:matches.filter(f=>['NS','TBD'].includes(f.status)&&Date.parse(f.date)>now).sort((a,b)=>Date.parse(a.date)-Date.parse(b.date))[0]||null};
}
const api={normalize,aliases,same,mentions,articles,current,clubData};if(typeof module==='object'&&module.exports)module.exports=api;else root.Subpage46=api;
})(typeof window==='object'?window:globalThis);
