const { createClient } = require("redis");

const GROQ_API_KEY = process.env.GROQ_API_KEY || "";
const MODEL = process.env.GROQ_MODEL || "openai/gpt-oss-120b";
const REDIS_URL = process.env.REDIS_URL || "";
const FEEDS = [
  "https://feeds.nos.nl/nosvoetbal",
  "https://feeds.bbci.co.uk/sport/football/rss.xml"
];
const MAX_ITEMS_PER_RUN = 1;

function decode(s = "") {
  return s.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&").replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/\s+/g, " ").trim();
}
function tags(xml, tag) {
  const safe = tag.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return [...xml.matchAll(new RegExp("<" + safe + "(?:\\s[^>]*)?>([\\s\\S]*?)<\\/" + safe + ">", "gi"))].map(m => m[1]);
}
function extractItems(xml) {
  const chunks = [...xml.matchAll(/<(item|entry)(?:\s[^>]*)?>([\s\S]*?)<\/\1>/gi)].map(m => m[2]);
  return chunks.map(chunk => {
    const title = decode(tags(chunk, "title")[0] || "");
    const description = decode(tags(chunk, "description")[0] || tags(chunk, "summary")[0] || tags(chunk, "content:encoded")[0] || "");
    let link = decode(tags(chunk, "link")[0] || "");
    if (!link) {
      const m = chunk.match(/<link[^>]+href=["']([^"']+)["']/i);
      if (m) link = m[1];
    }
    const date = decode(tags(chunk, "pubDate")[0] || tags(chunk, "updated")[0] || tags(chunk, "published")[0] || "");
    return { title, description: description.slice(0, 1200), link, date };
  }).filter(x => x.title && /^https?:\/\//i.test(x.link));
}
async function main() {
  if (!GROQ_API_KEY || !REDIS_URL) throw new Error("GROQ_API_KEY en REDIS_URL zijn vereist.");
  const redis = createClient({ url: REDIS_URL, socket: { reconnectStrategy: false } });
  redis.on("error", e => console.error("Redis:", e.message));
  await redis.connect();
  try {
    const candidates = [];
    for (const url of FEEDS) {
      try {
        const r = await fetch(url, { headers: { "User-Agent": "VoetbalHubEditorialBot/1.0" }, signal: AbortSignal.timeout(12000) });
        if (!r.ok) { console.error("Feed mislukt:", url, r.status); continue; }
        const xml = await r.text();
        for (const item of extractItems(xml).slice(0, 8)) candidates.push({ ...item, feed: url });
      } catch (e) { console.error("Feedfout:", url, e.message); }
    }
    candidates.sort((a,b) => Date.parse(b.date || 0) - Date.parse(a.date || 0));
    const existing = await redis.get("inbox:auto-draft-urls");
    const seen = new Set(existing ? JSON.parse(existing) : []);
    const item = candidates.find(x => !seen.has(x.link));
    if (!item) { console.log("Geen nieuw RSS-item gevonden; geen concept aangemaakt."); return; }

    const prompt = {
      onderwerp: item.title,
      samenvatting_bron: item.description,
      bron_url: item.link,
      bron_feed: item.feed,
      publicatiedatum_bron: item.date || null
    };
    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: { "Authorization": "Bearer " + GROQ_API_KEY, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          { role: "system", content: "Je bent de Nederlandstalige voetbalredactie van VoetbalHub. Maak een origineel concept op basis van het aangeleverde bronitem. Kopieer de brontekst niet en verzin geen feiten, citaten, statistieken, blessures, uitslagen of verklaringen. Gebruik geen kennis die niet in het bronitem staat. Als de broninformatie beperkt is, maak dan een kort, zorgvuldig concept met expliciete verification_notes die aangeven welke feiten vóór publicatie nog moeten worden gecontroleerd. Schrijf headline, standfirst, 3-5 body-alinea's, why_it_matters en verification_notes. Retourneer alleen geldige JSON." },
          { role: "user", content: "Maak een origineel concept. Brondata als JSON: " + JSON.stringify(prompt) }
        ],
        response_format: { type: "json_object" },
        temperature: 0.4
      })
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error?.message || "Groq API-fout");
    const draft = JSON.parse(data.choices?.[0]?.message?.content || "{}");
    const record = {
      id: "auto-" + Date.now(),
      status: "draft_for_review",
      createdAt: new Date().toISOString(),
      headline: draft.headline || item.title,
      standfirst: draft.standfirst || "",
      body: Array.isArray(draft.body) ? draft.body.slice(0, 6) : [],
      why_it_matters: draft.why_it_matters || "",
      verification_notes: draft.verification_notes || "Controleer feiten en bron vóór publicatie.",
      category: "Voetbal",
      source: { title: item.title, url: item.link, feed: item.feed, publishedAt: item.date || null },
      editorialReviewRequired: true,
      autoPublish: false
    };
    const inboxRaw = await redis.get("inbox:auto");
    const inbox = inboxRaw ? JSON.parse(inboxRaw) : [];
    inbox.unshift(record);
    await redis.set("inbox:auto", JSON.stringify(inbox.slice(0, 200)));
    seen.add(item.link);
    await redis.set("inbox:auto-draft-urls", JSON.stringify([...seen].slice(-500)));
    console.log("Concept aangemaakt voor controle:", record.headline);
  } finally {
    await redis.quit();
  }
}
main().catch(e => { console.error(e.message); process.exit(1); });
