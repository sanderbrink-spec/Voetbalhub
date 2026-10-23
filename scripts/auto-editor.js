const GROQ_API_KEY = process.env.GROQ_API_KEY || "";
const HUB_API_SECRET = process.env.HUB_API_SECRET || "";
const API_URL = process.env.VOETBALHUB_API_URL || "https://voetbalhub-redactie.onrender.com";
const MODEL = process.env.GROQ_MODEL || "openai/gpt-oss-120b";
const FEEDS = [
  "https://feeds.nos.nl/nosvoetbal",
  "https://feeds.bbci.co.uk/sport/football/rss.xml"
];

function decode(s = "") {
  return s.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/<[^>]+>/g, " ").replace(/&amp;/g, "&").replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/\s+/g, " ").trim();
}
function tag(chunk, name) {
  const m = chunk.match(new RegExp("<" + name + "(?:\\s[^>]*)?>([\\s\\S]*?)</" + name + ">", "i"));
  if (m) return decode(m[1]);
  if (name === "link") {
    const a = chunk.match(/<link[^>]+href=["']([^"']+)["']/i);
    if (a) return a[1];
  }
  return "";
}
function extractItems(xml) {
  return [...xml.matchAll(/<(item|entry)(?:\s[^>]*)?>([\s\S]*?)<\/\1>/gi)].map(m => {
    const c = m[2];
    return {
      title: tag(c, "title"),
      description: (tag(c, "description") || tag(c, "summary") || tag(c, "content:encoded")).slice(0, 1200),
      link: tag(c, "link"),
      date: tag(c, "pubDate") || tag(c, "updated") || tag(c, "published")
    };
  }).filter(x => x.title && /^https?:\/\//i.test(x.link));
}
async function main() {
  if (!GROQ_API_KEY || !HUB_API_SECRET) throw new Error("GROQ_API_KEY en HUB_API_SECRET moeten als GitHub Actions secrets zijn ingesteld.");
  const candidates = [];
  for (const url of FEEDS) {
    try {
      const r = await fetch(url, { headers: { "User-Agent": "VoetbalHubEditorialBot/1.0" }, signal: AbortSignal.timeout(12000) });
      if (!r.ok) { console.log("Feed overgeslagen:", url, r.status); continue; }
      for (const item of extractItems(await r.text()).slice(0, 10)) candidates.push({ ...item, feed: url });
    } catch (e) { console.log("Feedfout:", url, e.message); }
  }
  candidates.sort((a,b) => (Date.parse(b.date || "") || 0) - (Date.parse(a.date || "") || 0));
  if (!candidates.length) throw new Error("Geen nieuwsitems gevonden in de beschikbare RSS-feeds.");
  let saved = 0;
  for (const item of candidates.slice(0, 10)) {
    const r = await fetch(API_URL + "/draft", {
      method: "POST",
      headers: { "Authorization": "Bearer " + HUB_API_SECRET, "Content-Type": "application/json" },
      body: JSON.stringify({
        topic: item.title,
        category: "Voetbal",
        facts: [
          "Bronkop: " + item.title,
          "Bronbeschrijving: " + (item.description || "De feed bevat geen beschrijving; schrijf voorzichtig en vermeld de beperkte broninformatie.")
        ],
        sourceUrls: [item.link, item.feed]
      }),
      signal: AbortSignal.timeout(45000)
    });
    const data = await r.json();
    if (!r.ok) {
      console.log("Concept maken mislukt:", r.status, JSON.stringify(data));
      if (r.status === 502 || r.status === 503) throw new Error(data.detail || data.error || "AI-service fout");
      continue;
    }
    const draft = data.draft;
    const save = await fetch(API_URL + "/auto-inbox", {
      method: "POST",
      headers: { "Authorization": "Bearer " + HUB_API_SECRET, "Content-Type": "application/json" },
      body: JSON.stringify({ item: {
        headline: draft.headline || item.title,
        standfirst: draft.standfirst || "",
        body: Array.isArray(draft.body) ? draft.body.slice(0, 6) : [],
        why_it_matters: draft.why_it_matters || "",
        verification_notes: draft.verification_notes || "Controleer alle feiten vóór publicatie.",
        category: "Voetbal",
        source: { title: item.title, url: item.link, feed: item.feed, publishedAt: item.date || null }
      }}),
      signal: AbortSignal.timeout(20000)
    });
    const savedData = await save.json();
    if (!save.ok) throw new Error("Opslaan mislukt: " + JSON.stringify(savedData));
    if (savedData.status === "saved_for_review") { saved++; console.log("Concept opgeslagen ter controle:", draft.headline); break; }
    if (savedData.status === "duplicate_skipped") console.log("Dubbel bronitem overgeslagen:", item.link);
  }
  if (!saved) console.log("Geen nieuw concept opgeslagen; beschikbare items waren mogelijk al verwerkt.");
}
main().catch(e => { console.error(e.message); process.exit(1); });
