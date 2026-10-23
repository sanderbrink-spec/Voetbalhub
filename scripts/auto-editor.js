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

  // Haal bestaande concepten op zodat hetzelfde nieuws niet opnieuw verschijnt via een andere feed.
  let existing = [];
  try {
    const inboxResponse = await fetch(API_URL + "/inbox", {
      headers: { "Authorization": "Bearer " + HUB_API_SECRET },
      signal: AbortSignal.timeout(15000)
    });
    if (inboxResponse.ok) {
      const inboxData = await inboxResponse.json();
      existing = Array.isArray(inboxData.items) ? inboxData.items : [];
    } else {
      console.log("Bestaande concepten niet vooraf geladen; alleen bron-URL-deduplicatie blijft beschikbaar.");
    }
  } catch (e) {
    console.log("Bestaande concepten niet vooraf geladen:", e.message);
  }
  const normalize = value => String(value || "").toLowerCase()
    .normalize("NFD").replace(/[\\u0300-\\u036f]/g, "")
    .replace(/[^a-z0-9 ]/g, " ").split(/\\s+/)
    .filter(w => w.length > 2 && !["the","and","with","from","after","voor","naar","van","het","een","bij","dat","met","voor","zijn","was","werd","over"].includes(w));
  const isNearDuplicate = item => {
    const incoming = new Set(normalize(item.title));
    if (!incoming.size) return false;
    return existing.some(old => {
      const oldUrl = old?.source?.url;
      if (oldUrl && oldUrl === item.link) return true;
      const oldTitle = new Set(normalize(old?.source?.title || old?.headline));
      if (!oldTitle.size) return false;
      const overlap = [...incoming].filter(word => oldTitle.has(word)).length / Math.min(incoming.size, oldTitle.size);
      return overlap >= 0.6;
    });
  };
  let saved = 0;
  for (const item of candidates.slice(0, 10)) {
    if (isNearDuplicate(item)) {
      console.log("Waarschijnlijk dubbel nieuws overgeslagen:", item.title);
      continue;
    }
    const requestDraft = () => fetch(API_URL + "/draft", {
      method: "POST",
      headers: { "Authorization": "Bearer " + HUB_API_SECRET, "Content-Type": "application/json" },
      body: JSON.stringify({
        topic: item.title,
        category: "Voetbal",
        facts: [
          "Bronkop: " + item.title,
          "Bronbeschrijving (maximaal 800 tekens): " + (item.description || "De feed bevat geen beschrijving; schrijf voorzichtig en vermeld de beperkte broninformatie.").slice(0, 800)
        ],
        sourceUrls: [item.link, item.feed]
      }),
      signal: AbortSignal.timeout(45000)
    });
    let r, data;
    for (let attempt = 0; attempt < 3; attempt++) {
      r = await requestDraft();
      data = await r.json();
      if (r.ok) break;
      const detail = String(data.detail || data.error || "");
      const rateLimited = (r.status === 429 || r.status === 502 || r.status === 503) && /rate.?limit|tokens per minute|try again in/i.test(detail);
      console.log("Concept maken mislukt:", r.status, JSON.stringify(data));
      if (!rateLimited || attempt === 2) {
        if (r.status === 502 || r.status === 503 || r.status === 429) throw new Error(detail || data.error || "AI-service fout");
        break;
      }
      const waitMatch = detail.match(/try again in ([0-9.]+)s/i);
      const waitMs = Math.max(5000, Math.ceil((waitMatch ? Number(waitMatch[1]) : 15) * 1000) + 1500);
      console.log("AI-tokenlimiet bereikt; wacht " + Math.ceil(waitMs / 1000) + " seconden en probeer opnieuw.");
      await new Promise(resolve => setTimeout(resolve, waitMs));
    }
    if (!r.ok) continue;
    let draft = data.draft;
    // Reject obvious English headlines instead of allowing them into the editorial inbox.
    const looksEnglish = headline => /\\b(happy|unsure|after|before|could|would|should|taken|hospital|collapsing|training|deal|transfer|manager|says|said|but|over|January|February|March|April|May|June|July|August|September|October|November|December)\\b/i.test(String(headline || ""));
    if (looksEnglish(draft.headline)) {
      console.log("Engelse kop afgekeurd; één vertaalpoging:", draft.headline);
      const retry = await fetch(API_URL + "/draft", {
        method: "POST",
        headers: { "Authorization": "Bearer " + HUB_API_SECRET, "Content-Type": "application/json" },
        body: JSON.stringify({
          topic: "SCHRIJF DEZE KOP IN NATUURLIJK NEDERLANDS: " + item.title,
          category: "Voetbal",
          facts: [
            "Verplichte instructie: de uiteindelijke headline moet volledig Nederlands zijn; vertaal de bronkop en laat hem niet Engels staan.",
            "Bronkop: " + item.title,
            "Bronbeschrijving (maximaal 800 tekens): " + (item.description || "De feed bevat geen beschrijving; schrijf voorzichtig en vermeld de beperkte broninformatie.").slice(0, 800)
          ],
          sourceUrls: [item.link, item.feed]
        }),
        signal: AbortSignal.timeout(45000)
      });
      const retryData = await retry.json();
      if (retry.ok && retryData.draft && !looksEnglish(retryData.draft.headline)) {
        draft = retryData.draft;
      } else {
        console.log("Kop blijft Engels of vertaling mislukte; concept niet opgeslagen:", retryData.draft?.headline || retryData.error || "onbekende fout");
        continue;
      }
    }
    const save = await fetch(API_URL + "/auto-inbox", {
      method: "POST",
      headers: { "Authorization": "Bearer " + HUB_API_SECRET, "Content-Type": "application/json" },
      body: JSON.stringify({ item: {
        headline: draft.headline || item.title,
        standfirst: String(draft.standfirst || "").slice(0, 320),
        body: Array.isArray(draft.body) ? draft.body.slice(0, 2).map(p => String(p).slice(0, 700)) : [],
        why_it_matters: draft.why_it_matters || "",
        verification_notes: "RSS-CONTROLE, GEEN ONAFHANKELIJKE FACTCHECK: alleen de aangeleverde RSS-kop en -beschrijving zijn verwerkt. Controleer uitslag, doelpuntenmakers, statistieken, reeksen, ranglijst en overige concrete claims rechtstreeks bij betrouwbare bronnen vóór publicatie. " + String(draft.verification_notes || "").slice(0, 1200),
        verification_status: "needs_review",
        claims: Array.isArray(draft.claims) ? draft.claims.slice(0, 20).map(c => ({
          claim: String(c?.claim || "").slice(0, 500),
          evidence: String(c?.evidence || "Niet aangetoond in aangeleverde RSS-gegevens").slice(0, 800),
          status: c?.status === "supported_by_feed" ? "supported_by_feed" : "unverified"
        })).filter(c => c.claim) : [],
        claimsReviewRequired: true,
        editorialReviewRequired: true,
        autoPublish: false,
        sourceEvidence: {
          title: item.title,
          description: item.description || "",
          feed: item.feed,
          publishedAt: item.date || null,
          evidenceLevel: item.description ? "rss_title_and_description_only" : "rss_title_only"
        },
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
