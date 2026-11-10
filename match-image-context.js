'use strict';

const {createHash} = require('node:crypto');
const {contentHash} = require('./article-covers');

const kinds = {
  preview: 'preview', match_preview: 'preview',
  report: 'report', match_report: 'report', score_update: 'report'
};

function occupancyFor(kind) {
  return {preview: 'empty', report: 'full'}[kind];
}

function stadiumFor(fixture, homeTeam) {
  const normalize = value => String(value || '').normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');
  const venue = fixture.venueId || fixture.venue?.id || fixture.venue?.name || fixture.venueName;
  if (venue) return 'venue:' + normalize(venue);
  const home = normalize(homeTeam);
  return home ? 'home:' + (home === 'azalkmaar' ? 'az' : home) : '';
}

function matchImageContext(article, category, clubs, kickoff) {
  const imageKind = Object.hasOwn(kinds, category) ? kinds[category] : undefined;
  if (!imageKind) return {};
  const fixture = article.fixture || article.match || {};
  const stadiumIdentity = stadiumFor(fixture, clubs[0]);
  const stadiumOccupancy = occupancyFor(imageKind);
  const fixtureId = article.matchId || fixture.id || '';
  const kickoffTime = kickoff?.date || fixture.date || fixture.playedAt;
  // Legacy articles have no provider ID. Keep their key scoped to the
  // ordered pairing and kickoff, or to the same copy before and after publication.
  const fixtureIdentity = fixtureId || JSON.stringify([clubs, kickoffTime || contentHash(article)]);
  const imageIdentity = createHash('sha256')
    .update(JSON.stringify([imageKind, fixtureIdentity, stadiumIdentity, stadiumOccupancy]))
    .digest('hex');
  return {imageKind, stadiumOccupancy, stadiumIdentity, imageIdentity};
}

module.exports = {matchImageContext, stadiumFor, occupancyFor};
