'use strict';

const { contentHash } = require('./article-covers');
const { draftIssues } = require('./editorial-desk-model');
const { audit } = require('./editorial-facts');
const { headlineContradictions } = require('./editorial-quality');
const { verifiedIncidentCoverageIssues } = require('./editorial-match-guidance133');
const { halfTimeNarrativeIssues } = require('./editorial-chronology139');
const revisions = require('./editorial-evidence/reviewed-revisions64.json');
const incidentRevisions = require('./editorial-evidence/reviewed-revisions71.json');
const day = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Amsterdam' });
const factChecks = { resultVerified: true, namesVerified: true, dateVerified: true, timelineVerified: true };

function sameScore(a, b) {
 return a?.home === b.home && a?.away === b.away;
}

function registrationMatches(row, fixture) {
 const { match, registration } = row;
 const expectedGoals = registration.goalTimeline;
 return fixture?.id === row.matchId && fixture.status === 'FT' &&
  fixture.competition === 'eredivisie' && fixture.resultSource === 'Sportmonks Football API' &&
  fixture.date === registration.date && day.format(new Date(fixture.date)) === match.playedAt &&
  fixture.round === registration.round && fixture.home?.name === match.homeTeam &&
  fixture.away?.name === match.awayTeam && sameScore(fixture.goals, { home: match.homeScore, away: match.awayScore }) &&
  sameScore(fixture.halfTime, registration.halfTime) &&
  (expectedGoals.length === 0 || (fixture.goalTimeline?.length === expectedGoals.length &&
   expectedGoals.every((event, index) => Object.entries(event).every(([key, value]) =>
    fixture.goalTimeline[index][key] === value))));
}

function prepare(previous, row, fixture, updatedAt) {
 if (previous.status !== 'published' || previous.id !== row.id || previous.matchId !== row.matchId ||
     previous.category !== row.category || contentHash(previous) !== row.previousCopy ||
     !Object.entries(row.match).every(([key, value]) => previous.match?.[key] === value))
  throw Error('De opgeslagen versie verschilt van de beoordeelde versie.');
 if (!registrationMatches(row, fixture)) throw Error('De actuele Sportmonks-registratie bevestigt de revisie niet.');

 const { draft, verifiedFacts, sources } = row;
 const payload = { match: row.match, articleKind: 'match_report', verifiedFacts, sources, factChecks, draft };
 const issues = [...draftIssues(draft), ...audit(payload), ...halfTimeNarrativeIssues(payload, draft)];
 if (incidentRevisions.includes(row)) issues.push(...verifiedIncidentCoverageIssues(payload,draft));
 if (headlineContradictions(draft)) issues.push('Tegenstrijdige kop.');
 if (issues.length) throw Error(issues.join(' '));

 const next = { ...previous, ...draft, verifiedFacts, sources, articleKind: payload.articleKind,
  updatedAt, correctionNote: 'Wedstrijdverslag herzien na vergelijking met Sportmonks en openbare wedstrijdbronnen.' };
 delete next.compactVerified;
 return next;
}

// Validate the exact old content, then retain the full prior article atomically with the change.
const writeRevision = `
if redis.call('GET', KEYS[1]) ~= ARGV[1] or redis.call('EXISTS', KEYS[2]) == 1 then return 0 end
redis.call('MSET', KEYS[2], ARGV[1], KEYS[1], ARGV[2])
return 1
`;

async function apply(client, getFixtures, logger = console) {
 const pending = [];
 for (const row of [...revisions, ...incidentRevisions]) {
  const key = 'article:' + row.id;
  const version = incidentRevisions.includes(row) ? 71 : 64;
  const history = 'article-revision:' + version + ':' + row.id;
  const [raw, prior] = await client.mGet([key, history]);
  if (raw && !prior) pending.push({ row, key, history, raw, version });
 }
 if (!pending.length) return;
 const fixtures = await getFixtures();
 for (const { row, key, history, raw, version } of pending) {
  let next;
  try {
   next = prepare(JSON.parse(raw), row, fixtures.find(f => f.id === row.matchId), new Date().toISOString());
  } catch (error) {
   logger.warn('Editorial revision '+version+' held:', row.matchId, error.message);
   continue;
  }
  const written = await client.eval(writeRevision, { keys: [key, history], arguments: [raw, JSON.stringify(next)] });
  if (written) logger.info('Editorial revision '+version+' applied:', row.matchId);
 }
}

module.exports = { apply, prepare, registrationMatches };
