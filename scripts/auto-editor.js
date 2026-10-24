const GROQ_API_KEY = process.env.GROQ_API_KEY || "";
const HUB_API_SECRET = process.env.HUB_API_SECRET || "";
const API_URL = process.env.VOETBALHUB_API_URL || "https://voetbalhub-redactie.onrender.com";
const MODEL = process.env.GROQ_MODEL || "openai/gpt-oss-120b";
const FEEDS = [
  // Nederlandse voetbalbronnen: geen automatische ingestroom van Engelstalige buitenlandse media.
  "https://feeds.nos.nl/nosvoetbal",
  "https://www.voetbalprimeur.nl/feed/news.xml"
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

async function fetchArticleText(articleUrl) {
  try {
    const parsed = new URL(articleUrl);
    const allowedArticleHosts = new Set(["nos.nl", "www.nos.nl", "voetbalprimeur.nl", "www.voetbalprimeur.nl"]);
    if (parsed.protocol !== "https:" || !allowedArticleHosts.has(parsed.hostname.toLowerCase())) return "";
    const response = await fetch(parsed.href, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; VoetbalHubEditorialBot/1.0)", "Accept": "text/html" },
      signal: AbortSignal.timeout(12000)
    });
    if (!response.ok) { console.log("Artikeltekst niet beschikbaar:", response.status, parsed.hostname); return ""; }
    const html = (await response.text()).slice(0, 2_000_000);
    const strip = value => value
      .replace(/<(script|style|nav|header|footer|aside|noscript|svg|form)[^>]*>[\s\S]*?<\/\1>/gi, " ")
      .replace(/<br\s*\/?\s*>|<\/(p|div|article|section|h[1-6]|li)>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/&nbsp;|&#160;/gi, " ")
      .replace(/&amp;/gi, "&").replace(/&quot;/gi, '"')
      .replace(/&#39;|&apos;/gi, "'").replace(/&lt;/gi, "<").replace(/&gt;/gi, ">")
      .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
      .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
      .replace(/\s+/g, " ").trim();
    const articleBlocks = [
      ...html.matchAll(/<article\b[^>]*>([\s\S]*?)<\/article>/gi),
      ...html.matchAll(/<main\b[^>]*>([\s\S]*?)<\/main>/gi)
    ].map(match => match[1]).sort((a, b) => b.length - a.length);
    // Never treat a whole page as article text: cookie banners, menus, and consent
    // screens can be long enough to pass a simple character-count check.
    if (!articleBlocks.length) {
      console.log("Artikeltekst overgeslagen: geen <article> of <main>-blok gevonden.");
      return "";
    }
    const block = articleBlocks[0];
    const text = strip(block);
    const paragraphs = [...block.matchAll(/<p\b[^>]*>([\s\S]*?)<\/p>/gi)]
      .map(match => strip(match[1]))
      .filter(paragraph => paragraph.length >= 35);
    const meaningfulText = paragraphs.join(" ");
    const boilerplate = /accept all cookies|cookie preferences|privacy settings|subscribe to read|enable javascript|accepteer alle cookies|cookievoorkeuren|privacy-instellingen/i;
    if (text.length < 250 || paragraphs.length < 2 || boilerplate.test(text.slice(0, 700))) {
      console.log("Artikeltekst overgeslagen: te weinig inhoudelijke alinea's of consent-/betaalmuurtekst.");
      return "";
    }
    return (meaningfulText.length >= 250 ? meaningfulText : text).slice(0, 12000);
  } catch (error) {
    console.log("Artikeltekst ophalen mislukt:", error.message);
    return "";
  }
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
  // Alleen toegestane Nederlandstalige redacties.
  const allowedHosts = new Set(["feeds.nos.nl", "nos.nl", "www.nos.nl", "voetbalprimeur.nl", "www.voetbalprimeur.nl"]);
  for (const url of FEEDS) {
    const feedHost = new URL(url).hostname.toLowerCase();
    if (!allowedHosts.has(feedHost)) { console.log("Niet-toegestane bron overgeslagen:", url); continue; }
    try {
      const r = await fetch(url, { headers: { "User-Agent": "VoetbalHubEditorialBot/1.0" }, signal: AbortSignal.timeout(12000) });
      if (!r.ok) { console.log("Feed overgeslagen:", url, r.status); continue; }
      for (const item of extractItems(await r.text()).slice(0, 10)) candidates.push({ ...item, feed: url });
    } catch (e) { console.log("Feedfout:", url, e.message); }
  }
  candidates.sort((a,b) => (Date.parse(b.date || "") || 0) - (Date.parse(a.date || "") || 0));
  if (!candidates.length) throw new Error("Geen nieuwsitems gevonden in de beschikbare RSS-feeds.");

  // Houd de automatische desk actueel: oude RSS-items zijn geen verse nieuwsconcepten.
  const now = Date.now();
  const freshCandidates = candidates.filter(item => {
    const published = Date.parse(item.date || "");
    if (!Number.isFinite(published)) return true; // Geen datum? Laat de bestaande bron- en duplicaatcontroles beslissen.
    const ageHours = (now - published) / 3600000;
    if (ageHours > 36) {
      console.log("Verouderd RSS-item overgeslagen (" + Math.round(ageHours) + " uur oud):", item.title);
      return false;
    }
    return true;
  });
  candidates.splice(0, candidates.length, ...freshCandidates);
  if (!candidates.length) {
    console.log("Geen verse RSS-items binnen 36 uur gevonden; er wordt geen oud nieuws als nieuw concept toegevoegd.");
    return;
  }

  // Haal bestaande concepten op zodat hetzelfde nieuws niet opnieuw verschijnt via een andere feed.
  let existing = [];
  try {
    const inboxResponse = await fetch(API_URL + "/inbox", {
      headers: { "Authorization": "Bearer " + HUB_API_SECRET },
      signal: AbortSignal.timeout(30000)
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
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9 ]/g, " ").split(/\s+/)
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
  for (const item of candidates.slice(0, 20)) {
    // Nederlandse feeds kunnen soms toch een Engelstalige kop bevatten; zulke items worden uitgesloten.
    const title = String(item.title || "");
    const englishPhrases = /\\b(happy at|unsure about|according to|the club|is taken to|was taken to|could be|will be|he said|she said|they said|after collapsing|over the summer|in difficult position|lay down marker|promotion favourites|transfer gossip)\\b/i;
    const englishWords = new Set(["the","and","but","for","with","from","after","before","when","while","they","their","them","his","her","she","he","has","have","had","will","would","could","should","might","says","said","into","over","under","about","this","that","these","those","who","what","where","which","because","than","then","also","both","team","club","manager","football","hospital","training","january","february","march","april","june","july","august","september","october","december"]);
    const titleWords = title.match(/[A-Za-zÀ-ÿ]+/g) || [];
    const englishHits = titleWords.filter(word => englishWords.has(word.toLowerCase())).length;
    if (englishPhrases.test(title) || (titleWords.length >= 7 && englishHits >= 3 && englishHits / titleWords.length >= 0.3)) {
      console.log("Engelstalige kop geweerd:", title);
      continue;
    }
    // Roundups en koppen die expliciet twee losse onderwerpen mengen zijn ongeschikt als één nieuwsartikel.
    const mixedTopicSignals = [
      /\bplus\b.*\bquiz/i,
      /\bTrump\b.*\bNFL\b|\bNFL\b.*\bTrump\b/i,
      /\bSaturday'?s gossip\b/i,
      /\btransfer gossip\b/i,
      /\bplus more\b/i,
      /,\s*plus\s+(more|other|today)/i,
      /\b(?:and|;|–|—)\s*(?:Trump|NFL|quiz(?:zes)?|gossip)\b/i
    ];
    if (mixedTopicSignals.some(pattern => pattern.test(title))) {
      console.log("Meerdere onderwerpen/roundup in bronkop; niet als één artikel verwerkt:", title);
      continue;
    }
    if (isNearDuplicate(item)) {
      console.log("Waarschijnlijk dubbel nieuws overgeslagen:", item.title);
      continue;
    }
    // Maak alleen een artikelconcept als de oorspronkelijke pagina voldoende artikeltekst oplevert.
    // RSS-koppen/beschrijvingen blijven bronmeldingen, geen nep-artikelconcepten.
    const articleText = await fetchArticleText(item.link);
    if (!articleText || articleText.length < 250) {
      console.log("Geen bruikbare volledige artikeltekst; alleen RSS is beschikbaar, dus niet als artikelconcept opgeslagen:", item.title);
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
          "Opgehaalde tekst van de oorspronkelijke artikelpagina (gebruik uitsluitend controleerbare feiten hieruit): " + articleText,
          "Huisstijl VoetbalHub: nuchter, helder, direct en compact Nederlands; actieve zinnen, geen sensatie en geen herhaling.",
          "Auteursrechtelijke zorgvuldigheid: schrijf zelfstandig vanuit de noodzakelijke feiten; kopieer geen zinnen, herkenbare formuleringen, volgorde of structuur van de bron en vertaal niet zin voor zin. Gebruik geen onnodige citaten of creatieve bronpassages.",
          "Juridische zorgvuldigheid: voeg geen onbewezen claims toe, maak geen ongefundeerde beschuldigingen en wek niet de indruk dat feiten onafhankelijk zijn geverifieerd. Bronvermelding is geen juridische garantie.",
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
    const looksEnglish = headline => /\b(happy|unsure|after|before|could|would|should|taken|hospital|collapsing|training|deal|transfer|says|said|but|January|February|March|April|May|June|July|August|September|October|November|December|best team|lay down marker|could define|may reconsider|unsure about)\b/i.test(String(headline || ""));
    const containsEnglishPhrasing = value => /\b(happy at|unsure about|according to|the club|is taken to|was taken to|could be|will be|he said|she said|they said|after collapsing|over the summer|in difficult position|a new chapter|his journey took|to go top of|lay down marker|promotion favourites|both need a victory|test your .* knowledge|plus more|have doubts on making|making another new start)\b/i.test(String(value || ""));
    const englishFunctionWords = new Set(["the","and","but","for","with","from","after","before","when","while","they","their","them","his","her","she","he","has","have","had","will","would","could","should","might","may","says","said","into","over","under","about","this","that","these","those","who","what","where","which","because","than","then","also","both","not","new","old","first","second","team","club","manager","football","hospital","training","january","february","march","april","june","july","august","september","october","december"]);
    const hasEnglishDensity = value => {
      const words = String(value || "").match(/[A-Za-zÀ-ÿ]+/g) || [];
      if (words.length < 10) return false;
      const hits = words.filter(word => englishFunctionWords.has(word.toLowerCase())).length;
      return hits >= 4 && hits / words.length >= 0.22;
    };
    const draftHasEnglish = candidate => looksEnglish(candidate?.headline) ||
      containsEnglishPhrasing(candidate?.standfirst) || hasEnglishDensity(candidate?.standfirst) ||
      (Array.isArray(candidate?.body) && candidate.body.some(p => containsEnglishPhrasing(p) || hasEnglishDensity(p)));
    if (draftHasEnglish(draft)) {
      console.log("Engelse kop of Engelse formulering afgekeurd; één Nederlandstalige herstelpoging:", draft.headline);
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
      if (retry.ok && retryData.draft && !draftHasEnglish(retryData.draft)) {
        draft = retryData.draft;
      } else {
        console.log("Engelse kop/formulering bleef staan of vertaling mislukte; concept niet opgeslagen:", retryData.draft?.headline || retryData.error || "onbekende fout");
        continue;
      }
    }
    // Redactionele kwaliteitscontrole: korte kop, compacte tekst en geen vrijwel identieke alinea's.
    const wordCount = value => String(value || "").trim().split(/\s+/).filter(Boolean).length;
    const normalizedText = value => String(value || "").toLowerCase()
      .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();
    const qualityIssues = candidate => {
      const issues = [];
      const headline = String(candidate?.headline || "").trim();
      const standfirst = String(candidate?.standfirst || "").trim();
      const paragraphs = Array.isArray(candidate?.body) ? candidate.body.map(p => String(p || "").trim()).filter(Boolean) : [];
      if (wordCount(headline) < 5 || wordCount(headline) > 14) issues.push("kop moet 5 tot 14 woorden bevatten");
      if (!standfirst || wordCount(standfirst) > 25) issues.push("intro moet aanwezig zijn en maximaal 25 woorden bevatten");
      if (!paragraphs.length || paragraphs.length > 2) issues.push("tekst moet uit één of twee alinea's bestaan");
      if (paragraphs.some(p => wordCount(p) > 60)) issues.push("elke alinea mag maximaal 60 woorden bevatten");
      const blocks = [headline, standfirst, ...paragraphs].map(normalizedText).filter(Boolean);
      for (let i = 0; i < blocks.length; i++) {
        for (let j = i + 1; j < blocks.length; j++) {
          const a = blocks[i], b = blocks[j];
          const shorter = a.length <= b.length ? a : b;
          const longer = a.length <= b.length ? b : a;
          if (shorter.length >= 45 && longer.includes(shorter)) {
            issues.push("kop, intro en tekst herhalen vrijwel dezelfde zin");
            return issues;
          }
          const aw = new Set(a.split(" ").filter(w => w.length > 3));
          const bw = new Set(b.split(" ").filter(w => w.length > 3));
          const smaller = Math.min(aw.size, bw.size);
          const overlap = smaller ? [...aw].filter(w => bw.has(w)).length / smaller : 0;
          if (smaller >= 5 && overlap >= 0.68) {
            issues.push("kop, intro en tekst bevatten te veel dezelfde woorden (overlap " + Math.round(overlap * 100) + "%)");
            return issues;
          }
        }
      }
      const whole = [headline, standfirst, ...paragraphs].join(" ");
      if (/\b(volgens bronnen|naar verluidt|het is duidelijk dat|zoals eerder vermeld)\b/i.test(whole)) issues.push("vermijd vage of opvullende formuleringen");
      return issues;
    };
    let issues = qualityIssues(draft);
    if (issues.length) {
      console.log("Concept haalt kwaliteitscontrole niet; één herstelpoging:", issues.join("; "));
      const repair = await fetch(API_URL + "/draft", {
        method: "POST",
        headers: { "Authorization": "Bearer " + HUB_API_SECRET, "Content-Type": "application/json" },
        body: JSON.stringify({
          topic: "HERSCHRIJF ALS KORTE, STRAKKE NEDERLANDSE VOETBALNIEUWSBERICHTGEVING: " + item.title,
          category: "Voetbal",
          facts: [
            "Strikte vormregels: kop 5-14 woorden; intro maximaal 25 woorden; één of twee tekstalinea's, maximaal 60 woorden per alinea.",
            "Geen herhaling: de intro mag de kop niet herhalen en de alinea's mogen de intro niet opnieuw formuleren.",
            "Gebruik uitsluitend feiten uit de bronkop en bronbeschrijving. Voeg geen namen, citaten, scores, blessures, data of details toe die niet expliciet in de bron staan.",
            "Problemen die moeten worden opgelost: " + issues.join("; "),
            "Bronkop: " + item.title,
            "Bronbeschrijving (maximaal 800 tekens): " + (item.description || "De feed bevat geen beschrijving; schrijf voorzichtig en vermeld de beperkte broninformatie.").slice(0, 800)
          ],
          sourceUrls: [item.link, item.feed]
        }),
        signal: AbortSignal.timeout(45000)
      });
      let repairData = {};
      try { repairData = await repair.json(); } catch {}
      if (repair.ok && repairData.draft && !draftHasEnglish(repairData.draft) && qualityIssues(repairData.draft).length === 0) {
        draft = repairData.draft;
        console.log("Hersteld concept haalt kwaliteitscontrole:", draft.headline);
      } else {
        console.log("Concept afgekeurd na herstelpoging; niet opgeslagen:", JSON.stringify(qualityIssues(repairData.draft || draft)));
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
          content: articleText,
          evidenceLevel: "article_text_extracted"
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
