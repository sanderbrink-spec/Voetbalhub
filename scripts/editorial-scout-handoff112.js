'use strict';
// 112C: untrusted AI scout questions enter a read-only editorial research queue.
// They never become verified facts, author instructions, approvals or articles.
const MAX_AGE_MS=72*60*60*1000;
const MAX_HANDOFFS=6;
const MAX_QUESTIONS=2;
const bad=/\b(?:negeer|overschrijf|systeeminstructie|system prompt|jailbreak|forceer|publiceer|verwijder|geef vrij|bypass|omzeil|automatisch goedkeuren)\b/i;
const leading=/^(?:(?:bij|in|op|van|door|onder|met)\s+)?(?:wie|wat|waar|wanneer|welk(?:e)?|hoe|waarom|kan|kunnen|heeft|hebben|is|zijn|was|waren|wordt|werden|staat|staan|bevestigt|bevestigen|ontkent|ontkennen|vermeldt|vermelden|onderbouwt|onderbouwen|blijkt|blijken|komt|komen|verschilt|verschillen)\b/i;
function safeQuestion(raw){
 if(typeof raw!=='string')return null;
 const q=raw.replace(/\s+/g,' ').trim();
 if(q.length<18||q.length>180||!q.endsWith('?')||/[<>]/.test(q)||
    /https?:\/\/|@|[{}]/i.test(q)||bad.test(q)||!leading.test(q))return null;
 return q;
}
function matchScoutHandoff(group,notes,now=Date.now()){
 if(!group||typeof group.id!=='string'||!Array.isArray(group.sources)||
    !Array.isArray(group.agents)||!Array.isArray(notes))return null;
 const urls=new Set(group.sources.map(s=>s?.url).filter(u=>typeof u==='string'&&u.startsWith('https://')));
 const candidates=notes.filter(n=>{
  if(!n||!/^[a-f0-9]{24}$/.test(String(n.groupKey||''))||!group.agents.includes(n.agentId)||
     n.status!=='analysis_only_unverified'||n.verified!==false||
     n.publicationAllowed!==false||!Array.isArray(n.subjects)||
     n.subjects.length===0||n.subjects.some(url=>!urls.has(url)))return false;
  const at=Date.parse(n.at||'');
  if(!Number.isFinite(at)||at>now||now-at>MAX_AGE_MS)return false;
  const audit=n.trainingAudit;
  if(audit?.metric!=='research_note_protocol_compliance_not_journalistic_skill'||
     !Array.isArray(audit.issues)||audit.issues.includes('risky_angle')||
     audit.issues.includes('missing_questions'))return false;
  return true;
 }).sort((a,b)=>Date.parse(b.at)-Date.parse(a.at));
 for(const n of candidates){
  const questions=[...new Set((Array.isArray(n.questions)?n.questions:[]).map(safeQuestion).filter(Boolean))].slice(0,MAX_QUESTIONS);
  if(!questions.length)continue;
  return {
   kind:'unverified_scout_questions_only',
   groupKey:group.id,originalGroupKey:n.groupKey,agentId:n.agentId,at:n.at,
   sourceMatchMode:n.groupKey===group.id?'exact_dossier_and_sources':'exact_sources_after_dossier_regrouping',
   questions,sourceUrls:[...new Set(n.subjects)],
   sourceEvidenceVerified:false,
   originalReporterIndependenceVerified:false,
   independentlyConfirmed:false,
   publisherFactsFromMemoAllowed:false,
   articleDraftAllowed:false,
   publicationAllowed:false,
   mediaOwnershipClearance:false,
   trainingProtocolScoreOnly:n.trainingAudit.formatScore??null
  };
 }
 return null;
}
function buildScoutHandoffs(groups=[],notes=[],now=Date.now()){
 if(!Array.isArray(groups)||!Array.isArray(notes))return [];
 return groups.map(g=>matchScoutHandoff(g,notes,now)).filter(Boolean).slice(0,MAX_HANDOFFS);
}
module.exports={MAX_HANDOFFS,MAX_QUESTIONS,safeQuestion,matchScoutHandoff,buildScoutHandoffs};
