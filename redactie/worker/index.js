export default {
 async scheduled(controller, env, ctx) {
  // Configure a Cloudflare Cron Trigger (for example every 15 minutes) after deployment.
  ctx.waitUntil(inbox(env));
 },
 async fetch(request, env) {
  const origin = request.headers.get("Origin");
  const allowed = allowedOrigin(origin, env);
  if (request.method === "OPTIONS") {
   if (!allowed) return reply({error:"Origin niet toegestaan."},403);
   return new Response(null,{status:204,headers:corsHeaders(allowed)});
  }
  const response = await handle(request, env);
  if (!origin) return response;
  if (!allowed) return response;
  const headers = new Headers(response.headers);
  for (const [key,value] of Object.entries(corsHeaders(allowed))) headers.set(key,value);
  return new Response(response.body,{status:response.status,statusText:response.statusText,headers});
 }
};
async function handle(request, env) {
  const url = new URL(request.url);
  if (url.pathname === "/health" && request.method === "GET") return reply({ok:true,service:"VoetbalHub Redactie API",publishing:false,features:["drafts","feed-inbox","articles-api"]});
  if (url.pathname === "/articles" && request.method === "GET") return await listArticles(env);
  if (url.pathname === "/inbox" && request.method === "GET") {
    if (!env.HUB_API_SECRET || request.headers.get("Authorization") !== `Bearer ${env.HUB_API_SECRET}`) return reply({error:"Niet geautoriseerd."},401);
    return await listInbox(env);
  }
  if (request.method !== "POST") return reply({error:"Gebruik GET /articles, GET/POST /inbox, POST /draft of POST /publish."},404);
  if (!env.HUB_API_SECRET || request.headers.get("Authorization") !== `Bearer ${env.HUB_API_SECRET}`) return reply({error:"Niet geautoriseerd."},401);
  if (url.pathname === "/inbox") return await inbox(env);
  if (url.pathname === "/publish") return await publish(request,env);
  if (url.pathname !== "/draft") return reply({error:"Onbekend endpoint."},404);
  let x; try { x=await request.json(); } catch { return reply({error:"Ongeldige JSON."},400); }
  const topic=str(x.topic,300),category=str(x.category||"Voetbal",80),facts=Array.isArray(x.facts)?x.facts.map(v=>str(v,500)).filter(Boolean).slice(0,20):[],sourceUrls=Array.isArray(x.sourceUrls)?x.sourceUrls.map(v=>str(v,500)).filter(v=>/^https:\/\//i.test(v)).slice(0,10):[],format=["nieuws","analyse","achtergrond","transfer","wedstrijdverslag"].includes(x.format)?x.format:"nieuws";
  if(!topic||facts.length<2)return reply({error:"Onderwerp en minimaal twee gecontroleerde feiten vereist."},400);
  if(!env.OPENAI_API_KEY)return reply({error:"OPENAI_API_KEY ontbreekt."},500);
  const instructions="Je schrijft originele Nederlandstalige voetbaljournalistiek voor VoetbalHub. Gebruik een eigen, energieke en feitelijke toon; imiteer geen bestaand medium of journalist. Kopieer geen bronzinnen. Gebruik uitsluitend de aangeleverde feiten. Verzin geen citaten, namen, cijfers, datums of gebeurtenissen. Maak onzekerheid expliciet en presenteer geruchten niet als feiten. Retourneer JSON met headline, standfirst, body (array van 3-5 inhoudelijke alinea's, elk minimaal 70 tekens), why_it_matters, verification_notes en sources. Als de aangeleverde feiten onvoldoende zijn, verzin of herhaal niets om de lengte te halen. Auteur: VoetbalHub Redactie. Dit is altijd een concept voor menselijke controle, nooit een definitieve publicatie.";
  let response,data;
  try { response=await fetch("https://api.openai.com/v1/responses",{method:"POST",headers:{Authorization:`Bearer ${env.OPENAI_API_KEY}`,"Content-Type":"application/json"},body:JSON.stringify({model:env.OPENAI_MODEL||"gpt-4.1-mini",instructions,input:JSON.stringify({topic,category,format,verified_facts:facts,source_urls:sourceUrls}),text:{format:{type:"json_object"}}}),signal:AbortSignal.timeout(30000)}); data=await response.json(); }
  catch { return reply({error:"AI-dienst tijdelijk niet bereikbaar."},502); }
  if(!response.ok)return reply({error:"AI-dienstfout",detail:data.error?.message||"Onbekende fout"},502);
  const out=(data.output||[]).flatMap(v=>v.content||[]).filter(v=>v.type==="output_text").map(v=>v.text).join("\n");
  try { const draft=JSON.parse(out); const paragraphs=Array.isArray(draft.body)?draft.body.filter(v=>typeof v==="string").map(v=>v.trim()).filter(Boolean):[]; if(typeof draft.headline!=="string"||!draft.headline.trim()||typeof draft.standfirst!=="string"||!draft.standfirst.trim())throw new Error("invalid"); if(paragraphs.length<3||paragraphs.length>5||paragraphs.some(p=>p.length<70))return reply({error:"AI-concept voldoet niet aan de kwaliteitsnorm.",detail:"Er zijn 3-5 inhoudelijke alinea's van minimaal 70 tekens nodig; er wordt niets opgevuld of gepubliceerd."},502); draft.body=paragraphs; return reply({status:"draft_for_review",author:"VoetbalHub Redactie",category,format,publishingEnabled:false,editorialReviewRequired:true,draft}); }
  catch { return reply({error:"Ongeldige AI-output"},502); }
 }
async function listInbox(env) {
 if(!env.EDITORIAL_KV)return reply({error:"EDITORIAL_KV ontbreekt."},503);
 try {
  const listed=await env.EDITORIAL_KV.list({prefix:"inbox:",limit:30});
  const keys=listed.keys.sort((a,b)=>b.name.localeCompare(a.name));
  const items=[];
  for(const key of keys){const raw=await env.EDITORIAL_KV.get(key.name);if(raw){try{const batch=JSON.parse(raw);if(Array.isArray(batch))items.push(...batch);}catch{}}}
  const unique=[...new Map(items.map(i=>[(i.link||i.title||"").toLowerCase(),i])).values()];
  return reply({count:unique.length,items:unique.slice(0,200),status:"stored_inbox",autoPublish:false,warning:"Opgeslagen nieuwsleads zijn aanwijzingen en moeten door een redacteur worden gecontroleerd."});
 } catch {return reply({error:"Opgeslagen nieuwsleads konden niet worden opgehaald."},503);}
}
async function listArticles(env) {
 if(!env.EDITORIAL_KV)return reply({error:"EDITORIAL_KV ontbreekt."},503);
 try {
  const listed=await env.EDITORIAL_KV.list({prefix:"article:",limit:100});
  const articles=[];
  for(const key of listed.keys){const raw=await env.EDITORIAL_KV.get(key.name);if(raw){try{const a=JSON.parse(raw);if(a.status==="published")articles.push(a);}catch{}}}
  articles.sort((a,b)=>(b.publishedAt||"").localeCompare(a.publishedAt||""));
  return reply({count:articles.length,articles});
 } catch {return reply({error:"Artikelen konden niet worden opgehaald."},503);}
}
async function publish(request,env) {
 if(!env.EDITORIAL_KV)return reply({error:"EDITORIAL_KV ontbreekt; publicatieopslag is niet ingesteld."},503);
 let x;try{x=await request.json();}catch{return reply({error:"Ongeldige JSON."},400);}
 const d=x.draft||{},facts=Array.isArray(x.verifiedFacts)?x.verifiedFacts.map(v=>str(v,500)).filter(Boolean):[],sources=Array.isArray(x.sources)?x.sources.filter(s=>s&&/^https:\/\//i.test(str(s.url,500))).slice(0,10):[];
 if(x.approved!==true)return reply({error:"Publicatie vereist expliciete goedkeuring: approved moet true zijn."},400);
 const articleBody=Array.isArray(d.body)?d.body.filter(v=>typeof v==="string").map(v=>str(v,2500)).filter(Boolean).slice(0,5):[];
 if(!str(d.headline,200)||!str(d.standfirst,500)||articleBody.length<3||articleBody.some(v=>v.length<70))return reply({error:"Publicatie geblokkeerd: kop, intro en 3-5 inhoudelijke alinea's van minimaal 70 tekens zijn verplicht."},400);
 if(facts.length<2||sources.length<1)return reply({error:"Minimaal twee gecontroleerde feiten en één https-bron zijn vereist."},400);
 const imageUrl=str(d.imageUrl,1000),imageSource=str(d.imageSource,300),imageCredit=str(d.imageCredit,200),imageRights=str(d.imageRights,20);
 if(imageUrl && (!/^https:\/\//i.test(imageUrl) || !["cleared","licensed"].includes(imageRights) || !imageSource || !imageCredit)) return reply({error:"Een foto vereist een HTTPS-URL, bron, naamsvermelding en bevestigde rechten (cleared/licensed)."},400);
 if(!imageUrl && imageRights && !["not_needed","pending","rejected"].includes(imageRights)) return reply({error:"Beeldrechtenstatus zonder foto is ongeldig."},400);
 const id=crypto.randomUUID(),now=new Date().toISOString();
 const article={id,status:"published",author:"VoetbalHub Redactie",headline:str(d.headline,200),standfirst:str(d.standfirst,500),body:articleBody,why_it_matters:str(d.why_it_matters,1000),category:str(x.category||"Voetbal",80),publishedAt:now,updatedAt:now,verifiedFacts:facts,sources:sources.map(s=>({name:str(s.name,120),url:str(s.url,500)})),...(imageUrl?{imageUrl,imageSource,imageCredit,imageRights}:{imageRights:imageRights||"not_needed"})};
 try{await env.EDITORIAL_KV.put("article:"+id,JSON.stringify(article));return reply({status:"published",article});}
 catch{return reply({error:"Artikel kon niet worden opgeslagen."},503);}
}
async function inbox(env) {
 if(!env.ALLOWED_FEED_URLS)return reply({error:"ALLOWED_FEED_URLS ontbreekt. Voeg alleen feeds toe waarvan gebruik is toegestaan."},400);
 const urls=env.ALLOWED_FEED_URLS.split(",").map(s=>s.trim()).filter(Boolean).slice(0,10),items=[];
 for(const raw of urls){let u;try{u=new URL(raw)}catch{continue;}if(u.protocol!=="https:")continue;
  try{const r=await fetch(u.toString(),{headers:{"User-Agent":"VoetbalHubEditorialBot/0.2"},"redirect":"manual",signal:AbortSignal.timeout(8000)});if(!r.ok||r.status>=300)continue;
   const xml=(await r.text()).slice(0,1000000),blocks=[...xml.matchAll(/<(item|entry)\b[\s\S]*?<\/\1\s*>/gi)].slice(0,30);
   for(const m of blocks){const b=m[0],title=tag(b,"title"),link=tag(b,"link")||attr(b,"link","href"),description=strip(tag(b,"description")||tag(b,"summary")||tag(b,"content"));if(!title)continue;items.push({title,link:validUrl(link,u.origin),summary:description.slice(0,500),feedHost:u.hostname,status:"needs_editor_review",note:"Alleen redactionele aanwijzing; geen automatische feitelijke bevestiging."});}
  }catch{}
 }
 const unique=[...new Map(items.map(i=>[(i.link||i.title).toLowerCase(),i])).values()].slice(0,100);
 if(env.EDITORIAL_KV){try{await env.EDITORIAL_KV.put("inbox:"+new Date().toISOString().slice(0,10),JSON.stringify(unique),{expirationTtl:1209600});}catch{return reply({error:"Inbox opgehaald maar opslag mislukt.",count:unique.length,items:unique,stored:false,autoPublish:false},503);}}
 return reply({status:"inbox_ready_for_review",count:unique.length,items:unique,stored:!!env.EDITORIAL_KV,autoPublish:false,warning:"Feeds worden alleen verwerkt als gebruiksvoorwaarden dit toestaan. Items zijn leads, geen geverifieerde feiten."});
}
function tag(s,name){const m=s.match(new RegExp("<"+name+"\\b[^>]*>([\\s\\S]*?)</"+name+"\\s*>","i"));return m?decode(m[1].replace(/<[^>]+>/g," ")).trim():"";}
function attr(s,name,key){const re=new RegExp("<"+name+"\\b[^>]*\\b"+key+"=[\"']([^\"']+)[\"'][^>]*>","i"),m=s.match(re);return m?m[1]:"";}
function strip(s){return decode(s.replace(/<!\[CDATA\[|\]\]>/g,"").replace(/<[^>]+>/g," ")).replace(/\s+/g," ").trim();}
function decode(s){return s.replace(/&amp;/g,"&").replace(/&lt;/g,"<").replace(/&gt;/g,">").replace(/&quot;/g,'"').replace(/&#39;|&apos;/g,"'").replace(/&#(\d+);/g,(_,n)=>String.fromCodePoint(Number(n)));}
function validUrl(s,base){try{const u=new URL(s,base);return u.protocol==="https:"?u.toString():"";}catch{return "";}}
function str(v,n){return typeof v==="string"?v.trim().slice(0,n):"";}
function reply(data,status=200){return new Response(JSON.stringify(data,null,2),{status,headers:{"Content-Type":"application/json; charset=utf-8","Cache-Control":"no-store"}});}

function allowedOrigin(origin, env) {
 if (!origin || !env.ALLOWED_ORIGINS) return "";
 const allowed = env.ALLOWED_ORIGINS.split(",").map(v=>v.trim()).filter(Boolean);
 return allowed.includes(origin) ? origin : "";
}
function corsHeaders(origin) {
 return {
  "Access-Control-Allow-Origin":origin,
  "Vary":"Origin",
  "Access-Control-Allow-Methods":"GET, POST, OPTIONS",
  "Access-Control-Allow-Headers":"Authorization, Content-Type",
  "Access-Control-Max-Age":"86400"
 };
}
