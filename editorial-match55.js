'use strict';

const DAY = new Intl.DateTimeFormat('sv-SE', {timeZone:'Europe/Amsterdam'});
const OPEN = 'https://github.com/openfootball/football.json';
const FD = 'https://www.football-data.org/';
const {CREDIT} = require('./football-results52');
const {sourceBody} = require('./football-data47');
const EURO = require('./match-selection50');
const HOURS = 36 * 3600000;
const validScore = value => Number.isInteger(value) && value >= 0 && value <= 99;

function candidate(fixture, now) {
 const kickoff = Date.parse(fixture.date);
 const {home, away} = fixture.goals || {};
 const championsLeague = fixture.competition === 'championsleague' && /^fd-cl-\d+$/.test(fixture.id);
 if (!(championsLeague || fixture.competition === 'eredivisie' && /^of-nl-\d{4}-[a-z0-9-]+$/.test(fixture.id)) ||
     fixture.status !== 'FT' ||
     !(kickoff < now && now - kickoff <= HOURS) ||
     !fixture.home?.name || !fixture.away?.name || ![home, away].every(validScore)) return null;
 const supplemented = Boolean(fixture.resultSource);
 if (supplemented && !(fixture.resultExpiresAt > now)) return null;
 const half = fixture.halfTime;
 const hasHalf = [half?.home, half?.away].every(validScore) && half.home <= home && half.away <= away;
 const round = /^(?:Speelronde \d+|Competitiefase|Achtste finale|Kwartfinale|Halve finale|Finale)$/.test(fixture.round) ? fixture.round : '';
 if (!round) return null;
 const category = championsLeague ? 'Champions League' : 'Eredivisie';
 // With only a score, report exceptional margins or a meeting of leading clubs.
 const leading = /^(Ajax|Feyenoord|PSV|AZ|FC Twente)$/i;
 if (!hasHalf && !championsLeague && Math.abs(home - away) < 3 &&
     !(leading.test(fixture.home.name) && leading.test(fixture.away.name))) return null;
 const match = {homeTeam:fixture.home.name, awayTeam:fixture.away.name, homeScore:home, awayScore:away, playedAt:DAY.format(new Date(kickoff))};
 const topic = match.homeTeam + ' – ' + match.awayTeam;
 const verifiedFacts = [
  topic + ' eindigde in ' + home + '-' + away + '.',
  category + ', ' + round.toLowerCase() + ', gespeeld op ' + match.playedAt + '.'
 ];
 if (hasHalf) verifiedFacts.push('Ruststand ' + half.home + '-' + half.away + '.');
 const sources = [{url:supplemented ? FD : OPEN}];
 const articleKind = hasHalf ? 'match_report' : 'score_update';
 return {topic, category, matchId:fixture.id, match, verifiedFacts, sources, articleKind,
  publishedAt:fixture.date, factChecks:{resultVerified:true,namesVerified:true,dateVerified:true,timelineVerified:true}};
}

function matchesRegistration(payload, fixtures, now) {
 const record = candidate(fixtures.find(f => f.id === payload.matchId) || {}, now);
 return Boolean(record && ['articleKind','category','match','verifiedFacts','sources'].every(key =>
  JSON.stringify(record[key]) === JSON.stringify(payload[key])));
}
function europeanRegistry({fetcher = fetch, token, clock = Date.now} = {}) {
 let cache, inFlight;
 return async function get() {
  const now = clock();
  if (!token) return {status:'unavailable',fixtures:[]};
  if (cache?.expires > now) return cache.value;
  if (inFlight) return inFlight;
  inFlight = (async () => {
   const dateFrom = new Date(now - HOURS).toISOString().slice(0,10);
   const dateTo = new Date(now).toISOString().slice(0,10);
   const params = new URLSearchParams({dateFrom,dateTo,status:'FINISHED'});
   const stages = {LEAGUE_STAGE:'Competitiefase',GROUP_STAGE:'Competitiefase',LAST_16:'Achtste finale',
    QUARTER_FINALS:'Kwartfinale',SEMI_FINALS:'Halve finale',FINAL:'Finale'};
   try {
    const response = await fetcher('https://api.football-data.org/v4/competitions/CL/matches?'+params,{
     headers:{'X-Auth-Token':token},redirect:'error',signal:AbortSignal.timeout(5000)
    });
    if (!response.ok) { await response.body?.cancel(); throw Error('Champions League HTTP '+response.status); }
    const data = JSON.parse(await sourceBody(response));
    if (data.competition?.code !== 'CL' || !Array.isArray(data.matches) || data.matches.length > 100) throw Error('Ongeldige Champions League-registratie.');
    const fixtures = [];
    for (const row of data.matches) {
     const round = stages[row.stage];
     const goals = row.score?.fullTime;
     if (row.status !== 'FINISHED' || row.score?.duration !== 'REGULAR' || !round ||
         !Number.isSafeInteger(row.id) || row.id <= 0 ||
         ![row.homeTeam?.name,row.awayTeam?.name].every(name=>typeof name==='string'&&name.length>=2&&name.length<=80) ||
         ![goals?.home,goals?.away].every(validScore)) continue;
     const fixture = {id:'fd-cl-'+row.id,competition:'championsleague',date:row.utcDate,status:'FT',round,
      home:{name:row.homeTeam.name},away:{name:row.awayTeam.name},goals,halfTime:row.score.halfTime,
      resultSource:CREDIT,resultExpiresAt:now+HOURS};
     if (candidate(fixture,now)) fixtures.push(fixture);
    }
    return {status:'available',fixtures:EURO.select(fixtures,require('./match-selection50.json'))};
   } catch {
    return {status:'unavailable',fixtures:[]};
   }
  })();
  try {
   const value = await inFlight;
   cache = {value,expires:now + (value.status === 'available' ? 15 : 1) * 60000};
   return value;
  } finally { inFlight = null; }
 };
}
module.exports = {candidate, matchesRegistration, europeanRegistry, OPEN, FD};
