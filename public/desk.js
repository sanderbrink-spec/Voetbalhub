'use strict';
const $ = id => document.getElementById(id);
const M = window.DeskModel;
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let items = [], visible = [], activeFilter = 'all', selected = null, published = false, publishing = false;
let loadedOnce = false, serverClockOffset = 0, recoveryNotice = '', generating = false;
const queueNow = () => Date.now() + serverClockOffset;
const fields = ['category','headline','standfirst','body','fact1','fact2','extraFacts','source1','source2','imageUrl','imageSource','imageCredit','imageRights'];
const textChecks = ['sourceCheck','factCheck','duplicateCheck','languageCheck'];
const imageChecks = ['kitCheck','identityCheck','aiDisclosure'];
const draftKey = 'voetbalhubDeskWorkingDraftV2';
function safeLink(value) { return M.host(value) ? value : ''; }
async function request(path, options = {}) {
  let response;
  try { response = await fetch(path, {cache:'no-store', ...options, signal:AbortSignal.timeout(30000)}); }
  catch { throw Error('Geen antwoord binnen 30 seconden. Je bewerking blijft bewaard; probeer opnieuw.'); }
  let data;
  try { data = await response.json(); } catch { throw Error('De server gaf geen geldig antwoord. Probeer opnieuw.'); }
  if (!response.ok) throw Error(data.error || `Aanvraag mislukt (${response.status}).`);
  return data;
}
function preferences() {
  return {hours:$('ageWindow').value === 'all' ? 'all' : Number($('ageWindow').value),undated:$('includeUndated').checked,rss:$('includeRss').checked,english:$('includeEnglish').checked,search:$('searchDrafts').value,filter:activeFilter,sort:$('queueSort').value};
}
try {
  const p = JSON.parse(localStorage.getItem('voetbalhubDeskSettings') || '{}');
  if (p.ageWindow === 'all' || [24,36,48,72,168].includes(Number(p.ageWindow))) $('ageWindow').value = p.ageWindow;
  for (const id of ['includeUndated','includeRss','includeEnglish']) if (typeof p[id] === 'boolean') $(id).checked = p[id];
} catch { $('settingsStatus').textContent = 'Standaardinstellingen actief; browseropslag niet beschikbaar.'; }
$('saveSettings').onclick = () => {
  const p=preferences();
  try { localStorage.setItem('voetbalhubDeskSettings',JSON.stringify({ageWindow:p.hours,includeUndated:p.undated,includeRss:p.rss,includeEnglish:p.english})); $('settingsStatus').textContent='Instellingen opgeslagen op dit apparaat.'; }
  catch { $('settingsStatus').textContent='Instellingen gelden deze sessie; bewaren is niet toegestaan door de browser.'; }
  renderQueue();
};
function showAllSelection() {
  $('ageWindow').value='all';
  ['includeUndated','includeRss','includeEnglish'].forEach(id=>$(id).checked=true);
  $('searchDrafts').value='';activeFilter='all';
}
function renderQueue(recoverEmpty=false) {
  const now=queueNow(), p=preferences();
  visible = M.queue(items, p, now);
  const hiddenReasons = {};
  for (const item of items) {
    const reason=M.excludedBy(item,p,now);
    if(reason)hiddenReasons[reason]=(hiddenReasons[reason]||0)+1;
  }
  const labels={date:'nieuwsvenster of ontbrekende brondatum',rss:'RSS-filter',english:'taalfilter',search:'zoekopdracht',type:'gekozen overzicht',invalid:'onvolledige gegevens'};
  const reasonText=Object.entries(hiddenReasons).map(([key,count])=>`${count} door ${labels[key]}`).join(' · ');
  if (recoverEmpty && items.length && !visible.length) {
    showAllSelection();visible=M.queue(items,preferences(),now);
    recoveryNotice=`Je vorige selectie verborg alle ${items.length} geladen concepten${reasonText ? ': '+reasonText : ''}. Alle opgeslagen concepten worden nu getoond. Oudere berichten zijn als archief gemarkeerd.`;
  }
  $('queueNotice').hidden=!recoveryNotice;
  $('queueNotice').textContent=recoveryNotice;
  $('showAllDrafts').hidden=!items.length || (!Object.keys(hiddenReasons).length && preferences().hours==='all');
  $('queueTools').hidden = !items.length;
  $('queueCount').textContent = `${visible.length} zichtbaar · ${items.length} geladen${!visible.length && reasonText ? ' · Verborgen: '+reasonText : ''} · ${visible.filter(x=>M.paragraphs(x).length).length} met artikeltekst · ${visible.filter(M.rssOnly).length} alleen broninformatie`;
  document.querySelectorAll('[data-filter]').forEach(b=>b.classList.toggle('active',b.dataset.filter===activeFilter));
  $('queue').innerHTML = visible.length ? visible.map((x,i) => {
    const paragraphs=M.paragraphs(x), warnings=M.warnings(x), link=safeLink(x.source?.url || x.sourceUrl || ''), date=M.date(x);
    const ageLabel=!date?'Brondatum onbekend':date>now?'Toekomstige brondatum, controleren':now-date>36*3600000?'Archief · ouder dan 36 uur':'';
    return `<article class="card"><div class="queue-meta">${ageLabel ? `<span class="badge warn">${esc(ageLabel)}</span>` : ''}<span class="badge">${paragraphs.length?'Artikelconcept':'Nieuwsaanleiding'}</span><span class="badge">${esc(x.category||'Voetbal')}</span><span class="badge ${warnings.length?'warn':''}">${warnings.length} controlesignalen</span></div><h2>${esc(x.headline)}</h2><p class="muted">${date?new Date(date).toLocaleString('nl-NL'):'Brondatum onbekend'} · ${esc(M.host(link)||'Bron onbekend')}</p><p>${esc(x.standfirst||'Nog geen eigen intro geschreven.')}</p><p class="muted">${esc(x.sourcePolicy?.label || 'Bronbeleid nog beoordelen')} · ${paragraphs.length?'Artikeltekst nog beoordelen.':'Alleen broninformatie; schrijf een eigen artikel na feitencontrole.'}</p><details><summary>Controles en broninformatie</summary><p class="muted">Kwaliteitssignaal: ${esc(x.qualityReview?.qualityScore??'onbekend')}/100. Dit is geen feitencontrole.</p>${warnings.length?'<ul>'+warnings.map(w=>'<li>'+esc(w)+'</li>').join('')+'</ul>':'<p>Geen automatische waarschuwingen. Handmatige controle blijft nodig.</p>'}<p>${esc(x.qualityReview?.leadReviewReason||x.verification_notes||'Controleer de oorspronkelijke bron en concrete feiten.')}</p>${link?`<p><a href="${esc(link)}" target="_blank" rel="noopener noreferrer">Open oorspronkelijke bron ↗</a></p>`:''}${paragraphs.length?'<div class="article-text">'+paragraphs.map(p=>'<p>'+esc(p)+'</p>').join('')+'</div>':''}</details><button data-open="${i}" class="secondary">${paragraphs.length?'Bewerken en beoordelen':'Eigen artikel voorbereiden'}</button></article>`;
  }).join('') : '<div class="card">Geen concepten binnen deze selectie. Pas het nieuwsvenster of de filters aan.</div>';
  document.querySelectorAll('[data-open]').forEach(b=>b.onclick=()=>openItem(visible[Number(b.dataset.open)]));
}
$('load').onclick = async () => {
  const key=$('secret').value.trim();
  if (!key) { $('status').textContent='Vul eerst de redactiesleutel in.'; return; }
  $('load').disabled=true; $('status').textContent='Concepten ophalen…';
  try {
    const d=await request('/inbox',{headers:{Authorization:'Bearer '+key}});
    if (!Array.isArray(d.items)) throw Error('De server gaf geen conceptenlijst terug.');
    items=d.items;
    const serverTime=Date.parse(d.serverTime||'');
    serverClockOffset=Number.isFinite(serverTime)?serverTime-Date.now():0;
    recoveryNotice='';renderQueue(!loadedOnce);loadedOnce=true;
    $('status').textContent=`${items.length} concepten geladen om ${new Date().toLocaleTimeString('nl-NL')}. Publicatie blijft handmatig.`;
  } catch(e) { $('status').textContent=e.message; }
  finally { $('load').disabled=false; }
};
function applySelection(){recoveryNotice='';renderQueue();}
$('showAllDrafts').onclick=()=>{showAllSelection();recoveryNotice='Alle opgeslagen concepten worden getoond. Oudere berichten zijn als archief gemarkeerd.';renderQueue();};
$('searchDrafts').oninput=applySelection; $('queueSort').onchange=applySelection;
for (const id of ['ageWindow','includeUndated','includeRss','includeEnglish']) $(id).onchange=applySelection;
document.querySelectorAll('[data-filter]').forEach(b=>b.onclick=()=>{activeFilter=b.dataset.filter;applySelection();});
$('exportDrafts').onclick=()=>{
  const url=URL.createObjectURL(new Blob([JSON.stringify(visible,null,2)],{type:'application/json;charset=utf-8'}));
  const a=document.createElement('a'); a.href=url;a.download='voetbalhub-concepten-'+new Date().toISOString().slice(0,10)+'.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
};
$('copyHeadlines').onclick=async()=>{try{await navigator.clipboard.writeText(visible.map(x=>x.headline).join('\n'));$('queueCount').textContent=`${visible.length} zichtbare koppen gekopieerd.`;}catch{$('queueCount').textContent='Kopiëren niet beschikbaar; gebruik JSON-export.';}};
function resetChecks() { [...textChecks,...imageChecks,'generationFactCheck'].forEach(id=>$(id).checked=false); }
function checkedFacts() {
  return [...new Set([$ ('fact1').value,$ ('fact2').value,...$('extraFacts').value.split(/\n+/)].map(f=>f.trim()).filter(Boolean))].slice(0,20);
}
function payload() {
  return {approved:true, category:$('category').value.trim()||'Voetbal',draft:{headline:$('headline').value.trim(),standfirst:$('standfirst').value.trim(),body:$('body').value.split(/\n\s*\n/).map(s=>s.trim()).filter(Boolean),why_it_matters:''},verifiedFacts:checkedFacts(),sources:[$('source1').value.trim(),$('source2').value.trim()].filter(Boolean).map(url=>({url})),imageUrl:$('imageUrl').value.trim(),imageSource:$('imageSource').value.trim(),imageCredit:$('imageCredit').value.trim(),imageRights:$('imageRights').value,imageReview:{kitVerified:$('kitCheck').checked,playerIdentityVerified:$('identityCheck').checked,aiDisclosureVerified:$('aiDisclosure').checked},editorialChecks:{originalSourceReviewed:$('sourceCheck').checked,claimsIndependentlyChecked:$('factCheck').checked,duplicateChecked:$('duplicateCheck').checked,languageChecked:$('languageCheck').checked}};
}
function preview() {
  const d=payload().draft;
  $('articlePreview').innerHTML=`<p class="muted">Leesvoorbeeld · niet gepubliceerd</p><h2>${esc(d.headline||'Nog geen kop')}</h2><p><strong>${esc(d.standfirst)}</strong></p>${d.body.map(p=>'<p>'+esc(p)+'</p>').join('')}`;
}
function updatePreflight() {
  const p=payload(), issues=M.publicationIssues(p);
  $('preflight').innerHTML=`<strong>${issues.length?'Nog '+issues.length+' punten afronden':'Formulier compleet voor handmatige eindcontrole'}</strong>${issues.length?'<ul>'+issues.map(x=>'<li>'+esc(x)+'</li>').join('')+'</ul>':'<p>De server controleert inhoud en dubbele publicatie opnieuw wanneer je publiceert.</p>'}<p class="muted">${p.draft.headline.split(/\s+/).filter(Boolean).length} woorden in de kop · ${p.draft.body.length} alinea’s · ${p.verifiedFacts.length} gecontroleerde feiten${M.requiresFlashscore(p.draft)?' · Flashscore-controle vereist':''}</p>`;
  $('publish').disabled=published||publishing;
  preview();
}
function saveDraft() {
  if ($('editor').hidden || published) return;
  const values=Object.fromEntries(fields.map(id=>[id,$(id).value]));
  try {
    sessionStorage.setItem(draftKey,JSON.stringify({values,id:selected?.id||null,savedAt:new Date().toISOString()}));
    $('draftSaveStatus').textContent='Bewerking tijdelijk bewaard in dit browsertabblad. Sleutel en goedkeuringsvinkjes worden niet bewaard.';
    $('restoreDraft').hidden=false;
  } catch { $('draftSaveStatus').textContent='Bewerking kon niet worden bewaard. Houd deze pagina open totdat je klaar bent.'; }
}
function openItem(item, restoring=false) {
  if (publishing || generating) return false;
  if (!$('editor').hidden && !published && !confirm('Open een ander concept? De huidige bewerking wordt vervangen.')) return false;
  selected=item; published=false;
  fields.forEach(id=>$(id).value=''); $('imageRights').value='not_needed';resetChecks();
  $('category').value=item.category||'Voetbal';$('headline').value=item.headline||'';$('standfirst').value=item.standfirst||'';$('body').value=M.paragraphs(item).join('\n\n');
  $('source1').value=safeLink(item.source?.url||item.sourceUrl||'');
  $('editor').hidden=false;$('articlePreview').hidden=true;
  $('generationStatus').textContent='Maakt een concept en herstelt zo nodig één keer de tekst. API-kosten kunnen ontstaan. Het concept blijft privé.';
  $('publishStatus').textContent='Controleer de feiten en schrijf uitsluitend eigen tekst. Er is niets gepubliceerd.';
  updatePreflight();if(!restoring)saveDraft();$('editor').scrollIntoView({behavior:'smooth',block:'start'});$('headline').focus({preventScroll:true});return true;
}
$('newDraft').onclick=()=>openItem({});
$('restoreDraft').onclick=()=>{
  try {
    const d=JSON.parse(sessionStorage.getItem(draftKey)||'null');if(!d?.values)return;
    if(!openItem({id:d.id},true))return;
    for (const id of fields) if(typeof d.values[id]==='string')$(id).value=d.values[id];
    resetChecks();published=false;updatePreflight();$('publishStatus').textContent='Bewerking hersteld. Voer de controles opnieuw uit vóór publicatie.';
  } catch { $('draftSaveStatus').textContent='Geen herstelbare bewerking gevonden.'; }
};
try { $('restoreDraft').hidden=!sessionStorage.getItem(draftKey); } catch {}
for(const id of fields) $(id).addEventListener('input',()=>{if(published)return;resetChecks();updatePreflight();saveDraft();});
[...textChecks,...imageChecks].forEach(id=>$(id).onchange=updatePreflight);
$('previewToggle').onclick=()=>{$('articlePreview').hidden=!$('articlePreview').hidden;preview();};
$('cancel').onclick=()=>{if(publishing||generating)return;saveDraft();$('editor').hidden=true;selected=null;};
$('publish').onclick=async()=>{
  if(publishing||published||generating)return;
  const p=payload(),issues=M.publicationIssues(p),key=$('secret').value.trim();
  if(!key){$('publishStatus').textContent='Vul eerst de redactiesleutel in.';return;}
  if(issues.length){$('publishStatus').textContent='Publicatie geblokkeerd. Rond de bovenstaande punten af.';updatePreflight();return;}
  if(!confirm('Publiceer dit gecontroleerde artikel in de VoetbalHub-app?'))return;
  publishing=true;updatePreflight();
  // Freeze the form while the exact reviewed payload is submitted.
  const controls=[...$('editor').querySelectorAll('input,textarea,select,button')];controls.forEach(e=>e.disabled=true);
  try {
    const d=await request('/publish',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+key},body:JSON.stringify(p)});
    published=true;
    try{sessionStorage.removeItem(draftKey);}catch{}
    $('restoreDraft').hidden=true;
    $('publishStatus').textContent='Gepubliceerd. Artikel-ID: '+d.article.id;
    $('draftSaveStatus').textContent='Artikel gepubliceerd; tijdelijke bewerking verwijderd.';
    $('status').textContent='Publicatie geslaagd. Het artikel is beschikbaar voor de app.';
  }catch(e){$('publishStatus').textContent=e.message;}
  finally{publishing=false;controls.forEach(e=>e.disabled=false);updatePreflight();}
};

$("existingImageUrl").oninput=()=>{const url=$("existingImageUrl").value.trim(),preview=$("imagePreview");preview.replaceChildren();if(!safeLink(url)){preview.textContent="Voeg een HTTPS-fotolink toe om een voorbeeld te zien.";return}const img=document.createElement("img");img.alt="Voorbeeld van de gekozen foto";img.style.cssText="width:100%;max-height:260px;object-fit:cover;border-radius:12px";img.onerror=()=>{preview.textContent="Afbeelding kon niet geladen worden."};img.src=url;preview.appendChild(img)};
$("imageLoad").onclick=async()=>{try{const d=await request("/articles");const select=$("existingArticle");select.replaceChildren();for(const a of d.articles||[]){const option=document.createElement("option");option.value=a.id;option.textContent=a.headline;option.dataset.imageUrl=a.imageUrl||"";option.dataset.imageSource=a.imageSource||"";option.dataset.imageCredit=a.imageCredit||"";option.dataset.imageRights=a.imageRights||"cleared";select.appendChild(option)}$("imageLoading").textContent=(d.articles||[]).length+" artikelen beschikbaar";$("imageStatus").textContent="Kies een artikel en bekijk of er al een foto gekoppeld is.";select.onchange=()=>{const option=select.selectedOptions[0];if(!option)return;["existingKit","existingIdentity","existingDisclosure"].forEach(id=>$(id).checked=false);$("existingImageUrl").value=option.dataset.imageUrl||"";$("existingImageSource").value=option.dataset.imageSource||"";$("existingImageCredit").value=option.dataset.imageCredit||"";$("existingImageRights").value=["cleared","licensed"].includes(option.dataset.imageRights)?option.dataset.imageRights:"cleared";$("existingImageUrl").oninput();};select.onchange();}catch(e){$("imageStatus").textContent=e.message}};
$("existingArticle").closest("details").addEventListener("toggle",e=>{if(e.target.open&&!$("existingArticle").value)$("imageLoad").click()});
$("imageSave").onclick=async()=>{const id=$("existingArticle").value,key=$("secret").value.trim(),imageUrl=$("existingImageUrl").value.trim(),imageSource=$("existingImageSource").value.trim(),imageCredit=$("existingImageCredit").value.trim(),imageRights=$("existingImageRights").value;if(!id||!key||!imageUrl.startsWith("https://")||!imageSource||!imageCredit||!$("existingKit").checked||!$("existingIdentity").checked||!$("existingDisclosure").checked){$("imageStatus").textContent="Vul de redactiesleutel, beeldgegevens en alle controles in.";return}if(!confirm("Koppel deze goedgekeurde afbeelding aan het bestaande artikel?"))return;$("imageSave").disabled=true;try{const r=await fetch("/article-image",{method:"POST",headers:{"Content-Type":"application/json","Authorization":"Bearer "+key},body:JSON.stringify({approved:true,articleId:id,imageUrl,imageSource,imageCredit,imageRights,imageReview:{kitVerified:true,playerIdentityVerified:true,aiDisclosureVerified:true}})});const d=await r.json();if(!r.ok)throw Error(d.error||"Koppelen mislukt");$("imageStatus").textContent="Afbeelding gekoppeld. Ververs de app om het resultaat te zien."}catch(e){$("imageStatus").textContent=e.message}finally{$("imageSave").disabled=false}};

["existingImageUrl","existingImageSource","existingImageCredit","existingImageRights"].forEach(id=>$(id).addEventListener("input",()=>["existingKit","existingIdentity","existingDisclosure"].forEach(k=>$(k).checked=false)));

async function refreshService() {
  $('refreshService').disabled=true;
  try {
    const d=await request('/health');
    $('serviceStatus').textContent=(d.storage==='connected'?'Opslag verbonden. ':'Opslag tijdelijk niet bereikbaar; laden en publiceren zijn niet beschikbaar. ')+(d.aiConfigured?'AI-dienst ingesteld. ':'AI-dienst nog niet ingesteld. ')+(d.automaticSourceIngestion===false?'Automatische broninname staat uit. Maak een eigen concept uit gecontroleerde feiten.':'');
  } catch(e) { $('serviceStatus').textContent='Status niet beschikbaar. '+e.message; }
  finally { $('refreshService').disabled=false; }
}
$('refreshService').onclick=refreshService;
refreshService();
$('generateDraft').onclick=async()=>{
  if(generating||publishing||published)return;
  const key=$('secret').value.trim(),topic=$('headline').value.trim();
  const facts=checkedFacts();
  const sourceUrls=[$('source1').value.trim(),$('source2').value.trim()].filter(Boolean);
  if(!key||!topic||new Set(facts).size<2||sourceUrls.length<2||sourceUrls.some(u=>!M.host(u))||new Set(sourceUrls.map(M.host)).size<2||!$('generationFactCheck').checked){
    $('generationStatus').textContent='Vul je redactiesleutel, onderwerp, twee verschillende gecontroleerde feiten en twee HTTPS-bronlinks van verschillende websites in. Bevestig de feitencontrole.';return;
  }
  if(($('body').value.trim()||$('standfirst').value.trim())&&!confirm('Vervang de huidige kop, intro en tekst door een nieuw AI-concept op basis van deze feiten?'))return;
  saveDraft();generating=true;
  const controls=[...$('editor').querySelectorAll('input,textarea,select,button')];controls.forEach(e=>e.disabled=true);
  $('generationStatus').textContent='AI-concept wordt gemaakt. Je huidige bewerking blijft bewaard.';
  try{
    const d=await request('/draft',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+key},body:JSON.stringify({topic,category:$('category').value.trim()||'Voetbal',facts,sourceUrls})});
    if(!d.draft||M.draftIssues(d.draft).length)throw Error('Geen volledig en bruikbaar concept ontvangen. Je vorige tekst blijft staan.');
    $('headline').value=d.draft.headline;$('standfirst').value=d.draft.standfirst;$('body').value=d.draft.body.join('\n\n');
    resetChecks();saveDraft();preview();$('articlePreview').hidden=false;
    $('generationStatus').textContent='Nieuw concept gereed en tijdelijk bewaard. '+(d.draft.qualityReview?.revisionApplied?'De tekst is na de eerste controle gericht hersteld. ':'')+'De tekstcontroles zijn geslaagd; controleer de uiteindelijke feiten en bronnen vóór publicatie.';
    $('publishStatus').textContent='AI-concept ontvangen. Nog niet goedgekeurd en niet gepubliceerd.';
  }catch(e){$('generationStatus').textContent=e.message;}
  finally{generating=false;controls.forEach(e=>e.disabled=false);updatePreflight();}
};
