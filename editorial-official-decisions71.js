'use strict';

// A club is a primary source for accepting its own disciplinary proposal.
// Keep each fact as a literal excerpt from that club's live article; no
// generated fact, inferred date, sanction or third-party wording is allowed.
function verifiedOfficialDisciplinaryDecision(doc) {
 if (!doc || typeof doc.title !== 'string' || typeof doc.text !== 'string') return null;
 const title = doc.title.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
 if (!/\b(?:schikkingsvoorstel|tuchtvoorstel)\b/.test(title) ||
     !/\b(?:geaccepteerd|aanvaard|aanvaardt|accepteert)\b/.test(title)) return null;
 const source = doc.text.replace(/\s+/g,' ').trim();
 if (source.length < 280 || !/\b(?:schikkingsvoorstel|tuchtvoorstel)\b/i.test(source.slice(0,2500)) ||
     !/\b(?:geaccepteerd|aanvaard|aanvaardt|accepteert)\b/i.test(source.slice(0,2500))) return null;

 const sentences = source.slice(0,4500)
  .split(/(?<=[.!?])\s+(?=[A-ZÀ-Ý0-9])/u)
  .map(s => s.trim())
  .filter(s => s.length >= 35 && s.length <= 700);
 // Priorities demand independently described details, not repetition of a
 // single sanction. All excerpts are checked again by validateEvidence.
 const themes = [
  /\b(?:schikkingsvoorstel|tuchtvoorstel|geaccepteerd|aanvaard)\b/i,
  /\b(?:hands|rode kaart|rood|scoringskans|van het veld)\b/i,
  /\b(?:ontbreekt|mist|missen|derby|thuisduel)\b/i,
  /\b(?:gele kaarten|automatisch|doelman|keeper)\b/i,
  /\b(?:schorsing|geschorst|competitiewedstrijd)\b/i
 ];
 const selected=[], seen=new Set();
 for (const theme of themes) {
  const sentence=sentences.find(s=>theme.test(s)&&!seen.has(s));
  if (sentence) {selected.push(sentence);seen.add(sentence);}
 }
 // Do not treat a thin announcement as a rich evidence packet.
 if (selected.length < 3) return null;
 return {
  kind:'announcement',topic:doc.title,category:'clubnieuws',
  primaryAuthority:'club_decision',eventDate:'',teams:[],
  sharedEventEvidence:[],
  facts:selected.map(text=>({text,evidence:[{source:0,quote:text}]}))
 };
}
module.exports={verifiedOfficialDisciplinaryDecision};
