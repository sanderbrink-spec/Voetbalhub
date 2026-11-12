(function(root){'use strict';
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function spec(t){const name=String(t?.name||'Club');const n=name.toLowerCase();const clean=x=>/^#[0-9a-f]{6}$/i.test(x||'')?x:null;const directory=typeof window==='object'?window.VELDIO_CLUB_DIRECTORY||[]:[];const known=directory.find(x=>n===x.name.toLowerCase()||n.includes(x.name.toLowerCase()));const colors=known?.colours||t?.colours||[];let a=clean(colors[0])||clean(t?.color)||'#6b8275',b=clean(colors[1])||a,pattern='solid';
if(/ajax/.test(n)){a='#f3f0e8';b='#c6223e';pattern='centre';}else if(/groningen/.test(n)){a='#f5f5ef';b='#168550';pattern='groningen';}else if(/pec zwolle|^pec$/.test(n)){a='#f5f7fa';b='#1460ba';pattern='hoops';}else if(/excelsior/.test(n)){a='#d42936';b='#161719';pattern='stripe';}else if(/^az$|az alkmaar/.test(n)){a='#ca2433';b='#f5f3ef';pattern='az-sleeves';}else if(/psv|sparta|heracles|heerenveen|inter|atletico|dordrecht|den haag/.test(n))pattern='stripe';else if(/feyenoord|nec|n.e.c|go ahead eagles/.test(n))pattern='half';else if(/willem ii/.test(n))pattern='tricolor';else if(/utrecht|nac/.test(n))pattern='diagonal';
if(/barcelona/.test(n)){a='#a52546';b='#244c9a';pattern='stripe';}if(/atletico|atletico/.test(n)){a='#f0ede7';b='#c72e3b';pattern='stripe';}if(/paris saint|psg/.test(n)){a='#19305c';b='#be354d';pattern='centre';}if(/juventus/.test(n)){a='#e9e8df';b='#20252a';pattern='stripe';}if(/milan/.test(n)&&!/inter/.test(n)){a='#c33443';b='#242329';pattern='stripe';}if(/porto/.test(n)){a='#e8e9e2';b='#2563a6';pattern='stripe';}if(/benfica/.test(n))a=b='#c72f3b';if(/sporting/.test(n)){a='#e8ede4';b='#247b54';pattern='stripe';}if(/dortmund/.test(n)){a='#e7c82a';b='#222a26';}if(/napoli/.test(n))a=b='#61b3dc';if(/manchester city|man city/.test(n))a=b='#68b8dc';if(/real madrid/.test(n))a=b='#eeeae0';if(/bayern|liverpool|arsenal/.test(n))a=b='#c72e3b';if(/chelsea/.test(n))a=b='#2359ad';if(/inter/.test(n)){a='#1b62b3';b='#18202b';}
return {a,b,pattern};}
/* Veldio 90: original, scalable three-dimensional kit illustration.
   No official badges, manufacturer marks, sponsors, or copyrighted shirt graphics. */
const shirtCache=new Map();
function jerseySvg(team){
 const {a,b,pattern}=spec(team);
 const name=String(team?.name||'club').toLowerCase();
 const id='kit'+Array.from(name).reduce((v,c)=>(v*31+c.charCodeAt(0))>>>0,17).toString(36);
 const light='#f5f4f0',dark='#16191b';
 let paint='';
 if(pattern==='centre')paint='<rect x="24" y="13" width="14" height="68" fill="'+b+'"/>';
 else if(pattern==='half')paint='<rect x="31" y="13" width="32" height="69" fill="'+b+'"/>';
 else if(pattern==='tricolor')paint='<rect x="19" y="12" width="8" height="69" fill="'+light+'"/><rect x="27" y="12" width="8" height="69" fill="'+b+'"/><rect x="35" y="12" width="8" height="69" fill="'+light+'"/><rect x="43" y="12" width="8" height="69" fill="'+a+'"/>';
 else if(pattern==='hoops')paint='<path d="M0 27H62V38H0ZM0 50H62V62H0Z" fill="'+b+'"/>';
 else if(pattern==='groningen')paint='<path d="M16 11H25V83H16ZM37 11H46V83H37Z" fill="'+b+'"/>';
 else if(pattern==='az-sleeves')paint='<path d="M0 10H17V37H0ZM45 10H62V37H45Z" fill="'+b+'"/>';
 else if(pattern==='stripe')paint='<path d="M9 10H17V84H9ZM25 10H33V84H25ZM41 10H49V84H41ZM57 10H65V84H57Z" fill="'+b+'"/>';
 else if(pattern==='diagonal')paint='<path d="M-3 46L41 9H58L8 66Z" fill="'+b+'"/>';
 else paint='<path d="M0 11H62V26H0Z" fill="'+b+'"/>';
 // Respect reference kit pattern over fallback directory color ordering.
 let base=a;
 if(/willem ii/.test(name)){base='#f3f2f0';paint='<path d="M11 10H19V83H11ZM26 10H35V83H26ZM43 10H51V83H43Z" fill="#bf263c"/><path d="M18 10H26V83H18ZM35 10H43V83H35Z" fill="#214b99"/>';}
 if(/fortuna sittard/.test(name)){base='#e9c726';paint='<path d="M0 0H62V23H0Z" fill="#167c42"/>';}
 if(/ado den haag/.test(name)){base='#ebcf24';paint='<path d="M12 10H20V82H12ZM27 10H35V82H27ZM42 10H50V82H42Z" fill="#15814a"/>';}
 if(/excelsior/.test(name)){base='#bf2634';paint='<path d="M18 9H27V84H18ZM35 9H44V84H35Z" fill="#17191c"/>';}
 if(/pec zwolle/.test(name)){base='#f3f5f8';paint='<path d="M0 19H62V32H0ZM0 46H62V59H0Z" fill="#155ab2"/>';}
 if(/groningen/.test(name)){base='#f1f3ec';paint='<path d="M16 10H25V83H16ZM37 10H46V83H37Z" fill="#16864f"/>';}
 if(/^az$|az alkmaar/.test(name)){base='#cc2637';paint='<path d="M0 9H18V40H0ZM44 9H62V40H44Z" fill="#f0f0eb"/>';}
 if(/feyenoord/.test(name)){base='#d02a39';paint='<path d="M31 9H62V84H31Z" fill="#f1f0ec"/>';}
 if(/heerenveen/.test(name)){base='#f1f3f3';paint='<path d="M13 9H21V84H13ZM29 9H37V84H29ZM45 9H53V84H45Z" fill="#287bc0"/>';}
 if(/go ahead eagles/.test(name)){base='#c92b30';paint='<path d="M31 9H62V84H31Z" fill="#f3c22d"/>';}
 const outline='M19 7L25 3H37L43 7L57 13L62 31L49 36L45 28L45 80Q31 84 17 80L17 28L13 36L0 31L5 13Z';
 return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="-1 0 64 84" aria-hidden="true" focusable="false">'+
 '<defs><clipPath id="'+id+'c"><path d="'+outline+'"/></clipPath>'+
 '<linearGradient id="'+id+'l" x1="0" x2="1"><stop stop-color="#ffffff" stop-opacity=".22"/><stop offset=".18" stop-color="#ffffff" stop-opacity=".08"/><stop offset=".50" stop-color="#000" stop-opacity=".14"/><stop offset=".78" stop-color="#fff" stop-opacity=".12"/><stop offset="1" stop-color="#000" stop-opacity=".34"/></linearGradient>'+
 '<linearGradient id="'+id+'v" x1="0" y1="0" x2="0" y2="1"><stop stop-color="#fff" stop-opacity=".18"/><stop offset=".45" stop-color="#000" stop-opacity=".04"/><stop offset="1" stop-color="#000" stop-opacity=".28"/></linearGradient>'+
 '<filter id="'+id+'s" x="-25%" y="-20%" width="150%" height="150%"><feDropShadow dx="0" dy="3" stdDeviation="2.1" flood-color="#000" flood-opacity=".67"/></filter></defs>'+
 '<g filter="url(#'+id+'s)"><g clip-path="url(#'+id+'c)"><path d="'+outline+'" fill="'+base+'"/>'+paint+
 '<path d="M10 14Q18 27 18 40L16 70M52 14Q44 27 44 40L46 70" fill="none" stroke="#000" stroke-opacity=".17" stroke-width="2"/>'+
 '<path d="M22 16Q20 43 25 72M40 16Q42 43 37 72" fill="none" stroke="#fff" stroke-opacity=".13" stroke-width="2"/>'+
 '<path d="'+outline+'" fill="url(#'+id+'l)"/><path d="'+outline+'" fill="url(#'+id+'v)"/></g>'+
 '<path d="'+outline+'" fill="none" stroke="#f7fff0" stroke-opacity=".42" stroke-width=".9"/>'+
 '<path d="M24 3Q31 14 38 3L42 7Q31 21 20 7Z" fill="#111c17" stroke="#f3f3ed" stroke-width="1.6"/>'+
 '<path d="M0 31L13 36M49 36L62 31" fill="none" stroke="#f3f2ed" stroke-opacity=".35" stroke-width="1.6"/>'+
 '<path d="M17 78Q31 82 45 78" fill="none" stroke="#101b15" stroke-opacity=".4" stroke-width="1.6"/></g></svg>';
}
function shirt(team){
 const key=JSON.stringify([team?.name,team?.colours,team?.color]);
 if(!shirtCache.has(key)){
  if(shirtCache.size>=256)shirtCache.delete(shirtCache.keys().next().value);
  shirtCache.set(key,'<span class="club-shirt club-shirt90" role="img" aria-label="Veldio 3D-shirt '+esc(team?.name||'Club')+'" style="-webkit-mask:none;mask:none;background:transparent;">'+jerseySvg(team)+'</span>');
 }
 return shirtCache.get(key);
}

function prediction(p,f,now=Date.now()){const final=f&&['FT','AET','PEN'].includes(f.status)&&Date.parse(f.date)<=now&&[f.goals?.home,f.goals?.away].every(v=>Number.isInteger(v)&&v>=0);const points=final?(p.home===f.goals.home&&p.away===f.goals.away?3:Math.sign(p.home-p.away)===Math.sign(f.goals.home-f.goals.away)?1:0):null;const persisted=!final&&[0,1,3].includes(p.assessment?.points)&&p.assessment?.checkedAt;return {points:persisted?p.assessment.points:points,status:final||persisted?'beoordeeld':(f&&f.status!=='NS'||Date.parse(f?.date||p.kickoff)<=now)?'gesloten':'open'};}
function roundLabel(value){
 const label=String(value??'').trim();
 const number=label.match(/^(?:round|match\s*day|spieltag)\s*[.:–-]?\s*(\d+)$/i)?.[1]
  ??label.match(/^(\d+)\s*\.?\s*spieltag$/i)?.[1]
  ??label.match(/^Regular Season\s*-\s*(\d+)$/i)?.[1]
  ??label.match(/^(\d+)$/)?.[1];
 if(number)return 'Speelronde '+number;
 const phases={
  'regular season':'Reguliere competitie','league phase':'Competitiefase','group stage':'Groepsfase',
  'round of 16':'Achtste finales','achtelfinale':'Achtste finales','round of 32':'Zestiende finales',
  'quarter-finals':'Kwartfinales','quarter finals':'Kwartfinales','viertelfinale':'Kwartfinales',
  'semi-finals':'Halve finales','semi finals':'Halve finales','halbfinale':'Halve finales','final':'Finale'
 };
 return Object.hasOwn(phases,label.toLowerCase())?phases[label.toLowerCase()]:label||'Speelronde';
}
const api={shirt,prediction,roundLabel};if(typeof module==='object'&&module.exports)module.exports=api;else root.Football47=api;
})(typeof window==='object'?window:globalThis);
