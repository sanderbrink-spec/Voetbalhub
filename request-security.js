'use strict';
const crypto = require('node:crypto');
function tokenMatches(header, secret) {
  if (!secret || typeof header !== 'string' || header.length > 4096) return false;
  const hash = value => crypto.createHash('sha256').update(value).digest();
  return crypto.timingSafeEqual(hash(header), hash('Bearer ' + secret));
}
function allowedOrigin(origin, configured = '') {
  // A comma-separated list must never be emitted as one invalid ACAO header.
  if (!origin || origin === 'null') return null;
  return configured.split(',').map(v => v.trim()).includes(origin) ? origin : null;
}
module.exports = {tokenMatches, allowedOrigin};
