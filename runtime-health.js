'use strict';

function withDeadline(operation, milliseconds, code = 'READ_TIMEOUT') {
  let timer;
  return Promise.race([
    Promise.resolve().then(operation),
    new Promise((_, reject) => {
      timer = setTimeout(() => reject(new Error(code)), milliseconds);
    })
  ]).finally(() => clearTimeout(timer));
}

async function readiness(client, milliseconds = 1500) {
  if (!client?.isReady) return false;
  try {
    return await withDeadline(() => client.ping(), milliseconds) === 'PONG' && client.isReady;
  } catch {
    return false;
  }
}

function revision(env = process.env) {
  const value = env.RENDER_GIT_COMMIT || '';
  return /^[a-f0-9]{40}$/.test(value) ? value : null;
}

module.exports = {withDeadline, readiness, revision};
