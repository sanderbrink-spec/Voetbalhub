'use strict';

const {norm} = require('./stadium-venue74');
const neutralId = 'stadium116-neutral-football';

// NOAA fractional-year solar approximation. The UTC offset in the kickoff instant
// includes local daylight saving. Apparent sunset is at -0.833 degrees.
function solarElevation(fixture = {}) {
  const stamp = fixture.date || fixture.playedAt;
  const {latitude, longitude} = fixture.venue || {};
  if (!/(Z|[+-]\d\d:\d\d)$/.test(stamp || '') || !Number.isFinite(Date.parse(stamp)) ||
      !Number.isFinite(latitude) || Math.abs(latitude) > 90 ||
      !Number.isFinite(longitude) || Math.abs(longitude) > 180) return null;
  const t = new Date(stamp);
  const minutes = t.getUTCHours() * 60 + t.getUTCMinutes() + t.getUTCSeconds()/60;
  const y = t.getUTCFullYear();
  const n = Math.floor((Date.UTC(y,t.getUTCMonth(),t.getUTCDate()) - Date.UTC(y,0,0))/86400000);
  const yearDays = (Date.UTC(y+1,0,1)-Date.UTC(y,0,1))/86400000;
  const g = 2*Math.PI/yearDays * (n-1+(minutes/60-12)/24);
  const eq = 229.18*(0.000075+0.001868*Math.cos(g)-0.032077*Math.sin(g)-0.014615*Math.cos(2*g)-0.040849*Math.sin(2*g));
  const dec = 0.006918-0.399912*Math.cos(g)+0.070257*Math.sin(g)-0.006758*Math.cos(2*g)+0.000907*Math.sin(2*g)-0.002697*Math.cos(3*g)+0.00148*Math.sin(3*g);
  const angle = ((minutes+eq+4*longitude)/4-180)*Math.PI/180;
  const lat = latitude*Math.PI/180;
  return Math.asin(Math.sin(lat)*Math.sin(dec)+Math.cos(lat)*Math.cos(dec)*Math.cos(angle))*180/Math.PI;
}

function lighting(fixture) {
  const elevation = solarElevation(fixture);
  return elevation === null ? 'neutral' : elevation >= -0.833 ? 'day' : 'night';
}

function compatibleStatus(category, status) {
  if (!status) return true;
  const s = String(status).toUpperCase();
  if (category === 'preview') return ['NS','SCHEDULED','TIMED','UPCOMING','NOT_STARTED'].includes(s);
  if (category === 'report') return ['FT','AET','PEN','FINISHED','FINAL','COMPLETED'].includes(s);
  return true;
}

function approvedNeutral(asset) {
  if (asset?.id !== neutralId || asset.clubs.length || asset.imageKind || asset.stadiumIdentity) return false;
  const registered = require('./stadium-catalog116.json').assets.find(row => row.id === neutralId);
  if(!require('./premium-match-images72').brandingAllowed(asset)) return false;
  return registered?.sha256 === asset.sha256 && asset.neutralMatchReview?.assetSha256 === asset.sha256 &&
    asset.neutralMatchReview.noVenueOrTeam === true && asset.neutralMatchReview.score >= 8.5 &&
    require('./premium-match-images72').accepted(asset);
}

function neutralFor(ctx, rows) {
  if (!['preview','report'].includes(ctx.category) || !ctx.fixtureId || ctx.clubs?.length !== 2 ||
      !ctx.clubs.every(c=>typeof c === 'string' && norm(c)) || norm(ctx.clubs[0])===norm(ctx.clubs[1]) ||
      !compatibleStatus(ctx.category, ctx.fixtureStatus)) return null;
  return rows.find(approvedNeutral) || null;
}

module.exports = {solarElevation, lighting, compatibleStatus, approvedNeutral, neutralFor};
