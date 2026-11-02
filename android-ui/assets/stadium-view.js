'use strict';
let archive={articles:[],current:''},selected='';
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const href=u=>/^https:\/\//.test(u||'')?esc(u):'#';
const image=p=>/^[-a-z0-9]+\.webp$/.test(p?.file||'')?'news-photos/'+p.file:'';
function refs(ids){return (ids||[]).map(id=>{const s=archive.articles.find(a=>a.id===selected)?.sources.find(s=>s.id===id);return s?' <a href="'+href(s.url)+'" aria-label="Bron '+id+'">['+id+']</a>':'';}).join('');}
function photo(p){return '<figure><img src="'+image(p)+'" alt="'+esc(p.venue)+' · archiefbeeld"><figcaption>'+esc(p.caption)+'<br>'+esc(p.credit)+' · <a href="'+href(p.sourcePage)+'">Bron</a> · <a href="'+href(p.licenseUrl)+'">Licentie</a></figcaption></figure>';}
function renderStadium(){
 const a=archive.articles.find(a=>a.id===selected),root=document.getElementById('content');
 document.getElementById('archive').hidden=!a;
 if(!a){root.innerHTML='<div class="eyebrow">VELDIO · EIGEN RUBRIEK</div><h1>Stadion van de week</h1><p class="intro">De verhalen achter het stadion.</p><p class="note">Eerst Nederland, daarna de wereld. Een nieuw portret verschijnt alleen na bron- en beeldcontrole.</p>'+archive.articles.map(a=>'<button class="archive-card" data-id="'+esc(a.id)+'"><img src="'+image(a.image)+'" alt="'+esc(a.venue)+'"><div class="archive-copy"><div class="eyebrow">'+esc(a.club)+' · STADIONPORTRET</div><h2>'+esc(a.headline)+'</h2><span>Lees het portret →</span></div></button>').join('');return;}
 root.innerHTML='<article><div class="eyebrow">STADION VAN DE WEEK · '+esc(a.club)+'</div><h1>'+esc(a.headline)+'</h1><p class="intro">'+esc(a.standfirst)+'</p><p class="meta">'+esc(a.author)+' · '+a.wordCount+' woorden · Broncontrole '+esc(a.reviewedAt)+'</p>'+photo(a.image)+a.sections.map((s,i)=>'<h2>'+esc(s.heading)+'</h2><p>'+esc(s.text)+refs(s.sources)+'</p>'+(i===5&&a.gallery?.length?photo(a.gallery[0]):'')).join('')+'<div class="facts"><h2>Zes weetjes om mee te nemen</h2><ul>'+a.trivia.map(f=>'<li>'+esc(f.text)+refs(f.sources)+'</li>').join('')+'</ul></div><h2>Bronnen en verantwoording</h2><p class="note">Origineel Veldio-portret. Historische fotografie, geen actuele wedstrijdregistratie. Toekomstplannen zijn als plannen beschreven.</p><ol class="sources">'+a.sources.map(s=>'<li><a href="'+href(s.url)+'">'+esc(s.name)+'</a></li>').join('')+'</ol><button id="readArchive">Bekijk het stadionarchief →</button></article>';
 document.getElementById('readArchive').onclick=()=>showStadium('');
}
function showStadium(id){selected=id||'';renderStadium();window.scrollTo(0,0);}
function setStadiumData(raw){try{const data=JSON.parse(raw);if(data.schemaVersion===1&&Array.isArray(data.articles)){archive=data;renderStadium();}}catch{}}
window.setStadiumData=setStadiumData;window.showStadium=showStadium;
document.getElementById('archive').onclick=()=>showStadium('');
document.getElementById('back').onclick=()=>{if(selected)showStadium('');else if(window.StadiumHub)StadiumHub.close();};
document.addEventListener('click',e=>{const b=e.target.closest('[data-id]');if(b)showStadium(b.dataset.id);});
