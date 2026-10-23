const http = require("node:http");
const { createClient } = require("redis");

const PORT = Number(process.env.PORT || 10000);
const API_SECRET = process.env.HUB_API_SECRET || "";
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || "";
const MODEL = process.env.OPENAI_MODEL || "gpt-4.1-mini";
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
  if (req.method === "GET" && url.pathname === "/editor") {
    res.writeHead(200, {"Content-Type":"text/html; charset=utf-8","Cache-Control":"no-store"});
    return res.end(`<!doctype html><html lang="nl"><meta name="viewport" content="width=device-width,initial-scale=1"><title>VoetbalHub Redactie</title><style>body{font:16px system-ui;background:#101010;color:#f5f5f5;max-width:760px;margin:24px auto;padding:16px}h1{color:#9cff00}input,textarea,button{box-sizing:border-box;width:100%;margin:7px 0;padding:12px;border-radius:8px;border:1px solid #555;background:#202020;color:#fff}button{background:#a6ff00;color:#111;font-weight:bold}pre{white-space:pre-wrap;overflow-wrap:anywhere;background:#202020;padding:12px;border-radius:8px}small{color:#bbb}</style><h1>VoetbalHub Redactie</h1><p>Maak één concept. Publiceren gebeurt pas na jouw expliciete goedkeuring.</p><label>Geheime HUB_API_SECRET (blijft alleen in deze pagina)</label><input id="secret" type="password" autocomplete="off"><label>Onderwerp</label><input id="topic" value="FC Groningen: vooruitblik op NEC-uit"><label>Categorie</label><input id="category" value="FC Groningen"><label>Gecontroleerd feit 1</label><textarea id="f1">Volgens het KNVB-programma speelt FC Groningen op zondag 25 oktober 2026 om 14.30 uur uit tegen NEC.</textarea><label>Bron-URL 1</label><input id="u1" value="https://www.knvb.nl/competities/eredivisie/programma"><label>Gecontroleerd feit 2</label><textarea id="f2">De Eredivisie-uitslagenpagina vermeldt dat FC Groningen op 18 oktober met 2-5 verloor van Ajax.</textarea><label>Bron-URL 2</label><input id="u2" value="https://www.knvb.nl/competities/eredivisie/uitslagen"><button id="draft">Maak concept (AI-kosten kunnen ontstaan)</button><div id="result"></div><script>
let current=null;const $=id=>document.getElementById(id);function show(v){$('result').innerHTML='<pre>'+JSON.stringify(v,null,2).replace(/&/g,'&amp;').replace(/</g,'&lt;')+'</pre>'}
$('draft').onclick=async()=>{ $('draft').disabled=true;try{const r=await fetch('/draft',{method:'POST',headers:{'Content-Type':'application/json','Authorization':'Bearer '+$('secret').value},body:JSON.stringify({topic:$('topic').value,category:$('category').value,facts:[$('f1').value,$('f2').value],sourceUrls:[$('u1').value,$('u2').value]})});const d=await r.json();current=d.draft;show(d);if(r.ok&&current){const b=document.createElement('button');b.textContent='GOEDKEUREN EN PUBLICEREN';b.onclick=async()=>{if(!confirm('Weet je zeker dat je dit artikel wilt publiceren?'))return;const p=await fetch('/publish',{method:'POST',headers:{'Content-Type':'application/json','Authorization':'Bearer '+$('secret').value},body:JSON.stringify({approved:true,draft:current,category:$('category').value,verifiedFacts:[$('f1').value,$('f2').value],sources:[{url:$('u1').value},{url:$('u2').value}]})});show(await p.json())};$('result').appendChild(b)}}catch(e){show({error:String(e)})}finally{$('draft').disabled=false}};
</script></html>`);
  }
  if (req.method === "GET" && url.pathname === "/health") {
    return send(res, 200, { ok: true, service: "VoetbalHub Redactie API", storage: client.isReady ? "connected" : "not_connected", aiConfigured: !!OPENAI_API_KEY });
  }
  if (req.method === "GET" && url.pathname === "/articles") {
    try { const articles = await getArticles(); return send(res, 200, { count: articles.length, articles }); }
    catch { return send(res, 503, { error: "Artikelenopslag is nog niet verbonden. Configureer REDIS_URL in Render." }); }
  }
  if (req.method === "GET" && url.pathname === "/inbox") {
    if (!authorized(req)) return send(res, 401, { error: "Niet geautoriseerd." });
    if (!client.isReady) return send(res, 503, { error: "Opslag niet verbonden." });
    const keys = await client.keys("inbox:*");
    const items = [];
    for (const key of keys.slice(0, 30)) {
      const raw = await client.get(key);
      try { const batch = JSON.parse(raw || "[]"); if (Array.isArray(batch)) items.push(...batch); } catch {}
    }
    return send(res, 200, { count: items.length, items: items.slice(0, 200), autoPublish: false });
  }
  if (req.method !== "POST") return send(res, 404, { error: "Gebruik GET /health, GET /articles, GET /inbox of POST /draft en POST /publish." });
  if (!authorized(req)) return send(res, 401, { error: "Niet geautoriseerd." });
  let body;
  try { body = await readBody(req); } catch (e) { return send(res, 400, { error: e.message === "body_too_large" ? "Verzoek te groot." : "Ongeldige JSON." }); }
  if (url.pathname === "/draft") {
    const topic = typeof body.topic === "string" ? body.topic.trim().slice(0,300) : "";
    const facts = Array.isArray(body.facts) ? body.facts.filter(x => typeof x === "string" && x.trim()).slice(0,20) : [];
    if (!topic || facts.length < 2) return send(res, 400, { error: "Onderwerp en minimaal twee gecontroleerde feiten zijn vereist." });
    if (!OPENAI_API_KEY) return send(res, 503, { error: "OPENAI_API_KEY ontbreekt in Render environment variables." });
    try {
      const r = await fetch("https://api.openai.com/v1/responses", {
        method: "POST",
        headers: { "Authorization": "Bearer " + OPENAI_API_KEY, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: MODEL,
          instructions: "Schrijf originele Nederlandstalige voetbaljournalistiek. Gebruik uitsluitend aangeleverde feiten; verzin geen citaten, namen, cijfers of gebeurtenissen. Dit is een concept voor menselijke controle, nooit automatisch publiceren. Retourneer JSON met headline, standfirst, body (array van 3-6 alinea's), why_it_matters en verification_notes.",
          input: "Gebruik de volgende JSON-invoer als brongegevens. JSON: " + JSON.stringify({ topic, category: body.category || "Voetbal", facts, sourceUrls: body.sourceUrls || [] }),
          text: { format: { type: "json_object" } }
        })
      });
      const data = await r.json();
      if (!r.ok) return send(res, 502, { error: "AI-dienstfout", detail: data.error?.message || "Onbekende fout" });
      const text = (data.output || []).flatMap(x => x.content || []).filter(x => x.type === "output_text").map(x => x.text).join("\n");
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
    if (typeof d.headline !== "string" || typeof d.standfirst !== "string" || !Array.isArray(d.body) || d.body.length < 3) return send(res, 400, { error: "Artikel mist kop, intro of minimaal drie alinea's." });
    if (facts.length < 2 || sources.length < 1) return send(res, 400, { error: "Minimaal twee gecontroleerde feiten en één HTTPS-bron zijn vereist." });
    const now = new Date().toISOString();
    const article = { id: crypto.randomUUID(), status: "published", author: "VoetbalHub Redactie", headline: d.headline.slice(0,200), standfirst: d.standfirst.slice(0,500), body: d.body.filter(x => typeof x === "string").slice(0,8), why_it_matters: String(d.why_it_matters || "").slice(0,1000), category: String(body.category || "Voetbal").slice(0,80), publishedAt: now, verifiedFacts: facts, sources };
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
