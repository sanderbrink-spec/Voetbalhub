export default {
 async fetch(request, env) {
  const url=new URL(request.url);
  if(url.pathname==="/health"&&request.method==="GET") return reply({ok:true,service:"VoetbalHub Redactie API",publishing:false,features:["drafts","feed-inbox"]});
  if(request.method!=="POST") return reply({error:"Gebruik POST /draft of POST /inbox."},404);
  if(!env.HUB_API_SECRET||request.headers.get("Authorization")!==`Bearer ${env.HUB_API_SECRET}`) return reply({error:"Niet geautoriseerd."},401);
  if(url.pathname==="/inbox") return await inbox(env);
  if(url.pathname!=="/draft") return reply({error:"Onbekend endpoint."},404);
  let x; try{x=await request.json()}catch{return reply({error:"Ongeldige JSON."},400)}
  const topic=str(x.topic,300),category=str(x.category||"Voetbal",80),facts=Array.isArray(x.facts)?x.facts.map(v=>str(v,500)).filter(Boolean).slice(0,20):[],sourceUrls=Array.isArray(x.sourceUrls)?x.sourceUrls.map(v=>str(v,500)).filter(v=>/^https?:\\/\\//i.test(v)).slice(0,10):[],format=["nieuws","analyse","achtergrond","transfer","wedstrijdverslag"].includes(x.format)?x.format:"nieuws";
  if(!topic||facts.length<2)return reply({error:"Onderwerp en minimaal twee gecontroleerde feiten vereist."},400);
  if(!env.OPENAI_API_KEY)return reply({error:"OPENAI_API_KEY ontbreekt."},500);
  const instructions="Je schrijft originele Nederlandstalige voetbaljournalistiek voor VoetbalHub. Gebruik een eigen, energieke en feitelijke toon; imiteer geen bestaand medium of journalist. Kopieer geen bronzinnen. Gebruik uitsluitend de aangeleverde feiten. Verzin geen citaten, namen, cijfers, datums of gebeurtenissen. Maak onzekerheid expliciet en presenteer geruchten niet als feiten. Retourneer JSON met headline, standfirst, body (array van 3-6 alinea's), why_it_matters, verification_notes en sources. Auteur: VoetbalHub Redactie. Dit is altijd een concept voor menselijke controle, nooit een definitieve publicatie.";
  const r=await fetch("https://api.openai.com/v1/responses",{method:"POST",headers:{Authorization:`Bearer ${env.OPENAI_API_KEY}`,"Content-Type":"application/json"},body:JSON.stringify({model:env.OPENAI_MODEL||"gpt-4.1-mini",instructions,input:JSON.stringify({topic,category,format,verified_facts:facts,source_urls:sourceUrls}),text:{format:{type:"json_object"}}})});
  const data=await r.json();if(!r.ok)return reply({error:"AI-dienstfout",detail:data.error?.message||"Onbekende fout"},502);
  const out=(data.output||[]).flatMap(v=>v.content||[]).filter(v=>v.type==="output_text").map(v=>v.text).join("\\n");
  try{return reply({status:"draft_for_review",author:"VoetbalHub Redactie",category,format,publishingEnabled:false,editorialReviewRequired:true,draft:JSON.parse(out)})}catch{return reply({error:"Ongeldige AI-output"},502)}
 }
};
async function inbox(env){
 if(!env.ALLOWED_FEED_URLS)return reply({error:"ALLOWED_FEED_URLS ontbreekt. Voeg alleen feeds toe waarvan gebruik is toegestaan."},400);
 const urls=env.ALLOWED_FEED_URLS.split(",").map(s=>s.trim()).filter(Boolean).slice(0,10),items=[];
 for(const raw of urls){
  let u;try{u=new URL(raw)}catch{continue}
  if(u.protocol!=="https:")continue;
  try{
   const r=await fetch(u.toString(),{headers:{"User-Agent":"VoetbalHubEditorialBot/0.1 (feed reader)"},signal:AbortSignal.timeout(8000)});
   if(!r.ok)continue;
   const xml=(await r.text()).slice(0,1000000);
   const blocks=[...xml.matchAll(/<(item|entry)\\b[\\s\\S]*?<\\/\\1>/gi)].slice(0,30);
   for(const m of blocks){
    const b=m[0],title=tag(b,"title"),link=tag(b,"link")||attr(b,"link","href"),description=strip(tag(b,"description")||tag(b,"summary")||tag(b,"content"));
    if(!title)continue;
    items.push({title,link:validUrl(link,u.origin),summary:description.slice(0,500),feedHost:u.hostname,status:"needs_editor_review",note:"Kop alleen gebruiken als redactionele aanwijzing; niet als automatisch artikel of feitelijke bevestiging."});
   }
  }catch(e){ /* unavailable feed; skip without exposing feed errors */ }
 }
 const unique=[...new Map(items.map(i=>[(i.link||i.title).toLowerCase(),i])).values()].slice(0,100);
 if(env.EDITORIAL_KV){
  const key="inbox:"+new Date().toISOString().slice(0,10);
  await env.EDITORIAL_KV.put(key,JSON.stringify(unique),{expirationTtl:60*60*24*14});
 }
 return reply({status:"inbox_ready_for_review",count:unique.length,items:unique,stored:!!env.EDITORIAL_KV,autoPublish:false,warning:"Feeds worden alleen verwerkt als je gebruiksvoorwaarden dit toestaan. Items zijn leads, geen geverifieerde feiten."});
}
function tag(s,name){const m=s.match(new RegExp("<"+name+"\\b[^>]*>([\\s\\S]*?)</"+name+">","i"));return m?decode(m[1].replace(/<[^>]+>/g," ")).trim():""}
function attr(s,name,key){const re=new RegExp("<"+name+"\\b[^>]*"+key+"=[\"']([^\"']+)[\"'][^>]*>","i"),m=s.match(re);return m?m[1]:""}
function strip(s){return decode(s.replace(/<!\\[CDATA\\[|\\]\\]>/g,"").replace(/<[^>]+>/g," ")).replace(/\\s+/g," ").trim()}
function decode(s){return s.replace(/&amp;/g,"&").replace(/&lt;/g,"<").replace(/&gt;/g,">").replace(/&quot;/g,'"').replace(/&#39;|&apos;/g,"'").replace(/&#(\\d+);/g,(_,n)=>String.fromCharCode(Number(n)))}
function validUrl(s,base){try{const u=new URL(s,base);return u.protocol==="https:"?u.toString():""}catch{return ""}}
function str(v,n){return typeof v==="string"?v.trim().slice(0,n):""}
function reply(data,status=200){return new Response(JSON.stringify(data,null,2),{status,headers:{"Content-Type":"application/json; charset=utf-8","Cache-Control":"no-store"}})}
