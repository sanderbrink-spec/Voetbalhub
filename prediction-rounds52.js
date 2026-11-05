'use strict';

const { dayKey } = require('./quiz39/selection');
const { week } = require('./match-selection50');
const ROUND_SIZE = 10;
const PUBLISH = `
  if redis.call('HEXISTS', KEYS[1], ARGV[1]) == 1 then return 0 end
  local ids = {}
  for _, id in ipairs(cjson.decode(ARGV[2])) do ids[id] = true end
  for _, round in ipairs(redis.call('HVALS', KEYS[1])) do
    for _, id in ipairs(cjson.decode(round)) do if ids[id] then return 0 end end
  end
  return redis.call('HSET', KEYS[1], ARGV[1], ARGV[2])`;
const isOpen = (fixture, now) => fixture?.status === 'NS' && Date.parse(fixture.date) > now;
const compare = (a, b) => Date.parse(a.date) - Date.parse(b.date) || String(a.id).localeCompare(String(b.id));
const weekOf = date => week(dayKey(Date.parse(date)));

async function snapshot({ redis, football, prefix, now, requestedSeason, requestedRound, publish }) {
  const overview = await football.overview();
  const season = String(overview.league.season);
  const current = requestedSeason === undefined || requestedSeason === season;
  const key = prefix + 'prediction-rounds52:' + season;
  if (!current) return { ...overview, fixtures: [], rounds: [], round: '' };

  const fixtures = new Map();
  const add = fixture => {
    if (Number.isFinite(Date.parse(fixture.date))) fixtures.set(String(fixture.id), fixture);
  };
  if (overview.rightsExpiresAt > now) (overview.fixtures || []).forEach(add);
  (overview.europeanFixtures || []).forEach(add);

  let rounds = await redis.hGetAll(key);
  if (publish) {
    const assigned = new Set(Object.values(rounds).flatMap(JSON.parse));
    const candidates = [...fixtures.values()].filter(fixture =>
      isOpen(fixture, now) && Date.parse(fixture.date) <= now + 21 * 86400000 &&
      !assigned.has(String(fixture.id)) && !Object.hasOwn(rounds, weekOf(fixture.date))
    ).sort(compare);
    if (candidates.length >= ROUND_SIZE) {
      const label = weekOf(candidates[0].date);
      const priority = fixture => weekOf(fixture.date) === label && fixture.competition === 'eredivisie';
      const ids = candidates.sort((a, b) => Number(priority(b)) - Number(priority(a)) || compare(a, b))
        .slice(0, ROUND_SIZE).map(fixture => String(fixture.id));
      await redis.eval(PUBLISH, { keys: [key], arguments: [label, JSON.stringify(ids)] });
      rounds = await redis.hGetAll(key);
    }
  }

  const labels = Object.keys(rounds).sort();
  const active = label => JSON.parse(rounds[label]).some(id => isOpen(fixtures.get(id), now));
  const round = labels.includes(requestedRound) ? requestedRound : labels.find(active) || labels.at(-1) || '';
  const selected = labels.flatMap(label => JSON.parse(rounds[label]).flatMap(id => {
    const fixture = fixtures.get(id);
    return fixture ? [{ ...fixture, round: label }] : [];
  })).sort(compare);
  const complete = selected.filter(fixture => fixture.round === round).length === ROUND_SIZE;
  return {
    ...overview, fixtures: selected, rounds: labels, round, complete,
    source: 'Veldio · gecontroleerde Eredivisie- en Europese wedstrijdgegevens',
    message: complete ? '' : round ? 'De ronde is tijdelijk niet volledig beschikbaar.' : 'Nog geen ronde met tien gecontroleerde aftraptijden beschikbaar.'
  };
}

module.exports = { snapshot, isOpen };
