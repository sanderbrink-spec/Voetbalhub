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
  const sourceText = [src.title, src.description, ev.title, ev.description, ev.excerpt, ev.content, item.feedTitle, item.feedDescription].filter(v => typeof v === "string").join("\n").slice(0, 7000);
  if (!sourceText.trim()) return { ...item, languagePolish: "skipped_no_source_text" };
  try {
    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: { "Authorization": "Bearer " + GROQ_API_KEY, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          { role: "system", content: "Je bent eindredacteur van VoetbalHub. Herschrijf uitsluitend voor taal en helderheid; je bent geen verslaggever en mag geen feiten aanvullen. Gebruik alleen feiten die letterlijk blijken uit de meegeleverde bronkop en bronbeschrijving. Als de bron alleen RSS-kop en -beschrijving bevat, schrijf maximaal één korte body-alinea en houd headline en standfirst strikt bij die informatie. Verzin nooit leeftijden, datums, aftraptijden, uitslagen, blessures, diagnoses, transfers, quotes, verklaringen, ranglijsten, wedstrijdcontext of details over hoe iets gebeurde. Zet onzekerheid uit de bron (zoals mogelijk, zou kunnen, volgens geruchten) niet om in zekerheid. Voeg geen impliciete aannames toe. Maak één artikel over één voetbalnieuwsgebeurtenis; laat elk tweede onderwerp weg. Vertaal Engelse zinnen volledig naar natuurlijk Nederlands, behalve eigennamen en officiële club- en competitiesnamen. Laat intro en body niet hetzelfde zeggen. Als er te weinig informatie is, schrijf kort en sober. Retourneer uitsluitend geldige JSON met headline, standfirst en body (array met maximaal 1 korte alinea bij RSS-only bewijs, anders maximaal 2). Dit is taalredactie, geen factcheck; menselijke controle blijft verplicht." },
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
  if (!!!client?.isReady) throw new Error("REDIS_UNAVAILABLE");
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
  if (req.method === "GET" && url.pathname === "/desk") {
    res.writeHead(200, {"Content-Type":"text/html; charset=utf-8","Cache-Control":"no-store"});
    return res.end(`<!doctype html><html lang="nl"><meta name="viewport" content="width=device-width,initial-scale=1"><title>VoetbalHub | Redactiedesk</title><style>
:root{color-scheme:dark}*{box-sizing:border-box}body{margin:0;background:#0b0d10;color:#f3f5f7;font:16px system-ui,-apple-system,sans-serif}.wrap{max-width:900px;margin:auto;padding:20px}header{border-bottom:1px solid #292e35;padding:20px 0;margin-bottom:20px}h1{margin:0;color:#a6ff00;font-size:27px}p{color:#b7bec7}.pill{display:inline-block;border:1px solid #3b424c;border-radius:99px;padding:5px 10px;font-size:12px;color:#c9d0d8}.card{background:#15191f;border:1px solid #303741;border-radius:14px;padding:16px;margin:14px 0;overflow-wrap:anywhere}h2{font-size:21px;margin:10px 0}h3{font-size:16px;margin-bottom:6px;color:#cbd3dd}a{color:#b5ff37}input,button{width:100%;padding:13px;border-radius:9px;margin:6px 0;border:1px solid #444d58;background:#20252c;color:white;font:inherit}button{background:#a6ff00;color:#101010;font-weight:750;border:0}button.secondary{background:#29313a;color:#fff;border:1px solid #46515e}.muted{color:#aab2bd;font-size:13px}.body p{line-height:1.55;color:#e1e5ea}.row{display:flex;gap:8px;flex-wrap:wrap}.row button{flex:1;min-width:130px}.error{color:#ff8b8b}.ok{color:#b5ff37}details{margin-top:12px}summary{cursor:pointer;color:#cbd3dd}</style><div class="wrap"><header><h1>VoetbalHub Redactiedesk</h1><p>Automatische concepten • broncontrole • publicatie blijft handmatig</p><span class="pill">PUBLICATIE AUTOMATISCH UITGESCHAKELD</span></header><section class="card"><label for="secret">HUB_API_SECRET</label><input id="secret" type="password" autocomplete="off" placeholder="Vul je redactiesleutel in"><button id="load">Laad concepten</button><div id="status" class="muted">Je sleutel wordt alleen gebruikt voor deze aanvraag en niet opgeslagen.</div></section><section id="items"></section></div><script>
const $=id=>document.getElementById(id);function legacyWarning(x){return ""}function esc(s){return String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]))}
$("load").onclick=async()=>{const secret=$("secret").value.trim();if(!secret){$("status").textContent="Vul eerst HUB_API_SECRET in.";return}$("load").disabled=true;$("status").textContent="Concepten ophalen…";try{const r=await fetch("/inbox",{headers:{Authorization:"Bearer "+secret}});const d=await r.json();if(!r.ok)throw Error(d.error||"Ophalen mislukt");const list=(d.items||[]).filter(x=>x&&typeof x==="object"&&x.headline);$("status").innerHTML='<span class="ok">'+list.length+' concept(en) gevonden.</span>';if(!list.length){$("items").innerHTML='<div class="card">Nog geen automatische concepten gevonden. Start de workflow handmatig en probeer opnieuw.</div>';return}$("items").innerHTML=list.map(x=>'<article class="card"><span class="pill">'+esc(x.status||"draft_for_review")+'</span> <span class="pill">'+esc(x.category||"Voetbal")+'</span>'+(legacyWarning(x)?'<p class="error"><strong>'+esc(legacyWarning(x))+'</strong></p>':'')+'<h2>'+esc(x.headline)+'</h2><p>'+esc(x.standfirst||"")+'</p><div class="body">'+(Array.isArray(x.body)?x.body:[]).map(p=>'<p>'+esc(p)+'</p>').join("")+'</div><h3>Bron</h3>'+(x.source&&x.source.url?'<p><a href="'+esc(x.source.url)+'" target="_blank" rel="noopener">'+esc(x.source.title||x.source.url)+'</a></p>':'<p class="muted">Geen bronlink opgeslagen</p>')+(x.languagePolish==="ai_edited_source_limited"?'<p class="ok"><strong>Taalredactie:</strong> '+esc(x.languagePolishNote||"AI-taalredactie uitgevoerd; menselijke broncontrole blijft verplicht.")+'</p>':x.languagePolish&&x.languagePolish!=="not_run"&&x.languagePolish!=="skipped_no_source_text"?'<p class="error"><strong>Taalredactie niet uitgevoerd.</strong> Controleer de tekst handmatig.</p>':'')+(x.qualityReview&&Array.isArray(x.qualityReview.warnings)?'<p class="error"><strong>Kwaliteitssignalen</strong></p><ul>'+x.qualityReview.warnings.map(w=>'<li>'+esc(w)+'</li>').join("")+'</ul>':'')+'<details open><summary>Redactionele kwaliteitscontrole</summary><p><strong>Status:</strong> '+esc(x.verification_status||"needs_review")+'</p><p>'+esc(/RSS-CONTROLE, GEEN ONAFHANKELIJKE FACTCHECK/i.test(String(x.verification_notes||""))?"Alleen RSS-gegevens gebruikt. Dit is geen onafhankelijke factcheck; controleer concrete claims rechtstreeks bij de oorspronkelijke bron.":x.verification_notes||"NIET GECONTROLEERD: controleer alle feiten onafhankelijk vóór publicatie.")+'</p>'+(x.sourceEvidence?'<p><strong>Bronbewijs:</strong> '+esc(x.sourceEvidence.evidenceLevel||"onbekend")+'</p>'+(x.sourceEvidence.evidenceLevel==="rss_title_and_description_only"?'<p class="muted">RSS-beschrijving verborgen: deze tekst is alleen bronmateriaal en wordt niet als artikeltekst getoond.</p>':'<p>'+esc(x.sourceEvidence.description||"Geen beschrijving in de RSS-feed; alleen de kop is beschikbaar.")+'</p>'):'<p>Geen apart bronbewijs opgeslagen. Controleer de bron handmatig.</p>')+(Array.isArray(x.claims)&&x.claims.length?'<h3>Controleerbare claims</h3><ul>'+x.claims.map(cl=>'<li><strong>'+esc(cl.status||"unverified")+'</strong> — '+esc(cl.claim||"Claim ontbreekt")+'<br><span class="muted">Bewijs: '+esc(cl.evidence||"Niet aangetoond in aangeleverde RSS-gegevens")+'</span></li>').join("")+'</ul>':'<p class="muted">Geen claim-voor-claim-overzicht beschikbaar. Controleer alle feitelijke beweringen handmatig.</p>')+'<p class="muted">Dit is een bronvergelijking, geen onafhankelijke feitelijke verificatie. Publicatie blijft handmatig.</p></details><p class="muted">Aangemaakt: '+esc(x.createdAt||"tijd onbekend")+'</p></article>').join("")}catch(e){$("status").innerHTML='<span class="error">'+esc(e.message)+'</span>'}finally{$("load").disabled=false}};
</script></html>`);
  }
  if (req.method === "GET" && url.pathname === "/editor") {
    res.writeHead(200, {"Content-Type":"text/html; charset=utf-8","Cache-Control":"no-store"});
    return res.end(`<!doctype html><html lang="nl"><meta name="viewport" content="width=device-width,initial-scale=1"><title>VoetbalHub Redactie</title><style>body{font:16px system-ui;background:#101010;color:#f5f5f5;max-width:760px;margin:24px auto;padding:16px}h1{color:#9cff00}input,textarea,button{box-sizing:border-box;width:100%;margin:7px 0;padding:12px;border-radius:8px;border:1px solid #555;background:#202020;color:#fff}button{background:#a6ff00;color:#111;font-weight:bold}pre{white-space:pre-wrap;overflow-wrap:anywhere;background:#202020;padding:12px;border-radius:8px}small{color:#bbb}</style><h1>VoetbalHub Redactie</h1><p>Maak één concept. Publiceren gebeurt pas na jouw expliciete goedkeuring.</p><label>Geheime HUB_API_SECRET (blijft alleen in deze pagina)</label><input id="secret" type="password" autocomplete="off"><label>Onderwerp</label><input id="topic" value="FC Groningen: vooruitblik op NEC-uit"><label>Categorie</label><input id="category" value="FC Groningen"><label>Gecontroleerd feit 1</label><textarea id="f1">Volgens het KNVB-programma speelt FC Groningen op zondag 25 oktober 2026 om 14.30 uur uit tegen NEC.</textarea><label>Bron-URL 1</label><input id="u1" value="https://www.knvb.nl/competities/eredivisie/programma"><label>Gecontroleerd feit 2</label><textarea id="f2">De Eredivisie-uitslagenpagina vermeldt dat FC Groningen op 18 oktober met 2-5 verloor van Ajax.</textarea><label>Bron-URL 2</label><input id="u2" value="https://www.knvb.nl/competities/eredivisie/uitslagen"><fieldset style="border:1px solid #555;border-radius:8px;padding:12px;margin:12px 0"><legend>Verplichte controle vóór publicatie</legend><label><input type="checkbox" id="checkSource" style="width:auto"> Ik heb het oorspronkelijke artikel zelf geopend en gelezen.</label><br><label><input type="checkbox" id="checkClaims" style="width:auto"> Ik heb de feitelijke claims onafhankelijk gecontroleerd.</label><br><label><input type="checkbox" id="checkDuplicates" style="width:auto"> Ik heb gecontroleerd dat dit geen dubbel nieuwsbericht is.</label><br><label><input type="checkbox" id="checkLanguage" style="width:auto"> Ik heb de Nederlandse kop en tekst gecontroleerd.</label></fieldset><button id="draft">Maak concept (AI-kosten kunnen ontstaan)</button><div id="result"></div><script>
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
    if (!client.isReady) return send(res, 503, { error: "Opslag niet verbonden." });
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
    // Filter low-value feed entries before editorial review: English-only headlines,
    // quizzes/gossip roundups, and live discussion prompts are not standalone Dutch football news.
    const isLowQualityFeedItem = item => {
      const title = String(item.sourceEvidence?.title || item.source?.title || item.feedTitle || item.headline || "").trim().toLowerCase();
      if (!title) return true;
      const excludedPhrases = ["quiz", "who am i", "today's other quizzes", "gossip", "transfer gossip", "praat mee", "live blog", "live discussion", "match thread", "predictions thread"];
      if (excludedPhrases.some(phrase => title.includes(phrase))) return true;
      // Filter clearly English-language headlines, without relying on a translation model.
      const words = title.replace(/[.,:!?'"()]/g, " ").split(" ").filter(Boolean);
      const englishSignals = new Set(["the","and","could","would","should","after","before","with","without","from","their","they","he","she","his","her","are","was","were","has","have","will","weeks","fear","happy","unsure","journey","taken","hospital","lay","down","marker","define","seasons","today","saturday","continues","start","new"]);
      const dutchSignals = new Set(["de","het","een","van","voor","bij","met","door","na","naar","zijn","haar","wint","verliest","zegt","blikt","terug","speelt","krijgt","maakt","club","trainer","voetbal","doelman","spelers","gaat","moet","kan","heeft","wordt","op"]);
      const englishCount = words.filter(word => englishSignals.has(word)).length;
      const dutchCount = words.filter(word => dutchSignals.has(word)).length;
      return words.length >= 5 && englishCount >= 2 && englishCount > dutchCount;
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
        // Show a clear review placeholder; the source description remains visible in evidence below.
        standfirst: "Alleen RSS-informatie beschikbaar. Open de oorspronkelijke bron en schrijf het artikel na controle zelf uit.",
        body: [],
        intro: "",
        articleText: "",
        claims: [],
        languagePolish: "skipped_rss_only_source",
        languagePolishNote: "AI-uitbreiding en oude claims verborgen omdat geen volledige artikeltekst beschikbaar is."
      } : item;
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
    if (!client.isReady) return send(res, 503, { error: "Opslag niet verbonden." });
    const d = body.draft || {};
    const facts = Array.isArray(body.verifiedFacts) ? body.verifiedFacts.filter(x => typeof x === "string" && x.trim()) : [];
    const sources = Array.isArray(body.sources) ? body.sources.filter(s => s && typeof s.url === "string" && s.url.startsWith("https://")) : [];
    if (body.approved !== true) return send(res, 400, { error: "Expliciete goedkeuring vereist: approved moet true zijn." });
    const review = body.editorialChecks || {};
    const requiredChecks = ["originalSourceReviewed", "claimsIndependentlyChecked", "duplicateChecked", "languageChecked"];
    const missingChecks = requiredChecks.filter(key => review[key] !== true);
    if (missingChecks.length) return send(res, 400, { error: "Publicatie geblokkeerd: voltooi alle redactionele controles.", missingChecks });
    if (typeof d.headline !== "string" || typeof d.standfirst !== "string" || !Array.isArray(d.body) || d.body.length < 1) return send(res, 400, { error: "Artikel mist kop, intro of minimaal één alinea." });
    if (facts.length < 2 || sources.length < 1) return send(res, 400, { error: "Minimaal twee gecontroleerde feiten en één HTTPS-bron zijn vereist." });
    const now = new Date().toISOString();
    const article = { id: crypto.randomUUID(), status: "published", author: "VoetbalHub Redactie", headline: d.headline.slice(0,200), standfirst: d.standfirst.slice(0,500), body: d.body.filter(x => typeof x === "string").slice(0,2), why_it_matters: String(d.why_it_matters || "").slice(0,1000), category: String(body.category || "Voetbal").slice(0,80), publishedAt: now, verifiedFacts: facts, sources, editorialChecks: requiredChecks.reduce((out, key) => (out[key] = true, out), {}), autoPublish: false };
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
