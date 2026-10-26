"use strict";
function normalizeEditorialResponse(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) return { ok: false, reason: "AI-antwoord is geen JSON-object." };
  const rawDecision = input.editorialDecision ?? input.editorial_decision;
  const decision = typeof rawDecision === "string" ? rawDecision.trim().toLowerCase() : "";
  if (decision !== "keep" && decision !== "skip") return { ok: false, reason: "AI-antwoord mist een geldige editorialDecision (keep/skip)." };
  const skipReason = typeof input.skipReason === "string" ? input.skipReason.trim().slice(0, 500)
    : typeof input.skip_reason === "string" ? input.skip_reason.trim().slice(0, 500) : "";
  if (decision === "skip") return { ok: true, value: { editorialDecision: "skip", skipReason: skipReason || "Te beperkte nieuwswaarde of onvoldoende onafhankelijke onderbouwing." } };
  const headline = typeof input.headline === "string" ? input.headline.trim() : "";
  const standfirst = typeof input.standfirst === "string" ? input.standfirst.trim() : "";
  let body = input.body;
  if (typeof body === "string") body = body.split(/\n\s*\n|\n/).map(p => p.trim()).filter(Boolean);
  else if (Array.isArray(body)) body = body.filter(p => typeof p === "string").map(p => p.trim()).filter(Boolean);
  else body = [];
  if (!headline || !standfirst || body.length === 0) return { ok: false, reason: "AI-antwoord voor keep mist een kop, intro of artikelalinea." };
  if (body.length < 3) return { ok: false, reason: "AI-antwoord bevat minder dan drie inhoudelijke alinea\u2019s." };
  if (body.some(p => p.length < 70)) return { ok: false, reason: "AI-antwoord bevat een alinea korter dan 70 tekens." };
  return { ok: true, value: { editorialDecision: "keep", headline: headline.slice(0, 240), standfirst: standfirst.slice(0, 700), body: body.slice(0, 5).map(p => p.slice(0, 1200)), skipReason } };
}
module.exports = { normalizeEditorialResponse };
