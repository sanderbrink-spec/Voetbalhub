const http = require("node:http");
const { createClient } = require("redis");
const { auditClaims, editorialQuality } = require("./editorial-quality");

const PORT = Number(process.env.PORT || 10000);
const API_SECRET = process.env.HUB_API_SECRET || "";
const GROQ_API_KEY = process.env.GROQ_API_KEY || "";
const MODEL = process.env.GROQ_MODEL || "llama-3.3-70b-versatile";
const client = process.env.REDIS_URL ? createClient({
  url: process.env.REDIS_URL,
  socket: { reconnectStrategy: false }
}) : null;
if (client) client.on("error", (err) => console.error("Redis connection error:", err.message));

function send(res, status, body) {
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "Access-Control-Allow-Origin": process.env.ALLOWED_ORIGINS || "null",
    "Vary": "Origin",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Authorization, Content-Type"
  });
  res.end(JSON.stringify(body));
}
function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = "";
    req.on("data", chunk => {
      data += chunk;
      if (data.length > 1_000_000) { reject(new Error("body_too_large")); req.destroy(); }
    });
    req.on("end", () => {
      try { resolve(JSON.parse(data || "{}")); } catch { reject(new Error("invalid_json")); }
    });
    req.on("error", reject);
  });
}
function authorized(req) {
  return !!API_SECRET && req.headers.authorization === "Bearer " + API_SECRET;
}
function cleanExtractedSourceText(value) {
  if (typeof value !== "string") return "";
  const text = value.replace(/\r/g, "").trim();
  // Stop at recognizable reader comments that a scraper may append after the article.
  const contaminationMarkers = [
    /\s+Een gezond mens heeft duizend wensen/i,
    /\s+Poh, wat is deze een partijtje lekker/i,
    /\s+Net zoals bij jou\b/i,
    /\s+Vooral niet speculeren\b/i,
    /\s+Jij mag op zn plekje zitten/i,
    /\s+Zijn jullie bij VP nou helemaal gek geworden/i
  ];
  let cut = text.length;
  for (const pattern of contaminationMarkers) {
    const match = pattern.exec(text);
    if (match && match.index < cut) cut = match.index;
  }
  return text.slice(0, cut).trim();
}
function hasLongVerbatimOverlap(source, draft) {
  const normalize = value => String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .toLowerCase().replace(/[^a-z0-9]+/g, " ").trim().split(/\s+/).filter(Boolean);
  const sourceWords = normalize(source);
  const draftWords = normalize(draft);
  if (sourceWords.length < 8 || draftWords.length < 8) return false;
  const sourcePhrases = new Set();
  for (let i = 0; i <= sourceWords.length - 8; i++) sourcePhrases.add(sourceWords.slice(i, i + 8).join(" "));
  let overlaps = 0;
  for (let i = 0; i <= draftWords.length - 8; i++) {
    if (sourcePhrases.has(draftWords.slice(i, i + 8).join(" "))) overlaps++;
    if (overlaps >= 2) return true;
  }
  return false;
}
function normalizeHeadline(value) {
  return String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}
async function polishIncomingDraft(item) {
  if (!GROQ_API_KEY || !item || typeof item !== "object") return { ...item, languagePolish: "not_run" };
  const src = item.source || {};
  const ev = item.sourceEvidence || {};
  // RSS-only input is not enough evidence to safely rewrite an article. Keep the
  // incoming draft unchanged and force editorial review instead of asking AI to expand it.
  const hasArticleText = [ev.content, ev.excerpt].some(v => typeof v === "string" && v.trim().length >= 250);
  if (ev.evidenceLevel === "rss_title_and_description_only" || !hasArticleText) {
    return {
      ...item,
      languagePolish: "skipped_rss_only_source",
      languagePolishNote: "AI-uitbreiding overgeslagen: geen volledige artikeltekst beschikbaar. Controleer de oorspronkelijke bron en herschrijf pas daarna."
    };
  }
  const sourceText = [src.title, src.description, ev.title, ev.description, cleanExtractedSourceText(ev.excerpt), cleanExtractedSourceText(ev.content), item.feedTitle, item.feedDescription].filter(v => typeof v === "string").join("\n").slice(0, 7000);
  if (!sourceText.trim()) return { ...item, languagePolish: "skipped_no_source_text" };
  try {
    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: { "Authorization": "Bearer " + GROQ_API_KEY, "Content-Type": "application/json" },
      signal: AbortSignal.timeout(20000),
      body: JSON.stringify({
        model: MODEL,
        messages: [
          { role: "system", content: "Je bent de onafhankelijke eindredacteur en verslaggever van VoetbalHub. Schrijf een zelfstandig journalistiek stuk van VoetbalHub op basis van controleerbare feiten, niet een navertelling of zin-voor-zin-parafrase van het aangeleverde artikel. Gebruik een aangeleverd nieuwsartikel nooit als grondtekst om na te vertellen. Behandel journalistieke tekst van andere media alleen als aanleiding om feiten te controleren; neem geen invalshoek, selectie, opbouw, analyse of formulering daarvan over. Geef voorrang aan primaire en feitelijke bronnen zoals officiële club- en competitie-informatie en controleerbare wedstrijddata. Voor wedstrijdverslagen: baseer het verhaal waar mogelijk op de wedstrijd zelf en afzonderlijk gecontroleerde gegevens zoals uitslag, doelpunten, tijdlijn en statistieken; schrijf een eigen analyse van het wedstrijdbeeld, maar leid conclusies zoals “had het meeste initiatief” of “keeper hield de ploeg op de been” alleen af uit beschikbare feiten en vermeldingen/waarnemingen die daarvoor voldoende basis geven. Als alleen een artikel of RSS-bericht beschikbaar is en er onvoldoende onafhankelijke feiten zijn om een zelfstandig stuk te maken, kies skip in plaats van een parafrase. Bepaal zelf de invalshoek, volgorde en opbouw; schrijf alle zinnen opnieuw vanuit nul in natuurlijk Nederlands. Neem geen zinnen, opvallende formuleringen, creatieve metaforen, tussenkoppen of citaten uit de bron over. Gebruik alleen korte letterlijke citaten wanneer die journalistiek noodzakelijk zijn en zet ze tussen aanhalingstekens met duidelijke bronvermelding; standaard: geen citaten. Verander niet alleen synoniemen: de formulering en structuur moeten zelfstandig zijn. Als het nieuws niet genoeg feiten biedt voor een zelfstandig artikel, kies skip. Gebruik eigen journalistieke structuur en eigen formuleringen, vermeld de bron transparant en behoud de bronlink. Neem alleen feiten op die aantoonbaar in de meegeleverde broninformatie staan; verzin niets en kopieer geen lange passages of quotes. Verander onzekerheid niet in zekerheid. Geen niet-onderbouwde claims over uitslagen, blessures, transfers, ranglijsten, wedstrijdverloop of uitspraken. PRIORITERING: laat een bericht weg als het vooral een losse, kleine update over één speler is (rating, compliment, droom, gerucht of individuele prestatie) en er geen aanwijzing is dat het breed en onafhankelijk door meerdere betrouwbare media als groot nieuws wordt behandeld. Zo’n item krijgt editorialDecision is skip en een korte skipReason; verzin geen breedte van media-aandacht. Geef voorrang aan groot clubnieuws, belangrijke wedstrijden/toernooien, officiële beslissingen, transfers met sterke bevestiging, blessures met grote impact en ontwikkelingen die meerdere clubs of competities raken. Als de broninformatie te mager is om een degelijk origineel stuk te maken, kies skip in plaats van opvullen. Schrijf natuurlijk Nederlands, één onderwerp per stuk, zonder onnodige dramatisering. Retourneer uitsluitend geldige JSON met editorialDecision (keep of skip), skipReason, headline, standfirst en body (array met maximaal 2 korte alinea’s). Dit is geen onafhankelijke factcheck; menselijke broncontrole blijft verplicht. Originaliteitsregel: als twee reeksen van acht opeenvolgende woorden letterlijk overeenkomen met de bron, mag het stuk niet worden opgeslagen als uitgewerkte bijdrage." },
          { role: "user", content: JSON.stringify({ sourceTitle: src.title || item.sourceTitle || "", sourceText, headline: item.headline || "", standfirst: item.standfirst || "", body: Array.isArray(item.body) ? item.body : [] }) }
        ],
        response_format: { type: "json_object" },
        temperature: 0.1
      })
    });
    const data = await response.json();
    if (!response.ok) return { ...item, languagePolish: "failed" };
    const edited = JSON.parse(data.choices?.[0]?.message?.content || "{}");
    if (typeof edited.headline !== "string" || typeof edited.standfirst !== "string" || !Array.isArray(edited.body) || !edited.body.every(p => typeof p === "string")) return { ...item, languagePolish: "failed_invalid_response" };
    const finalDraftText = [edited.headline, edited.standfirst, ...edited.body].join("\\n");
    if (hasLongVerbatimOverlap(sourceText, finalDraftText)) return {
      ...item,
      headline: "",
      editorialStatus: "rejected_verbatim_overlap",
      editorialSkipReason: "De automatische originaliteitscontrole vond meerdere lange, letterlijke woordreeksen die overeenkomen met de bron. Niet tonen als uitgewerkt artikel; herschrijf zelfstandig en controleer handmatig.",
      languagePolish: "skipped_verbatim_overlap",
      languagePolishNote: "Niet getoond: te veel letterlijke overlap met bronmateriaal. Er is geen artikel automatisch gepubliceerd."
    };
    if (edited.editorialDecision === "skip") return {
      ...item,
      headline: "",
      editorialStatus: "rejected_low_priority",
      editorialSkipReason: String(edited.skipReason || "Te beperkte nieuwswaarde voor de VoetbalHub-selectie.").slice(0, 500),
      languagePolish: "skipped_low_priority",
      languagePolishNote: "Niet getoond: lage nieuwswaarde of te weinig onafhankelijke onderbouwing. Het oorspronkelijke bronrecord blijft bewaard."
    };
    return {
      ...item,
      headline: edited.headline.slice(0, 240),
      standfirst: edited.standfirst.slice(0, 700),
      body: edited.body.slice(0, 2).map(p => p.slice(0, 900)),
      languagePolish: "ai_edited_source_limited",
      languagePolishNote: "AI-taalredactie uitgevoerd op basis van opgeslagen broninformatie; geen onafhankelijke factcheck."
    };
  } catch {
    return { ...item, languagePolish: "failed" };
  }
}
async function getArticles() {
  if (!client?.isReady) throw new Error("REDIS_UNAVAILABLE");
  const keys = await client.keys("article:*");
  const articles = [];
  for (const key of keys.slice(0, 200)) {
    const raw = await client.get(key);
    if (!raw) continue;
    try { const article = JSON.parse(raw); if (article.status === "published") articles.push(article); } catch {}
  }
  articles.sort((a,b) => String(b.publishedAt || "").localeCompare(String(a.publishedAt || "")));
  return articles;
}
async function handle(req, res) {
  const url = new URL(req.url, "http://localhost");
  if (req.method === "OPTIONS") { res.writeHead(204); return res.end(); }
  if (req.method === "GET" && url.pathname === "/legacy-desk") {
    res.writeHead(200, {"Content-Type":"text/html; charset=utf-8","Cache-Control":"no-store"});
    return res.end(`<!doctype html><html lang="nl"><meta name="viewport" content="width=device-width,initial-scale=1"><title>VoetbalHub | Redactiedesk</title><style>
:root{color-scheme:dark}*{box-sizing:border-box}body{margin:0;background:#0b0d10;color:#f3f5f7;font:16px system-ui,-apple-system,sans-serif}.wrap{max-width:900px;margin:auto;padding:20px}header{border-bottom:1px solid #292e35;padding:20px 0;margin-bottom:20px}h1{margin:0;color:#a6ff00;font-size:27px}p{color:#b7bec7}.pill{display:inline-block;border:1px solid #3b424c;border-radius:99px;padding:5px 10px;font-size:12px;color:#c9d0d8}.card{background:#15191f;border:1px solid #303741;border-radius:14px;padding:16px;margin:14px 0;overflow-wrap:anywhere}h2{font-size:21px;margin:10px 0}h3{font-size:16px;margin-bottom:6px;color:#cbd3dd}a{color:#b5ff37}input,button{width:100%;padding:13px;border-radius:9px;margin:6px 0;border:1px solid #444d58;background:#20252c;color:white;font:inherit}button{background:#a6ff00;color:#101010;font-weight:750;border:0}button.secondary{background:#29313a;color:#fff;border:1px solid #46515e}.muted{color:#aab2bd;font-size:13px}.body p{line-height:1.55;color:#e1e5ea}.row{display:flex;gap:8px;flex-wrap:wrap}.row button{flex:1;min-width:130px}.error{color:#ff8b8b}.ok{color:#b5ff37}details{margin-top:12px}summary{cursor:pointer;color:#cbd3dd}</style><div class="wrap"><header><h1>VoetbalHub Redactiedesk</h1><p>Automatische concepten • broncontrole • publicatie blijft handmatig</p><span class="pill">PUBLICATIE AUTOMATISCH UITGESCHAKELD</span></header><section class="card"><label for="secret">HUB_API_SECRET</label><input id="secret" type="password" autocomplete="off" placeholder="Vul je redactiesleutel in"><button id="load">Laad concepten</button><div id="status" class="muted">Je sleutel wordt alleen gebruikt voor deze aanvraag en niet opgeslagen.</div></section><section id="items"></section></div><script>
const $=id=>document.getElementById(id);function legacyWarning(x){return ""}function esc(s){return String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]))}
$("load").onclick=async()=>{const secret=$("secret").value.trim();if(!secret){$("status").textContent="Vul eerst HUB_API_SECRET in.";return}$("load").disabled=true;$("status").textContent="Concepten ophalen…";try{const r=await fetch("/inbox",{headers:{Authorization:"Bearer "+secret}});const d=await r.json();if(!r.ok)throw Error(d.error||"Ophalen mislukt");const list=(d.items||[]).filter(x=>x&&typeof x==="object"&&x.headline);$("status").innerHTML='<span class="ok">'+list.length+' concept(en) gevonden.</span>';if(!list.length){$("items").innerHTML='<div class="card">Nog geen automatische concepten gevonden. Start de workflow handmatig en probeer opnieuw.</div>';return}$("items").innerHTML=list.map(x=>'<article class="card"><span class="pill">'+esc(x.status||"draft_for_review")+'</span> <span class="pill">'+esc(x.category||"Voetbal")+'</span>'+(legacyWarning(x)?'<p class="error"><strong>'+esc(legacyWarning(x))+'</strong></p>':'')+'<h2>'+esc(x.headline)+'</h2><p>'+esc(x.standfirst||"")+'</p><div class="body">'+(Array.isArray(x.body)?x.body:[]).map(p=>'<p>'+esc(p)+'</p>').join("")+'</div><h3>Bron</h3>'+(x.source&&x.source.url?'<p><a href="'+esc(x.source.url)+'" target="_blank" rel="noopener">'+esc(x.source.title||x.source.url)+'</a></p>':'<p class="muted">Geen bronlink opgeslagen</p>')+(x.languagePolish==="ai_edited_source_limited"?'<p class="ok"><strong>Taalredactie:</strong> '+esc(x.languagePolishNote||"AI-taalredactie uitgevoerd; menselijke broncontrole blijft verplicht.")+'</p>':x.languagePolish&&x.languagePolish!=="not_run"&&x.languagePolish!=="skipped_no_source_text"?'<p class="error"><strong>Taalredactie niet uitgevoerd.</strong> Controleer de tekst handmatig.</p>':'')+(x.qualityReview&&Array.isArray(x.qualityReview.warnings)?'<p class="error"><strong>Kwaliteitssignalen</strong></p><ul>'+x.qualityReview.warnings.map(w=>'<li>'+esc(w)+'</li>').join("")+'</ul>':'')+'<details open><summary>Redactionele kwaliteitscontrole</summary><p><strong>Status:</strong> '+esc(x.verification_status||"needs_review")+'</p><p>'+esc(/RSS-CONTROLE, GEEN ONAFHANKELIJKE FACTCHECK/i.test(String(x.verification_notes||""))?"Alleen RSS-gegevens gebruikt. Dit is geen onafhankelijke factcheck; controleer concrete claims rechtstreeks bij de oorspronkelijke bron.":x.verification_notes||"NIET GECONTROLEERD: controleer alle feiten onafhankelijk vóór publicatie.")+'</p>'+(x.sourceEvidence?'<p><strong>Bronbewijs:</strong> '+esc(x.sourceEvidence.evidenceLevel||"onbekend")+'</p>'+(x.sourceEvidence.evidenceLevel==="rss_title_and_description_only"?'<p class="muted">RSS-beschrijving verborgen: deze tekst is alleen bronmateriaal en wordt niet als artikeltekst getoond.</p>':'<p>'+esc(x.sourceEvidence.description||"Geen beschrijving in de RSS-feed; alleen de kop is beschikbaar.")+'</p>'):'<p>Geen apart bronbewijs opgeslagen. Controleer de bron handmatig.</p>')+(Array.isArray(x.claims)&&x.claims.length?'<h3>Controleerbare claims</h3><ul>'+x.claims.map(cl=>'<li><strong>'+esc(cl.status||"unverified")+'</strong> — '+esc(cl.claim||"Claim ontbreekt")+'<br><span class="muted">Bewijs: '+esc(cl.evidence||"Niet aangetoond in aangeleverde RSS-gegevens")+'</span></li>').join("")+'</ul>':'<p class="muted">Geen claim-voor-claim-overzicht beschikbaar. Controleer alle feitelijke beweringen handmatig.</p>')+'<p class="muted">Dit is een bronvergelijking, geen onafhankelijke feitelijke verificatie. Publicatie blijft handmatig.</p></details><p class="muted">Aangemaakt: '+esc(x.createdAt||"tijd onbekend")+'</p></article>').join("")}catch(e){$("status").innerHTML='<span class="error">'+esc(e.message)+'</span>'}finally{$("load").disabled=false}};
</script></html>`);
  }
  if (req.method === "GET" && (url.pathname === "/publish-desk" || url.pathname === "/desk" || url.pathname === "/")) {
    res.writeHead(200, {"Content-Type":"text/html; charset=utf-8","Cache-Control":"no-store"});
    return res.end(`<!doctype html><html lang="nl"><meta name="viewport" content="width=device-width,initial-scale=1"><title>VoetbalHub | Publicatiedesk</title><style>
:root{color-scheme:dark}body{margin:0;background:#0b0d10;color:#f3f5f7;font:16px system-ui;max-width:900px;padding:18px;margin:auto}h1{color:#a6ff00}input,textarea,button{box-sizing:border-box;width:100%;padding:12px;margin:6px 0;border:1px solid #46515e;border-radius:8px;background:#20252c;color:white;font:inherit}textarea{min-height:90px}button{background:#a6ff00;color:#111;font-weight:bold;border:0}.secondary{background:#29313a;color:#fff;border:1px solid #46515e}.card{background:#15191f;border:1px solid #303741;border-radius:12px;padding:14px;margin:12px 0}.muted{color:#b7bec7;font-size:13px}.error{color:#ff9b9b}details{margin:12px 0;padding:10px;background:#101318;border-radius:8px}summary{cursor:pointer;color:#a6ff00;font-weight:700;padding:4px 0}.article-text{white-space:pre-wrap;overflow-wrap:anywhere;line-height:1.65;color:#e4e8ed}.article-text p{margin:10px 0}.checks label{display:block;margin:10px 0}.checks input{width:auto}.filter-row{display:flex;gap:8px;flex-wrap:wrap}.filter-row button{width:auto;flex:1;min-width:120px;margin:3px 0}.filter-row button.active{outline:2px solid #a6ff00}.draft-title{font-size:18px;display:block;margin-bottom:6px}a{color:#b5ff37}</style><h1>VoetbalHub · Publicatiedesk</h1><p>Concepten blijven privé totdat jij alle controles afrondt en expliciet publiceert.</p><div class="card"><label>HUB_API_SECRET</label><input id="secret" type="password" autocomplete="off" placeholder="Redactiesleutel"><button id="load">Laad concepten</button><div id="status" class="muted">Pagina geladen; JavaScript wordt gestart…</div></div><div class="card" id="settings"><details open><summary>Nieuwsselectie & instellingen</summary><div class="muted">Deze instellingen gelden alleen voor de weergave op dit apparaat. De redactiesleutel wordt niet opgeslagen. Automatisch publiceren blijft uitgeschakeld.</div><label for="ageWindow">Nieuwsvenster</label><select id="ageWindow" style="width:100%;padding:12px;margin:6px 0;background:#20252c;color:white;border:1px solid #46515e;border-radius:8px"><option value="24">Laatste 24 uur</option><option value="36" selected>Laatste 36 uur</option><option value="48">Laatste 48 uur</option><option value="72">Laatste 3 dagen</option><option value="168">Laatste 7 dagen</option></select><div class="checks"><label><input type="checkbox" id="includeUndated" checked> Toon berichten zonder brondatum</label><label><input type="checkbox" id="includeRss" checked> Toon ook RSS-only concepten</label><label><input type="checkbox" id="includeEnglish" checked> Toon ook Engelstalige koppen</label></div><button type="button" class="secondary" id="saveSettings">Instellingen opslaan</button><span class="muted" id="settingsStatus">Standaardinstellingen actief.</span></details></div><div id="queueTools" class="card" hidden><input id="searchDrafts" type="search" placeholder="Zoek op kop, club of bron…"><div class="muted" id="queueCount"></div><div class="filter-row"><button type="button" class="secondary" data-filter="all">Alles</button><button type="button" class="secondary" data-filter="warnings">Controle nodig</button><button type="button" class="secondary" data-filter="fulltext">Volledige brontekst</button><button type="button" class="secondary" data-filter="rss">Alleen RSS</button></div><div class="filter-row"><button type="button" class="secondary" id="exportDrafts">Exporteer concepten (JSON)</button><button type="button" class="secondary" id="copyHeadlines">Koppen kopiëren</button></div><div class="muted">Export en kopiëren gebruiken de geladen lijst; er wordt niets gepubliceerd.</div></div><div id="queue"></div><div class="card" id="editor" hidden><h2>Artikel beoordelen en publiceren</h2><input id="category" placeholder="Categorie"><input id="headline" placeholder="Nederlandse kop"><textarea id="standfirst" placeholder="Intro"></textarea><textarea id="body" placeholder="Artikeltekst (alinea's gescheiden door een lege regel)"></textarea><label>Gecontroleerd feit 1 (zelf controleren in de bron)</label><textarea id="fact1"></textarea><label>Gecontroleerd feit 2 (zelf controleren in de bron)</label><textarea id="fact2"></textarea><label>Bron-URL 1</label><input id="source1" type="url" placeholder="https://..."><label>Bron-URL 2 (verplicht: ander domein)</label><input id="source2" type="url" placeholder="https://andere-bron.nl/artikel"><div class="checks"><label><input type="checkbox" id="sourceCheck"> Ik heb de oorspronkelijke bron geopend en gelezen.</label><label><input type="checkbox" id="factCheck"> Ik heb beide feiten onafhankelijk gecontroleerd.</label><label><input type="checkbox" id="duplicateCheck"> Ik heb gecontroleerd dat dit geen dubbel bericht is.</label><label><input type="checkbox" id="languageCheck"> Ik heb de Nederlandse tekst gecontroleerd.</label></div><button id="publish">GOEDKEUREN EN PUBLICEREN</button><button class="secondary" id="cancel">Annuleren</button><div id="publishStatus" class="muted"></div></div><script>
const $=id=>document.getElementById(id);let selected=null;function readSettings(){let saved={};try{saved=JSON.parse(localStorage.getItem("voetbalhubDeskSettings")||"{}")}catch{}return {ageWindow:[24,36,48,72,168].includes(Number(saved.ageWindow))?Number(saved.ageWindow):36,includeUndated:saved.includeUndated!==false,includeRss:saved.includeRss!==false,includeEnglish:saved.includeEnglish!==false}}function loadSettings(){const p=readSettings();$("ageWindow").value=String(p.ageWindow);$("includeUndated").checked=p.includeUndated;$("includeRss").checked=p.includeRss;$("includeEnglish").checked=p.includeEnglish}function saveSettings(){const p={ageWindow:Number($("ageWindow").value),includeUndated:$("includeUndated").checked,includeRss:$("includeRss").checked,includeEnglish:$("includeEnglish").checked};localStorage.setItem("voetbalhubDeskSettings",JSON.stringify(p));$("settingsStatus").textContent="Instellingen opgeslagen op dit apparaat.";if($("secret").value.trim())$("load").click()}try{loadSettings()}catch{}$("saveSettings").onclick=saveSettings;function esc(v){return String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]))}
window.addEventListener("error",e=>{const s=$("status");if(s)s.textContent="Paginafout: "+(e.message||"JavaScript-fout")});window.addEventListener("unhandledrejection",e=>{$("status").textContent="Asynchrone fout: "+String(e.reason||"onbekend")});$("status").textContent="JS-DIAG-2 actief. Klaar om te laden."; $("load").addEventListener("click",()=>{$("status").textContent="Klik ontvangen door JavaScript; aanvraag wordt gestart…"} ,{capture:true});
$("load").onclick=async()=>{const key=$("secret").value.trim();if(!key){$("status").textContent="Vul eerst de redactiesleutel in.";return}$("load").disabled=true;$("status").textContent="Concepten ophalen…";try{const r=await fetch("/inbox",{headers:{Authorization:"Bearer "+key},signal:AbortSignal.timeout(15000)});let d;try{d=await r.json()}catch{throw Error("De server gaf geen geldig antwoord. Probeer opnieuw; als dit blijft gebeuren controleer ik de API.")}if(!r.ok)throw Error(d.error||("Concepten ophalen mislukt (HTTP "+r.status+")."));const allItems=d.items||[];const prefs=readSettings();const cutoff=Date.now()-Number(prefs.ageWindow||36)*60*60*1000;const items=allItems.filter(x=>{const raw=x.source?.publishedAt||x.sourceEvidence?.publishedAt||x.publishedAt;const t=Date.parse(raw||"");const undated=!Number.isFinite(t);const recent=!undated&&t<=Date.now()&&t>=cutoff;const rss=String(x.sourceEvidence?.evidenceLevel||"")==="rss_title_and_description_only"||String(x.sourceEvidence?.content||x.sourceEvidence?.excerpt||"").trim().length<250;const title=String(x.headline||"");const boundary=String.fromCharCode(92)+"b";const english=new RegExp(boundary+"(the|and|with|after|before|could|would|hospital|manager|club says|reports)"+boundary,"i").test(title)&&!new RegExp(boundary+"(de|het|een|van|voor|bij|met|na|trainer|voetbal|wint|zegt)"+boundary,"i").test(title);return (undated?prefs.includeUndated:recent)&&(prefs.includeRss||!rss)&&(prefs.includeEnglish||!english);});$("status").textContent=items.length+" concept(en) getoond uit "+allItems.length+" opgeslagen. Venster: "+prefs.ageWindow+" uur. Geen enkel concept wordt automatisch gepubliceerd."; $("queue").innerHTML=items.length?items.map((x,i)=>{const warnings=Array.isArray(x.qualityReview?.warnings)?x.qualityReview.warnings:[];const claimCount=Number(x.qualityReview?.claimsUnverified||0);const reviewMarkup='<div style="border:1px solid '+(warnings.length||claimCount?'#8b6425':'#37633b')+';border-radius:8px;padding:10px;margin:12px 0;background:'+(warnings.length||claimCount?'#241d12':'#122016')+'"><strong style="color:'+(warnings.length||claimCount?'#ffd27a':'#a6ff00')+'">'+(warnings.length||claimCount?'Controle nodig: '+warnings.length+' waarschuwing(en)':'Geen automatische waarschuwingen')+'</strong><p class="muted">Dit zijn controlesignalen, geen onafhankelijke factcheck. Jij blijft verantwoordelijk voor de broncontrole.</p>'+(warnings.length?'<ul>'+warnings.map(w=>'<li>'+esc(w)+'</li>').join("")+'</ul>':'')+(claimCount?'<p class="error">'+claimCount+' feitelijke claim(s) zijn niet voldoende letterlijk onderbouwd door de opgeslagen brongegevens.</p>':'')+'</div>';const evidence=String(x.sourceEvidence?.evidenceLevel||"unknown");const hasText=String(x.sourceEvidence?.content||x.sourceEvidence?.excerpt||"").trim().length>=250;return '<div class="card draft-card" data-head="'+esc((x.headline||"")+" "+(x.source?.title||"")+" "+(x.category||""))+'" data-evidence="'+(evidence==="rss_title_and_description_only"||!hasText?"rss":"fulltext")+'" data-warnings="'+(warnings.length||claimCount?"yes":"no")+'"><strong class="draft-title">'+esc(x.headline)+'</strong><p class="muted">'+esc(x.source?.title||"Bron onbekend")+'</p><p class="muted">Brondatum: '+esc(x.source?.publishedAt||x.sourceEvidence?.publishedAt||"Onbekend")+'</p>'+(x.source?.url&&x.source.url.startsWith("https://")?'<p><a href="'+esc(x.source.url)+'" target="_blank" rel="noopener noreferrer">Open oorspronkelijke bron ↗</a></p>':'<p class="muted">Geen veilige HTTPS-bronlink beschikbaar.</p>')+reviewMarkup+'<p><strong>Intro</strong><br>'+esc(x.standfirst||"")+'</p><details><summary>Volledig VoetbalHub-verslag lezen</summary><div class="article-text">'+(Array.isArray(x.body)?x.body:[]).map(p=>'<p>'+esc(p)+'</p>').join("")+'</div></details><details><summary>Volledige opgeslagen brontekst bekijken</summary><p class="muted">Dit is de tekst die bij het concept is opgeslagen. Vergelijk deze met de oorspronkelijke bron; tekstextractie garandeert niet dat alle feiten juist zijn.</p><div class="article-text">'+esc(x.sourceEvidence?.content||x.sourceEvidence?.excerpt||"Geen volledige brontekst opgeslagen bij dit concept.")+'</div></details><button class="secondary" data-index="'+i+'">Verslag bewerken / beoordelen</button></div>'}).join(""):'<div class="card">Geen recente concepten gevonden. Oudere concepten zijn niet verwijderd. Controleer of de nieuwsworkflow nieuwe concepten aanlevert.</div>';$("queue")._items=items;$("queueTools").hidden=!items.length;let activeFilter="all";const applyQueueFilter=()=>{const q=$("searchDrafts").value.trim().toLocaleLowerCase("nl");let visible=0;document.querySelectorAll(".draft-card").forEach(card=>{const matchesText=card.dataset.head.toLocaleLowerCase("nl").includes(q);const matchesFilter=activeFilter==="all"||(activeFilter==="warnings"&&card.dataset.warnings==="yes")||(activeFilter==="fulltext"&&card.dataset.evidence==="fulltext")||(activeFilter==="rss"&&card.dataset.evidence==="rss");card.hidden=!(matchesText&&matchesFilter);if(!card.hidden)visible++});$("queueCount").textContent=visible+" van "+items.length+" concepten zichtbaar · RSS-only blijft bewaard en kan niet automatisch worden gepubliceerd.";document.querySelectorAll("[data-filter]").forEach(b=>b.classList.toggle("active",b.dataset.filter===activeFilter))};$("searchDrafts").oninput=applyQueueFilter;document.querySelectorAll("[data-filter]").forEach(b=>b.onclick=()=>{activeFilter=b.dataset.filter;applyQueueFilter()});applyQueueFilter();document.querySelectorAll("[data-index]").forEach(b=>b.onclick=()=>openItem(items[Number(b.dataset.index)]));}catch(e){$("status").innerHTML='<span class="error">'+esc(e.message)+'</span>'}finally{$("load").disabled=false}};
$("exportDrafts").onclick=()=>{const items=$("queue")._items||[];if(!items.length){$("queueCount").textContent="Laad eerst concepten om te exporteren.";return}const blob=new Blob([JSON.stringify(items,null,2)],{type:"application/json;charset=utf-8"});const a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download="voetbalhub-concepten-"+new Date().toISOString().slice(0,10)+".json";document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(a.href),1000);$("queueCount").textContent=items.length+" concepten geëxporteerd als JSON."};$("copyHeadlines").onclick=async()=>{const items=$("queue")._items||[];const headlines=items.map(x=>String(x.headline||"").trim()).filter(Boolean).join(String.fromCharCode(10));if(!headlines){$("queueCount").textContent="Geen koppen om te kopiëren.";return}try{await navigator.clipboard.writeText(headlines);$("queueCount").textContent=items.length+" koppen gekopieerd."}catch{$("queueCount").textContent="Kopiëren niet toegestaan door de browser. Gebruik Exporteren als JSON."}};function openItem(x){selected=x;$("editor").hidden=false;$("category").value=x.category||"Voetbal";$("headline").value=x.headline||"";$("standfirst").value=x.standfirst||"";$("body").value=Array.isArray(x.body)?x.body.join(String.fromCharCode(10)+String.fromCharCode(10)):"";$("fact1").value="";$("fact2").value="";$("source1").value=x.source?.url||x.sourceUrl||"";$("source2").value="";["sourceCheck","factCheck","duplicateCheck","languageCheck"].forEach(id=>$(id).checked=false);$("publishStatus").textContent="Controleer de bron en schrijf de twee gecontroleerde feiten zelf in. RSS-tekst is geen onafhankelijke factcheck.";window.scrollTo(0,$("editor").offsetTop)}
$("cancel").onclick=()=>{$("editor").hidden=true;selected=null};
$("publish").onclick=async()=>{const key=$("secret").value.trim();const facts=[$("fact1").value.trim(),$("fact2").value.trim()].filter(Boolean);const sources=[$("source1").value.trim(),$("source2").value.trim()].filter(Boolean).map(url=>({url}));const missing=[];if(!$("sourceCheck").checked)missing.push("oorspronkelijke bron");if(!$("factCheck").checked)missing.push("onafhankelijke feitencontrole");if(!$("duplicateCheck").checked)missing.push("dubbelcheck");if(!$("languageCheck").checked)missing.push("taalcontrole");if(missing.length){$("publishStatus").textContent="Publicatie geblokkeerd: "+missing.join(", ")+" afronden.";return}if(facts.length<2||sources.length<2||!sources.every(s=>s.url.startsWith("https://"))){$("publishStatus").textContent="Publiceren vereist twee gecontroleerde feiten en twee HTTPS-bronnen van verschillende websites.";return}const sourceHosts=sources.map(s=>{try{return new URL(s.url).hostname.toLowerCase().replace(/^(www|feeds|m|mobile|amp)\./,"")}catch{return ""}}).filter(Boolean);if(new Set(sourceHosts).size<2){$("publishStatus").textContent="Gebruik twee verschillende bronwebsites; twee links van dezelfde website tellen niet als onafhankelijke bronnen.";return}const headline=$("headline").value.trim(),standfirst=$("standfirst").value.trim(),body=$("body").value.split(String.fromCharCode(10)+String.fromCharCode(10)).map(s=>s.trim()).filter(Boolean);if(!headline||!standfirst||!body.length){$("publishStatus").textContent="Kop, intro en minimaal één alinea zijn verplicht.";return}if(!confirm("Publiceer dit gecontroleerde artikel in de VoetbalHub-app?"))return;$("publish").disabled=true;try{const r=await fetch("/publish",{method:"POST",headers:{"Content-Type":"application/json","Authorization":"Bearer "+key},body:JSON.stringify({approved:true,draft:{headline,standfirst,body,why_it_matters:""},category:$("category").value.trim()||"Voetbal",verifiedFacts:facts,sources,editorialChecks:{originalSourceReviewed:$("sourceCheck").checked,claimsIndependentlyChecked:$("factCheck").checked,duplicateChecked:$("duplicateCheck").checked,languageChecked:$("languageCheck").checked}})});const d=await r.json();if(!r.ok)throw Error(d.error||"Publiceren mislukt");$("publishStatus").textContent="Gepubliceerd. Artikel-ID: "+d.article.id;$("status").textContent="Publicatie geslaagd. De app kan het artikel nu ophalen."}catch(e){$("publishStatus").textContent="Fout: "+e.message}finally{$("publish").disabled=false}};
</script></html>`);
  }
  if (req.method === "GET" && url.pathname === "/editor") {
    res.writeHead(200, {"Content-Type":"text/html; charset=utf-8","Cache-Control":"no-store"});
    return res.end(`<!doctype html><html lang="nl"><meta name="viewport" content="width=device-width,initial-scale=1"><title>VoetbalHub Redactie</title><style>body{font:16px system-ui;background:#101010;color:#f5f5f5;max-width:760px;margin:24px auto;padding:16px}h1{color:#9cff00}input,textarea,button{box-sizing:border-box;width:100%;margin:7px 0;padding:12px;border-radius:8px;border:1px solid #555;background:#202020;color:#fff}button{background:#a6ff00;color:#111;font-weight:bold}pre{white-space:pre-wrap;overflow-wrap:anywhere;background:#202020;padding:12px;border-radius:8px}small{color:#bbb}</style><h1>VoetbalHub Redactie</h1><p>Maak één concept. Publiceren gebeurt pas na jouw expliciete goedkeuring.</p><label>Geheime HUB_API_SECRET (blijft alleen in deze pagina)</label><input id="secret" type="password" autocomplete="off"><label>Onderwerp</label><input id="topic" value="FC Groningen: vooruitblik op NEC-uit"><label>Categorie</label><input id="category" value="FC Groningen"><label>Gecontroleerd feit 1</label><textarea id="f1">Volgens het KNVB-programma speelt FC Groningen op zondag 25 oktober 2026 om 14.30 uur uit tegen NEC.</textarea><label>Bron-URL 1</label><input id="u1" value="https://www.knvb.nl/competities/eredivisie/programma"><label>Gecontroleerd feit 2</label><textarea id="f2">De Eredivisie-uitslagenpagina vermeldt dat FC Groningen op 18 oktober met 2-5 verloor van Ajax.</textarea><label>Bron-URL 2 (verplicht: andere onafhankelijke bron)</label><input id="u2" value="https://www.knvb.nl/competities/eredivisie/uitslagen"><fieldset style="border:1px solid #555;border-radius:8px;padding:12px;margin:12px 0"><legend>Verplichte controle vóór publicatie</legend><label><input type="checkbox" id="checkSource" style="width:auto"> Ik heb het oorspronkelijke artikel zelf geopend en gelezen.</label><br><label><input type="checkbox" id="checkClaims" style="width:auto"> Ik heb de feitelijke claims onafhankelijk gecontroleerd.</label><br><label><input type="checkbox" id="checkDuplicates" style="width:auto"> Ik heb gecontroleerd dat dit geen dubbel nieuwsbericht is.</label><br><label><input type="checkbox" id="checkLanguage" style="width:auto"> Ik heb de Nederlandse kop en tekst gecontroleerd.</label></fieldset><button id="draft">Maak concept (AI-kosten kunnen ontstaan)</button><div id="result"></div><script>
let current=null;const $=id=>document.getElementById(id);function show(v){$('result').innerHTML='<pre>'+JSON.stringify(v,null,2).replace(/&/g,'&amp;').replace(/</g,'&lt;')+'</pre>'}
$('draft').onclick=async()=>{ $('draft').disabled=true;try{const r=await fetch('/draft',{method:'POST',headers:{'Content-Type':'application/json','Authorization':'Bearer '+$('secret').value},body:JSON.stringify({topic:$('topic').value,category:$('category').value,facts:[$('f1').value,$('f2').value],sourceUrls:[$('u1').value,$('u2').value]})});const d=await r.json();current=d.draft;show(d);if(r.ok&&current){const b=document.createElement('button');b.textContent='GOEDKEUREN EN PUBLICEREN';b.onclick=async()=>{if(!confirm('Weet je zeker dat je dit artikel wilt publiceren?'))return;const p=await fetch('/publish',{method:'POST',headers:{'Content-Type':'application/json','Authorization':'Bearer '+$('secret').value},body:JSON.stringify({approved:true,draft:current,category:$('category').value,verifiedFacts:[$('f1').value,$('f2').value],sources:[{url:$('u1').value},{url:$('u2').value}],editorialChecks:{originalSourceReviewed:$('checkSource').checked,claimsIndependentlyChecked:$('checkClaims').checked,duplicateChecked:$('checkDuplicates').checked,languageChecked:$('checkLanguage').checked}})});show(await p.json())};$('result').appendChild(b)}}catch(e){show({error:String(e)})}finally{$('draft').disabled=false}};
</script></html>`);
  }
  if (req.method === "GET" && url.pathname === "/health") {
    return send(res, 200, { ok: true, service: "VoetbalHub Redactie API", storage: client?.isReady ? "connected" : "not_connected", aiConfigured: !!GROQ_API_KEY });
  }
  if (req.method === "GET" && url.pathname === "/articles") {
    try { const articles = await getArticles(); return send(res, 200, { count: articles.length, articles }); }
    catch { return send(res, 503, { error: "Artikelenopslag is nog niet verbonden. Configureer REDIS_URL in Render." }); }
  }
  if (req.method === "GET" && url.pathname === "/inbox") {
    if (!authorized(req)) return send(res, 401, { error: "Niet geautoriseerd." });
    if (!client?.isReady) return send(res, 503, { error: "Opslag niet verbonden. Controleer REDIS_URL en de Redis-verbinding in Render." });
    const items = [];
    // Read the automatic inbox explicitly so the scheduled pipeline's records are always included.
    try {
      const automaticRaw = await client.get("inbox:auto");
      const automatic = automaticRaw ? JSON.parse(automaticRaw) : [];
      if (Array.isArray(automatic)) items.push(...automatic.filter(item => item && typeof item === "object" && typeof item.headline === "string"));
    } catch (e) { console.error("Could not parse inbox:auto:", e.message); }
    // Include older editorial inboxes too, while avoiding double-counting inbox:auto.
    const keys = (await client.keys("inbox:*")).filter(key => key !== "inbox:auto" && key !== "inbox:auto-draft-urls");
    for (const key of keys.slice(0, 30)) {
      const raw = await client.get(key);
      try {
        const batch = JSON.parse(raw || "[]");
        if (Array.isArray(batch)) items.push(...batch.filter(item => item && typeof item === "object" && typeof item.headline === "string"));
      } catch {}
    }
    const uniqueByIdentity = new Map();
    for (const item of items) {
      const urlKey = String(item.source?.url || item.sourceUrl || "").trim().replace(/#.*$/, "");
      const titleKey = normalizeHeadline(item.headline);
      const key = urlKey ? "url:" + urlKey : (titleKey ? "title:" + titleKey : (item.id || crypto.randomUUID()));
      const existing = uniqueByIdentity.get(key);
      if (!existing || String(item.createdAt || "") > String(existing.createdAt || "")) uniqueByIdentity.set(key, item);
    }
    // Exclude low-value items from the editorial queue. This is a display/queue filter:
    // records stay in Redis for auditability, but old records are filtered on every /inbox read.
    const isLowQualityFeedItem = item => {
      // Test every plausible headline field. Some legacy records have a feed/source
      // title before the actual headline, which previously let bad titles slip through.
      const candidates = [
        item.headline, item.title, item.sourceEvidence?.title,
        item.source?.title, item.feedTitle
      ].map(value => String(value || "").trim().toLowerCase()).filter(Boolean);
      if (!candidates.length) return true;
      const normalize = value => value
        .replace(/[’‘]/g, "'")
        .replace(/[^a-z0-9à-ÿ' -]/g, " ")
        .replace(/\s+/g, " ").trim();
      const excludedPhrases = [
        "quiz", "who am i", "today's other quizzes", "gossip", "transfer gossip",
        "praat mee", "live blog", "live discussion", "match thread", "predictions thread",
        "spelersbattle", "southampton technical director", "technical director",
        "trump bezorgd om nfl", "nfl-duel", "nfl duel"
      ];
      const englishSignals = new Set([
        "the","and","could","would","should","after","before","with","without","from",
        "their","they","them","he","she","his","her","are","was","were","has","have",
        "will","weeks","fear","happy","unsure","journey","taken","hospital","lay","down",
        "marker","define","seasons","today","saturday","continues","start","new","put",
        "me","in","difficult","position","technical","director","manager","says","reports",
        "reveals","confirmed","statement","ahead","draw","win","loss","players","coach",
        "boss","injury","return","signing","transfer","deal","talks","club","football",
        "premier","league","not","for","to","of","on","at","is","been","amid","as",
        "over","under","into","out","up","vs"
      ]);
      const dutchSignals = new Set([
        "de","het","een","van","voor","bij","met","door","na","naar","zijn","haar","wint",
        "verliest","zegt","blikt","terug","speelt","krijgt","maakt","club","trainer",
        "voetbal","doelman","spelers","gaat","moet","kan","heeft","wordt","op","als",
        "maar","niet","tegen","weer","nu","dit","dat","uit","over","nog","komt","wil",
        "zou","blijft","eindelijk","twee","rond","en","bij"
      ]);
      return candidates.some(candidate => {
        const normalized = normalize(candidate);
        if (excludedPhrases.some(phrase => normalized.includes(phrase))) return true;
        const words = normalized.split(" ").filter(Boolean);
        const englishCount = words.filter(word => englishSignals.has(word)).length;
        const dutchCount = words.filter(word => dutchSignals.has(word)).length;
        // Conservative language check: only hide clear English headlines, not mixed Dutch titles.
        return words.length >= 5 && englishCount >= 3 && englishCount > dutchCount * 2;
      });
    };
    const filteredUnique = [...uniqueByIdentity.values()].filter(item => !isLowQualityFeedItem(item));
    const unique = filteredUnique.map(item => {
      // Existing Redis drafts may predate the RSS-only AI rewrite guard. Do not
      // display their AI-expanded copy as an article when the saved evidence is only RSS.
      const ev = item.sourceEvidence || {};
      const rssOnly = ev.evidenceLevel === "rss_title_and_description_only" || (!ev.content && !ev.excerpt);
      const sourceHeadline = String(ev.title || item.source?.title || item.feedTitle || "").trim();
      const sourceDescription = String(ev.description || item.source?.description || item.feedDescription || "").trim();
      const safeItem = rssOnly ? {
        ...item,
        headline: sourceHeadline || item.headline,
        // Do not promote a long RSS description or legacy AI copy into an article.
        standfirst: "Alleen RSS-informatie beschikbaar. Open de oorspronkelijke bron en schrijf het artikel na controle zelf uit.",
        body: [],
        intro: "",
        articleText: "",
        claims: [],
        languagePolish: "skipped_rss_only_source",
        languagePolishNote: "AI-uitbreiding en oude claims verborgen omdat geen volledige artikeltekst beschikbaar is."
      } : {
        ...item,
        sourceEvidence: item.sourceEvidence ? {
          ...item.sourceEvidence,
          content: cleanExtractedSourceText(item.sourceEvidence.content),
          excerpt: cleanExtractedSourceText(item.sourceEvidence.excerpt)
        } : item.sourceEvidence
      };
      const auditedItem = auditClaims(safeItem);
      const qualityReview = editorialQuality(auditedItem);
      const claims = Array.isArray(auditedItem.claims) ? auditedItem.claims : [];
      const hasFullSourceEvidence = !rssOnly;
      const allClaimsSupported = hasFullSourceEvidence && claims.length > 0 && claims.every(claim => claim && claim.status === "supported_by_feed");
      const existingNotes = String(auditedItem.verification_notes || auditedItem.verificationNotes || "").trim();
      const disclaimer = "RSS-CONTROLE, GEEN ONAFHANKELIJKE FACTCHECK: bronvergelijking is geen onafhankelijke factcheck; controleer claims rechtstreeks bij de oorspronkelijke bron.";
      return {
        ...auditedItem,
        verification_status: allClaimsSupported ? "supported_by_feed" : "needs_review",
        verification_notes: existingNotes.toUpperCase().startsWith("RSS-CONTROLE, GEEN ONAFHANKELIJKE FACTCHECK")
          ? existingNotes
          : disclaimer + (existingNotes ? " " + existingNotes : ""),
        qualityReview
      };
    });
    unique.sort((a,b) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")));
    return send(res, 200, { count: unique.length, items: unique.slice(0, 200), autoPublish: false, note: "Kwaliteitssignalen zijn waarschuwingen, geen onafhankelijke factcheck." });
  }
  if (req.method !== "POST") return send(res, 404, { error: "Gebruik GET /health, GET /articles, GET /inbox of POST /draft en POST /publish." });
  if (!authorized(req)) return send(res, 401, { error: "Niet geautoriseerd." });
  let body;
  try { body = await readBody(req); } catch (e) { return send(res, 400, { error: e.message === "body_too_large" ? "Verzoek te groot." : "Ongeldige JSON." }); }
  if (url.pathname === "/auto-inbox") {
    if (!client?.isReady) return send(res, 503, { error: "Opslag niet verbonden." });
    const item = body.item;
    if (!item || typeof item.headline !== "string" || !Array.isArray(item.body)) return send(res, 400, { error: "Ongeldig concept." });
    const key = "inbox:auto";
    const raw = await client.get(key);
    const inbox = raw ? JSON.parse(raw) : [];
    const incomingUrl = String(item.source?.url || item.sourceUrl || "").trim().replace(/#.*$/, "");
    const incomingHeadline = normalizeHeadline(item.headline);
    const isDuplicate = inbox.some(x => {
      const existingUrl = String(x.source?.url || x.sourceUrl || "").trim().replace(/#.*$/, "");
      const existingHeadline = normalizeHeadline(x.headline);
      return (incomingUrl && existingUrl && incomingUrl === existingUrl) ||
        (incomingHeadline && existingHeadline && incomingHeadline === existingHeadline);
    });
    if (isDuplicate) return send(res, 200, { status: "duplicate_skipped" });
    const polishedItem = await polishIncomingDraft(item);
    const auditedItem = auditClaims(polishedItem);
    const quality = editorialQuality(auditedItem);
    inbox.unshift({ ...auditedItem, id: "auto-" + crypto.randomUUID(), status: "draft_for_review", createdAt: new Date().toISOString(), editorialReviewRequired: true, autoPublish: false, qualityReview: quality });
    await client.set(key, JSON.stringify(inbox.slice(0, 200)));
    return send(res, 200, { status: "saved_for_review", count: Math.min(inbox.length + 1, 200) });
  }
  if (url.pathname === "/draft") {
    const topic = typeof body.topic === "string" ? body.topic.trim().slice(0,300) : "";
    const facts = Array.isArray(body.facts) ? body.facts.filter(x => typeof x === "string" && x.trim()).slice(0,20) : [];
    if (!topic || facts.length < 2) return send(res, 400, { error: "Onderwerp en minimaal twee gecontroleerde feiten zijn vereist." });
    if (!GROQ_API_KEY) return send(res, 503, { error: "GROQ_API_KEY ontbreekt in Render environment variables." });
    try {
      const r = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: { "Authorization": "Bearer " + GROQ_API_KEY, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: MODEL,
          messages: [
            { role: "system", content: `Je bent de zorgvuldige Nederlandstalige voetbalredactie van VoetbalHub. VERTAAL elke Engelstalige bronkop volledig naar een natuurlijke Nederlandse nieuwskop; laat de kop nooit in het Engels staan. Schrijf ALLE velden uitsluitend in natuurlijk Nederlands, ook als de RSS-bron Engelstalig is; alleen eigennamen, clubnamen en officiële termen mogen onvertaald blijven. Controleer vóór je JSON terugstuurt expliciet: (1) headline is Nederlands, (2) standfirst en body herhalen elkaar niet, (3) alle alinea's gaan over één en hetzelfde voetbalnieuwsfeit, (4) elke feitelijke claim is letterlijk onderbouwd door de meegeleverde RSS-kop of -beschrijving. Schrijf uitsluitend over één nieuwsgebeurtenis die in de aangeleverde bronkop en bronbeschrijving staat. Combineer nooit verschillende wedstrijden, sporten, artikelen of onderwerpen. Vertaal ook de volledige standfirst en body naar natuurlijk Nederlands: laat geen Engelse zinsdelen of letterlijke Engelse formuleringen staan. Vertaal korte citaten alleen als de invoer geen expliciet letterlijk citaat vereist; gebruik anders geen citaat. Gebruik bij twijfel een korte Nederlandse parafrase en schrijf geen onbewezen details bij. Voer vóór het antwoord een taalcontrole uit op headline, standfirst, iedere body-alinea, why_it_matters en claims; herschrijf elk veld dat nog een Engelse zin bevat. Een club- of persoonsnaam en officiële competitie- of toernooinaam mogen uiteraard onvertaald blijven. Als een bronkop meerdere onderwerpen bevat, kies alleen het duidelijkste voetbalonderwerp en laat de rest weg. Voeg geen achtergrond, uitslagen, namen, doelpuntenmakers, ranglijsten, tijden, locaties, weersomstandigheden, citaten, blessures of reeksen toe tenzij die letterlijk in de bronkop of bronbeschrijving staan. Een URL is geen bewijs dat een pagina is gelezen. Als er te weinig broninformatie is, schrijf dan een kort bericht van maximaal één alinea en zeg niet meer dan de bron ondersteunt. Schrijf zeer compact: een informatieve Nederlandse kop, een standfirst van maximaal 25 woorden en maximaal 2 korte body-alinea's van elk maximaal 60 woorden. De standfirst vat het belangrijkste nieuws samen; de body voegt alleen nieuwe, brononderbouwde informatie toe en mag de standfirst niet opnieuw formuleren. Als de bron onvoldoende informatie biedt, schrijf dan één korte body-alinea. Voeg geen citaten toe tenzij de exacte quote letterlijk in de brongegevens staat. Schrijf nooit dat een club, speler, trainer, arts of woordvoerder iets meldt, vreest, bevestigt of zegt, tenzij de bronkop of bronbeschrijving die specifieke bron/attributie expliciet noemt. Verander een journalistieke mogelijkheid (zoals 'could', 'may' of 'fear') niet in een bevestigde clubmelding of feit. Vertaal Engelse voetbaltermen nauwkeurig: 'could be sidelined' betekent 'mogelijk niet inzetbaar', niet 'buiten de basis staan'. Geen speculatie, geen opvulling en geen verzonnen verklaringen. Retourneer uitsluitend geldige JSON met headline, standfirst, body (array van 1-3 alinea's), why_it_matters, verification_notes en claims (array met controleerbare beweringen). Neem in claims alle concrete feitelijke beweringen op. evidence mag uitsluitend een letterlijk terug te vinden fragment uit de bronkop of bronbeschrijving zijn; anders "Niet aangetoond in aangeleverde RSS-gegevens" met status "unverified". Gebruik status "supported_by_feed" alleen als de bronkop/beschrijving de claim expliciet ondersteunt. Dit is bronvergelijking, geen onafhankelijke factcheck. verification_notes moet altijd beginnen met "RSS-CONTROLE, GEEN ONAFHANKELIJKE FACTCHECK:". Het blijft altijd een concept voor menselijke controle; nooit automatisch publiceren.` },
            { role: "user", content: "Gebruik de volgende JSON-invoer als brongegevens. JSON: " + JSON.stringify({ topic, category: body.category || "Voetbal", facts, sourceUrls: body.sourceUrls || [] }) }
          ],
          response_format: { type: "json_object" },
          temperature: 0.4
        })
      });
      const data = await r.json();
      if (!r.ok) return send(res, 502, { error: "AI-dienstfout", detail: data.error?.message || "Onbekende fout" });
      const text = data.choices?.[0]?.message?.content || "";
      const draft = JSON.parse(text);
      return send(res, 200, { status: "draft_for_review", editorialReviewRequired: true, publishingEnabled: false, draft });
    } catch { return send(res, 502, { error: "Concept kon niet worden gemaakt." }); }
  }
  if (url.pathname === "/publish") {
    if (!client?.isReady) return send(res, 503, { error: "Opslag niet verbonden. Controleer REDIS_URL en de Redis-verbinding in Render." });
    const d = body.draft || {};
    const facts = Array.isArray(body.verifiedFacts) ? body.verifiedFacts.filter(x => typeof x === "string" && x.trim()) : [];
    const sources = Array.isArray(body.sources) ? body.sources.filter(s => s && typeof s.url === "string" && s.url.startsWith("https://")) : [];
    if (body.approved !== true) return send(res, 400, { error: "Expliciete goedkeuring vereist: approved moet true zijn." });
    const review = body.editorialChecks || {};
    const requiredChecks = ["originalSourceReviewed", "claimsIndependentlyChecked", "duplicateChecked", "languageChecked"];
    const missingChecks = requiredChecks.filter(key => review[key] !== true);
    if (missingChecks.length) return send(res, 400, { error: "Publicatie geblokkeerd: voltooi alle redactionele controles.", missingChecks });
    if (typeof d.headline !== "string" || typeof d.standfirst !== "string" || !Array.isArray(d.body) || d.body.length < 1) return send(res, 400, { error: "Artikel mist kop, intro of minimaal één alinea." });
    const sourceDomains = [...new Set(sources.map(s => {
      try { return new URL(s.url).hostname.toLowerCase().replace(/^(www|feeds|m|mobile|amp)\\./, ""); } catch { return ""; }
    }).filter(Boolean))];
    if (facts.length < 2 || sources.length < 2 || sourceDomains.length < 2) return send(res, 400, { error: "Publicatie geblokkeerd: minimaal twee gecontroleerde feiten én twee HTTPS-bronnen van verschillende domeinen zijn vereist. Gebruik niet alleen VoetbalPrimeur of twee links naar dezelfde uitgever." });
    const imageUrl = typeof d.imageUrl === "string" ? d.imageUrl.trim().slice(0,1000) : "";
    const imageSource = typeof d.imageSource === "string" ? d.imageSource.trim().slice(0,300) : "";
    const imageCredit = typeof d.imageCredit === "string" ? d.imageCredit.trim().slice(0,200) : "";
    const imageRights = typeof d.imageRights === "string" ? d.imageRights.trim() : "not_needed";
    if (imageUrl && (!/^https:\/\//i.test(imageUrl) || !["cleared","licensed"].includes(imageRights) || !imageSource || !imageCredit)) return send(res,400,{error:"Een foto vereist een HTTPS-URL, bron, naamsvermelding en bevestigde rechten (cleared/licensed)."});
    if (!imageUrl && !["not_needed","pending","rejected"].includes(imageRights)) return send(res,400,{error:"Beeldrechtenstatus zonder foto is ongeldig."});
    const now = new Date().toISOString();
    const article = { id: crypto.randomUUID(), status: "published", author: "VoetbalHub Redactie", headline: d.headline.slice(0,200), standfirst: d.standfirst.slice(0,500), body: d.body.filter(x => typeof x === "string").slice(0,2), why_it_matters: String(d.why_it_matters || "").slice(0,1000), category: String(body.category || "Voetbal").slice(0,80), publishedAt: now, verifiedFacts: facts, sources, editorialChecks: requiredChecks.reduce((out, key) => (out[key] = true, out), {}), ...(imageUrl ? {imageUrl,imageSource,imageCredit,imageRights} : {imageRights}), autoPublish: false };
    await client.set("article:" + article.id, JSON.stringify(article));
    return send(res, 200, { status: "published", article });
  }
  return send(res, 404, { error: "Onbekend endpoint." });
}
async function start() {
  if (client) {
    try { await client.connect(); console.log("Redis connected"); }
    catch (e) { console.error("Redis not connected; configure REDIS_URL in Render."); }
  } else {
    console.warn("REDIS_URL is not configured; storage endpoints will return 503 until configured.");
  }
  const server = http.createServer((req,res) => { handle(req,res).catch(() => send(res,500,{error:"Interne serverfout."})); });
  server.listen(PORT, "0.0.0.0", () => console.log("VoetbalHub API listening on", PORT));
}
start();
