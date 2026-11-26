'use strict';
// Convert one current, safely handed-off scout question into an existing
// official-source discovery action. Neither headline nor question is proof.
const {classifyLeads}=require('./ten-agent-newsroom101');
const {buildScoutHandoffs}=require('./editorial-scout-handoff112');
const {researchTerms}=require('./editorial-discovery53');
function selectScoutSearch({leads=[],notes=[],now,existing=[]}={}){
 if(!Number.isFinite(now)||!Array.isArray(leads)||!Array.isArray(notes))return null;
 const fresh=leads.slice(0,300).filter(l=>{
  const t=Date.parse(l?.publishedAt||'');
  return typeof l?.id==='string'&&typeof l.title==='string'&&l.title.length<=200&&
   typeof l.url==='string'&&Number.isFinite(t)&&t<=now&&now-t<=24*3600000&&
   ['vi','vp','nos'].includes(l.publisher)&&/^https:\/\//.test(l.url);
 });
 const groups=classifyLeads(fresh).groups;
 const handoffs=buildScoutHandoffs(groups,notes,now);
 const anchors=s=>researchTerms(s).slice(0,3).sort().join(' ');
 const used=new Set(existing.map(d=>anchors(d.title)).filter(Boolean));
 for(const h of handoffs){
  const g=groups.find(x=>x.id===h.groupKey);
  const source=g?.sources.find(s=>h.sourceUrls.includes(s.url)&&researchTerms(s.title).length>=2);
  if(!source||used.has(anchors(source.title)))continue;
  // Only the original RSS headline supplies bounded search terms. Do not send
  // model-generated questions, snippets or arbitrary URLs as search operators.
  return {url:source.url,title:source.title,publishedAt:source.publishedAt,
   groupKey:h.groupKey,agentId:h.agentId,questionCount:h.questions.length,
   discoveryOnly:true,publicationAllowed:false};
 }
 return null;
}
module.exports={selectScoutSearch};
