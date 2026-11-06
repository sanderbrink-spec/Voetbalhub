'use strict';

const CREDIT = 'Football data provided by the Football-Data.org API';
const normalize = name => String(name || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  .toLowerCase().replace(/\b(?:afc|fc|sc|sbv|rkc)\b/g, '').replace(/[^a-z0-9]/g, '');
const localDay = new Intl.DateTimeFormat('sv-SE', {timeZone: 'Europe/Amsterdam'});

function supplement(fixtures, response, season, now) {
  if (response?.competition?.code !== 'DED' || !Array.isArray(response.matches) || response.matches.length > 306) {
    throw Error('Onverwacht Eredivisie-antwoord');
  }
  const byRound = new Map();
  for (const row of response.matches) {
    const kickoff = Date.parse(row.utcDate);
    const score = row.score?.fullTime;
    if (row.status !== 'FINISHED' || row.score?.duration !== 'REGULAR' ||
        !Number.isInteger(row.matchday) || !String(row.season?.startDate).startsWith(season + '-') ||
        !Number.isFinite(kickoff) || kickoff >= now || ![score?.home, score?.away].every(n => Number.isInteger(n) && n >= 0)) continue;
    if (!byRound.has(row.matchday)) byRound.set(row.matchday, []);
    byRound.get(row.matchday).push({row, kickoff, score});
  }

  const matchesTeam = (team, name) => normalize(name) && [team?.name, team?.shortName]
    .some(label => normalize(label) === normalize(name));
  return fixtures.map(f => {
    if (!['AWAITING', 'TBD'].includes(f.status) || Date.parse(f.date) >= now) return f;
    const day = localDay.format(new Date(f.date));
    const round = Number(f.round.replace('Speelronde ', ''));
    const matches = (byRound.get(round) || []).filter(({row, kickoff}) =>
      localDay.format(new Date(kickoff)) === day &&
      matchesTeam(row.homeTeam, f.home.name) && matchesTeam(row.awayTeam, f.away.name)
    );
    if (matches.length !== 1) return f;
    const {score,row} = matches[0];
    const half = row.score?.halfTime;
    const halfTime = [half?.home,half?.away].every(n => Number.isInteger(n) && n >= 0) && half.home <= score.home && half.away <= score.away ? half : null;
    return {...f, status: 'FT', goals: {home: score.home, away: score.away},
      ...(halfTime ? {halfTime} : {}), resultSource: CREDIT, resultExpiresAt: now + 36 * 3600000};
  });
}

module.exports = { CREDIT, supplement };
