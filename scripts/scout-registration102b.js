'use strict';

const {createHash} = require('node:crypto');
const {readState} = require('./ten-agent-newsroom101');
const registry = 'https://www.uefa.com/uefachampionsleague/clubs/';
const digest = value => createHash('sha256').update(value).digest('hex');
const slug = value => value.normalize('NFKD').replace(/\p{M}/gu, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

function chooseQuestion(state, now) {
  for (const note of state.researchNotes || []) {
    const age = now - Date.parse(note.at);
    if (!(age >= 0 && age < 72 * 3600000) || note.status !== 'analysis_only_unverified') continue;
    const questions = (note.questions || []).filter(q => typeof q === 'string');
    const question = questions.find(q => /onafhankelijke bronnen/i.test(q) && /transferregistraties/i.test(q));
    if (!question) continue;
    // Resolve the full name and destination from this same note, never from a neighbouring story.
    const companion = questions.map(q => q.normalize('NFKC').match(/bevestiging van ([\p{L} .’-]+?)['’]s mogelijke overstap naar ([\p{L} .-]+)\?/iu)).find(Boolean);
    if (!companion) continue;
    const [, player, destination] = companion;
    const surname = slug(player.split(' ').slice(1).join(' '));
    if (!surname || !note.subjects?.some(url => slug(url).includes(surname) && slug(url).includes(slug(destination)))) continue;
    return {question, player, destination, groupKey:note.groupKey, agent:note.agentId, createdAt:note.at};
  }
  return null;
}

function seasonOf(now) {
  const date = new Date(now);
  const start = date.getUTCFullYear() - Number(date.getUTCMonth() < 6);
  return start + '/' + String(start + 1).slice(-2);
}

async function researchRegistration(selection, {load, now, plain, audit}) {
  const season = seasonOf(now);
  const index = await load(registry);
  if (!index.title.includes('UEFA Champions League ' + season) &&
      !index.html.includes('UEFA Champions League ' + season)) throw Error('Seizoen van het UEFA-register ontbreekt.');
  const league = index.html.split(/<h2[^>]*>League phase<\/h2>/i)[1]?.split('<h2')[0] || '';
  const clubs = [...new Set(Array.from(league.matchAll(/href="(\/uefachampionsleague\/clubs\/\d+--[a-z0-9-]+\/)"[^>]*class="team-wrap"/g), m => m[1]))];
  if (!clubs.length || clubs.length > 48) throw Error('UEFA-clubindex niet herkenbaar.');
  const playerSlug = slug(selection.player);
  audit.registry = {url:index.url, season, clubCount:clubs.length, squadsRead:0};
  const rows = [];
  const found = [];
  // Inspect the bounded league-phase roster, including other clubs with a possible namesake.
  for (let i = 0; i < clubs.length; i += 4) {
    const batch = await Promise.allSettled(clubs.slice(i,i+4).map(path => load(new URL(path+'squad/',registry).href)));
    for (const [j, result] of batch.entries()) {
      const url = new URL(clubs[i+j]+'squad/',registry).href;
      if (result.status !== 'fulfilled') { audit.unavailable.push(url); continue; }
      const doc = result.value;
      if (doc.url !== url) continue;
      const title = plain(doc.html.match(/<title>([^<]+)<\/title>/i)?.[1] || '');
      const [club, type, competition] = title.split(' | ');
      if (type !== 'Squad' || competition !== 'UEFA Champions League '+season) continue;
      audit.registry.squadsRead++;
      for (const match of doc.html.matchAll(/<pk-table-row\b[^>]*>([\s\S]*?)<\/pk-table-row>/gi)) {
        const html = match[1];
        const link = html.match(/<a href="(\/uefachampionsleague\/clubs\/players\/(\d+)--([a-z0-9-]+)\/)" title="([^"]+)"/i);
        if (!link || link[3] !== playerSlug || plain(link[4]).normalize('NFKC') !== selection.player) continue;
        const appearances = html.match(/column-key="matches">\s*(\d+)\s*</);
        if (appearances) found.push({url, title, club, profile:new URL(link[1],registry).href, playerId:link[2], appearances:Number(appearances[1]), row:plain(html), hash:digest(doc.html)});
      }
    }
  }
  if (found.length !== 1) throw Error('Geen eenduidige positieve UEFA-registratie gevonden.');
  const entry = found[0];
  const profile = await load(entry.profile);
  const title = plain(profile.html.match(/<title>([^<]+)<\/title>/i)?.[1] || '');
  if (profile.url !== entry.profile || title !== [selection.player,entry.club,'UEFA Champions League '+season,'UEFA.com'].join(' | ')) throw Error('Speler, club of editie verschilt in het spelersprofiel.');
  for (const tag of profile.html.matchAll(/<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi)) {
    const data = JSON.parse(tag[1]);
    if (data['@type'] === 'Dataset' && data.url === entry.profile && data.keywords?.includes(selection.player) && data.creator?.name === 'UEFA') rows.push(...data.variableMeasured);
  }
  const stats = Object.fromEntries(rows.filter(r => Number.isSafeInteger(r.value) && r.value >= 0).map(r => [r.name,r.value]));
  if (stats['Matches played'] !== entry.appearances || !Number.isSafeInteger(stats['Minutes played'])) throw Error('De speeltijd en het aantal optredens zijn niet onderling verifieerbaar.');
  const sourceTitle = title.replace(' | UEFA.com','');
  const statQuotes = ['Matches played','Minutes played','Assists'].filter(k => Number.isInteger(stats[k])).map(k => {
    const raw = rows.find(r => r.name === k && r.value === stats[k]);
    const quote = JSON.stringify(raw);
    if (!profile.html.includes(quote)) throw Error('Letterlijke statistiek ontbreekt in de bron.');
    return {key:k, value:raw.value, quote};
  });
  const docs = [
    {url:entry.url, title:entry.title, text:entry.title+'\n'+entry.row, sha256:entry.hash},
    {url:entry.profile, title, text:[sourceTitle,...statQuotes.map(r=>r.quote)].join('\n'), sha256:digest(profile.html)}
  ];
  const facts = [
    {text:`UEFA vermeldt ${selection.player} bij ${entry.club} voor de Champions League van ${season}.`,evidence:[{source:0,quote:entry.row},{source:1,quote:sourceTitle}]},
    {text:`Voor ${entry.club} staat ${selection.player} in die editie op ${entry.appearances} wedstrijden en ${stats['Minutes played']} speelminuten.`,evidence:statQuotes.slice(0,2).map(r=>({source:1,quote:r.quote}))}
  ];
  if (Number.isInteger(stats.Assists)) facts.push({text:`UEFA registreert voor ${selection.player} in die editie ${stats.Assists} ${stats.Assists === 1 ? 'assist' : 'assists'}.`,evidence:[{source:1,quote:statQuotes.at(-1).quote}]});
  return {docs,facts,club:entry.club,season,playerId:entry.playerId};
}

async function readQuestion(token, fetcher, now) {
  const {state,sha} = await readState({token,fetcher});
  const selection = chooseQuestion(state,now);
  if (!selection) throw Error('Geen actuele, uitvoerbare vraag over transferregistraties.');
  return {selection,checkpointBlob:sha};
}
module.exports = {chooseQuestion, readQuestion, researchRegistration};
