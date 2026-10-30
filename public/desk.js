'use strict';
const $ = id => document.getElementById(id);
const M = window.DeskModel;
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let items = [], visible = [], activeFilter = 'all', selected = null, published = false, publishing = false;
let loadedOnce = false, serverClockOffset = 0, recoveryNotice = '', generating = false;
let ownRecords=[],savedRecord=null,lastSavedSnapshot='',saving=false;
const queueNow = () => Date.now() + serverClockOffset;
const fields = ['category','headline','standfirst','body','fact1','fact2','extraFacts','source1','source2','extraSources','reviewNotes','imageUrl','imageSource','imageCredit','imageRights','homeTeam','awayTeam','homeScore','awayScore','playedAt'];
const textChecks = ['sourceCheck','factCheck','duplicateCheck','languageCheck'];
const imageChecks = ['kitCheck','identityCheck','aiDisclosure'];
const factCheckIds=['resultVerified','namesVerified','dateVerified','timelineVerified'];
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
    const headers={Authorization:'Bearer '+key};
    const results=await Promise.allSettled([request('/inbox',{headers}),request('/editorial-drafts',{headers})]);
    if(results[1].status==='fulfilled'){ownRecords=results[1].value.items||[];renderOwnDrafts();}else{$('ownDraftStatus').textContent='Eigen artikelen konden niet worden geladen: '+results[1].reason.message;}
    if(results[0].status==='rejected')throw results[0].reason;
    const d=results[0].value;
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
function resetChecks() { [...textChecks,...imageChecks,...factCheckIds,'generationFactCheck'].forEach(id=>$(id).checked=false); }
function checkedFacts() {
  return [...new Set([$ ('fact1').value,$ ('fact2').value,...$('extraFacts').value.split(/\n+/)].map(f=>f.trim()).filter(Boolean))].slice(0,20);
}
function readMatch(){
 const values=Object.fromEntries(['homeTeam','awayTeam','homeScore','awayScore','playedAt'].map(id=>[id,$(id).value.trim()]));
 if(!Object.values(values).some(Boolean))return null;
 return {...values,homeScore:/^\d{1,2}$/.test(values.homeScore)?Number(values.homeScore):null,awayScore:/^\d{1,2}$/.test(values.awayScore)?Number(values.awayScore):null};
}
function sourceLinks(){return [...new Set([$ ('source1').value,$ ('source2').value,...$('extraSources').value.split(/\n+/)].map(s=>s.trim()).filter(Boolean))].slice(0,10);}
function payload() {
  return {approved:true,reviewNotes:$('reviewNotes').value.trim(),match:readMatch(),factChecks:Object.fromEntries(factCheckIds.map(id=>[id,$(id).checked])), category:$('category').value.trim()||'Voetbal',draft:{headline:$('headline').value.trim(),standfirst:$('standfirst').value.trim(),body:$('body').value.split(/\n\s*\n/).map(s=>s.trim()).filter(Boolean),why_it_matters:''},verifiedFacts:checkedFacts(),sources:sourceLinks().map(url=>({url})),imageUrl:$('imageUrl').value.trim(),imageSource:$('imageSource').value.trim(),imageCredit:$('imageCredit').value.trim(),imageRights:$('imageRights').value,imageReview:{kitVerified:$('kitCheck').checked,playerIdentityVerified:$('identityCheck').checked,aiDisclosureVerified:$('aiDisclosure').checked},editorialChecks:{originalSourceReviewed:$('sourceCheck').checked,claimsIndependentlyChecked:$('factCheck').checked,duplicateChecked:$('duplicateCheck').checked,languageChecked:$('languageCheck').checked}};
}
function preview() {
  const d=payload().draft;
  $('articlePreview').innerHTML=`<p class="muted">Volledig eigen artikel · ${savedRecord?.status==='published'?'gepubliceerd':savedRecord?.status==='approved'?'deze versie is goedgekeurd':'nog te beoordelen'}</p><h2>${esc(d.headline||'Nog geen kop')}</h2>${payload().reviewNotes?`<div class="card warn"><strong>Eindcontrole</strong><p>${esc(payload().reviewNotes)}</p></div>`:''}<p><strong>${esc(d.standfirst)}</strong></p>${d.body.map(p=>'<p>'+esc(p)+'</p>').join('')}${payload().match?`<h3>Vastgelegde wedstrijdfeiten</h3><p>${esc(payload().match.homeTeam)} – ${esc(payload().match.awayTeam)}<br>Eindstand thuis-uit: ${esc(payload().match.homeScore)}-${esc(payload().match.awayScore)}<br>Datum: ${esc(payload().match.playedAt)}</p>`:''}<h3>Gecontroleerde feiten</h3><ul>${checkedFacts().map(f=>'<li>'+esc(f)+'</li>').join('')}</ul><h3>Bronnen controleren</h3>${payload().sources.filter(s=>safeLink(s.url)).map(s=>`<p><a href="${esc(s.url)}" target="_blank" rel="noopener noreferrer">${esc(M.host(s.url))} ↗</a></p>`).join('')}`;
}
function updatePreflight() {
  const p=payload(), issues=M.publicationIssues(p);
  $('preflight').innerHTML=`<strong>${issues.length?'Nog '+issues.length+' punten afronden':'Formulier compleet voor handmatige eindcontrole'}</strong>${issues.length?'<ul>'+issues.map(x=>'<li>'+esc(x)+'</li>').join('')+'</ul>':'<p>De server controleert inhoud en dubbele publicatie opnieuw wanneer je publiceert.</p>'}<p class="muted">${p.draft.headline.split(/\s+/).filter(Boolean).length} woorden in de kop · ${p.draft.body.length} alinea’s · ${p.verifiedFacts.length} gecontroleerde feiten${M.requiresFlashscore(p.draft)?' · Flashscore-controle vereist':''}</p>`;
  $('publish').disabled=published||publishing||saving||issues.length>0||!approvalCurrent();
  $('approveServerDraft').disabled=published||publishing||saving;
  $('saveServerDraft').disabled=published||publishing||saving;
  $('generateDraft').disabled=published||publishing||saving||generating;
  for(const id of [...fields,...textChecks,...imageChecks,'generationFactCheck'])$(id).disabled=published||publishing||saving||generating;
  if(savedRecord?.status==='approved'&&!approvalCurrent())$('reviewStatus').textContent='De tekst of controles zijn gewijzigd. Keur deze versie opnieuw goed.';
  preview();
}
function saveDraft() {
  if ($('editor').hidden || published) return;
  const values=Object.fromEntries(fields.map(id=>[id,$(id).value]));
  try {
    sessionStorage.setItem(draftKey,JSON.stringify({values,id:selected?.id||null,savedRecord:savedRecord?{id:savedRecord.id,revision:savedRecord.revision,status:savedRecord.status}:null,savedAt:new Date().toISOString()}));
    $('draftSaveStatus').textContent='Bewerking tijdelijk bewaard in dit browsertabblad. Sleutel en goedkeuringsvinkjes worden niet bewaard.';
    $('restoreDraft').hidden=false;
  } catch { $('draftSaveStatus').textContent='Bewerking kon niet worden bewaard. Houd deze pagina open totdat je klaar bent.'; }
}
function openItem(item, restoring=false) {
  if (publishing || generating || saving) return false;
  if (!$('editor').hidden && !published && !confirm('Open een ander concept? De huidige bewerking wordt vervangen.')) return false;
  selected=item; published=false;savedRecord=null;lastSavedSnapshot='';
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
    savedRecord=d.savedRecord||null;lastSavedSnapshot='';resetChecks();published=false;updatePreflight();$('publishStatus').textContent='Bewerking hersteld. Voer de controles opnieuw uit vóór publicatie.';
  } catch { $('draftSaveStatus').textContent='Geen herstelbare bewerking gevonden.'; }
};
try { $('restoreDraft').hidden=!sessionStorage.getItem(draftKey); } catch {}
for(const id of fields) $(id).addEventListener('input',()=>{if(published)return;resetChecks();updatePreflight();saveDraft();});
[...textChecks,...imageChecks,...factCheckIds].forEach(id=>$(id).onchange=updatePreflight);
$('previewToggle').onclick=()=>{$('articlePreview').hidden=!$('articlePreview').hidden;preview();};
$('cancel').onclick=()=>{if(publishing||generating||saving)return;saveDraft();$('editor').hidden=true;selected=null;};
$('publish').onclick=async()=>{
  if(publishing||published||generating||saving)return;
  const p=payload(),issues=M.publicationIssues(p),key=$('secret').value.trim();
  if(!approvalCurrent()){$('publishStatus').textContent='Keur eerst de huidige versie inhoudelijk goed met Goedkeuren voor de app.';return;}
  if(!key){$('publishStatus').textContent='Vul eerst de redactiesleutel in.';return;}
  if(issues.length){$('publishStatus').textContent='Publicatie geblokkeerd. Rond de bovenstaande punten af.';updatePreflight();return;}
  if(!confirm('Publiceer dit gecontroleerde artikel in de VoetbalHub-app?'))return;
  publishing=true;updatePreflight();
  // Freeze the form while the exact reviewed payload is submitted.
  const controls=[...$('editor').querySelectorAll('input,textarea,select,button')];controls.forEach(e=>e.disabled=true);
  try {
    const d=await request('/publish',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+key},body:JSON.stringify({...p,editorialDraftId:savedRecord.id,expectedRevision:savedRecord.revision})});
    published=true;
    if(savedRecord){savedRecord={...savedRecord,status:'published'};ownRecords=ownRecords.map(r=>r.id===savedRecord.id?{...r,status:'published'}:r);renderOwnDrafts();}
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
  if(generating||publishing||published||saving)return;
  const key=$('secret').value.trim(),topic=$('headline').value.trim();
  const facts=checkedFacts();
  const sourceUrls=sourceLinks();
  if(!key||!topic||new Set(facts).size<2||sourceUrls.length<2||sourceUrls.some(u=>!M.host(u))||new Set(sourceUrls.map(M.host)).size<2||!$('generationFactCheck').checked){
    $('generationStatus').textContent='Vul je redactiesleutel, onderwerp, twee verschillende gecontroleerde feiten en twee HTTPS-bronlinks van verschillende websites in. Bevestig de feitencontrole.';return;
  }
  if(($('body').value.trim()||$('standfirst').value.trim())&&!confirm('Vervang de huidige kop, intro en tekst door een nieuw AI-concept op basis van deze feiten?'))return;
  saveDraft();generating=true;
  const controls=[...$('editor').querySelectorAll('input,textarea,select,button')];controls.forEach(e=>e.disabled=true);
  $('generationStatus').textContent='AI-concept wordt gemaakt. Je huidige bewerking blijft bewaard.';
  try{
    const d=await request('/draft',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+key},body:JSON.stringify({topic,category:$('category').value.trim()||'Voetbal',facts,sourceUrls,match:readMatch(),reviewNotes:$('reviewNotes').value.trim()})});
    if(!d.draft||M.draftIssues(d.draft).length)throw Error('Geen volledig en bruikbaar concept ontvangen. Je vorige tekst blijft staan.');
    $('headline').value=d.draft.headline;$('standfirst').value=d.draft.standfirst;$('body').value=d.draft.body.join('\n\n');
    resetChecks();
    savedRecord=d.savedDraft||null;lastSavedSnapshot=JSON.stringify(payload());
    if(savedRecord){upsertOwnRecord(savedRecord);$('reviewStatus').textContent='Volledig concept op de server opgeslagen. Lees en controleer deze tekst vóór goedkeuring.';}
    saveDraft();preview();$('articlePreview').hidden=false;
    $('generationStatus').textContent='Nieuw concept gereed en tijdelijk bewaard. '+(d.draft.qualityReview?.revisionApplied?'De tekst is na de eerste controle gericht hersteld. ':'')+'De tekstcontroles zijn geslaagd; controleer de uiteindelijke feiten en bronnen vóór publicatie.';
    $('publishStatus').textContent=d.storageWarning||'AI-concept ontvangen. Nog niet goedgekeurd en niet gepubliceerd.';
  }catch(e){$('generationStatus').textContent=e.message;}
  finally{generating=false;controls.forEach(e=>e.disabled=false);updatePreflight();}
};

function approvalCurrent(){return savedRecord?.status==='approved'&&lastSavedSnapshot===JSON.stringify(payload());}
function upsertOwnRecord(record){ownRecords=[record,...ownRecords.filter(r=>r.id!==record.id)];renderOwnDrafts();}
function renderOwnDrafts(){
 $('ownDraftStatus').textContent=ownRecords.length?`${ownRecords.length} eigen artikelen opgeslagen. Volledige tekst, feiten en bronnen blijven bij ieder concept bewaard.`:'Nog geen volledige eigen artikelen opgeslagen. Maak een eigen artikel of herstel een bestaande bewerking en kies Concept opslaan.';
 $('ownDraftQueue').innerHTML=ownRecords.map((r,i)=>{
  const p=r.payload||{},d=p.draft||{};
  const label=r.status==='published'?'Gepubliceerd':r.status==='approved'?(M.factAuditIssues(p).length?'Aanvullende feitencontrole nodig':'Goedgekeurd voor de app'):'Inhoudelijk beoordelen';
  return `<article class="card"><span class="badge">${esc(label)}</span><h3>${esc(d.headline)}</h3><p>${esc(d.standfirst)}</p><details><summary>Volledige tekst lezen</summary><div class="article-text">${(d.body||[]).map(t=>'<p>'+esc(t)+'</p>').join('')}</div></details>${r.status==='published'?'<p class="muted">Dit artikel is beschikbaar voor de app.</p>':`<button data-own-open="${i}">Lees en beoordeel</button>`}</article>`;
 }).join('');
 document.querySelectorAll('[data-own-open]').forEach(b=>b.onclick=()=>openOwnRecord(ownRecords[Number(b.dataset.ownOpen)]));
}
function openOwnRecord(record){
 const p=record.payload||{},d=p.draft||{};
 if(!openItem({...d,category:p.category},true))return;
 savedRecord=record;selected={id:record.id,own:true};
 $('fact1').value=p.verifiedFacts?.[0]||'';$('fact2').value=p.verifiedFacts?.[1]||'';$('extraFacts').value=(p.verifiedFacts||[]).slice(2).join('\n');
 $('source1').value=p.sources?.[0]?.url||'';$('source2').value=p.sources?.[1]?.url||'';
 $('extraSources').value=(p.sources||[]).slice(2).map(s=>s.url).join('\n');$('reviewNotes').value=p.reviewNotes||'';
 for(const id of ['homeTeam','awayTeam','homeScore','awayScore','playedAt'])$(id).value=p.match?.[id]??'';
 $('matchFields').open=M.needsMatch(d);
 for(const id of ['imageUrl','imageSource','imageCredit','imageRights'])if(typeof p[id]==='string')$(id).value=p[id];
 if(record.status==='approved'){
  const mapping={sourceCheck:'originalSourceReviewed',factCheck:'claimsIndependentlyChecked',duplicateCheck:'duplicateChecked',languageCheck:'languageChecked'};
  factCheckIds.forEach(id=>$(id).checked=p.factChecks?.[id]===true);
  Object.entries(mapping).forEach(([id,key])=>$(id).checked=p.editorialChecks?.[key]===true);
  $('kitCheck').checked=p.imageReview?.kitVerified===true;$('identityCheck').checked=p.imageReview?.playerIdentityVerified===true;$('aiDisclosure').checked=p.imageReview?.aiDisclosureVerified===true;
 }
 lastSavedSnapshot=JSON.stringify(payload());
 $('reviewStatus').textContent=record.status==='approved'?'Deze opgeslagen versie is inhoudelijk goedgekeurd. Je kunt haar publiceren.':'Lees de volledige tekst, open de bronnen en voer de controles uit. Kies daarna Goedkeuren voor de app.';
 updatePreflight();$('articlePreview').hidden=false;saveDraft();
}
async function persistReviewedDraft(approve){
 if(saving||publishing||generating||published)return;
 const key=$('secret').value.trim(),p=payload();
 if(!key){$('reviewStatus').textContent='Vul eerst de redactiesleutel in.';return;}
 const issues=approve?M.publicationIssues(p):[];
 if(issues.length){$('reviewStatus').textContent='Goedkeuren geblokkeerd: '+issues.join(' ');return;}
 if(approve&&!confirm('Heb je de volledige tekst en feiten gecontroleerd en keur je deze versie goed voor publicatie in de app?'))return;
 saving=true;const controls=[...$('editor').querySelectorAll('input,textarea,select,button')];controls.forEach(e=>e.disabled=true);
 try{
  const d=await request('/editorial-drafts',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+key},body:JSON.stringify({id:savedRecord?.id,expectedRevision:savedRecord?.revision,payload:p,approve})});
  savedRecord=d.record;lastSavedSnapshot=JSON.stringify(payload());upsertOwnRecord(savedRecord);saveDraft();
  $('reviewStatus').textContent=approve?'Deze versie is inhoudelijk goedgekeurd en op de server bewaard. Kies Publiceer in de app om haar live te zetten.':'Concept op de server opgeslagen. Je kunt dit artikel later opnieuw openen en beoordelen.';
 }catch(e){$('reviewStatus').textContent=e.message;}
 finally{saving=false;controls.forEach(e=>e.disabled=false);updatePreflight();}
}
$('saveServerDraft').onclick=()=>persistReviewedDraft(false);
$('approveServerDraft').onclick=()=>persistReviewedDraft(true);
