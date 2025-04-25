// token-utils.js

const { Firestore } = require('@google-cloud/firestore');
const fetch         = require('node-fetch');
const { getSecret } = require('./secrets');


const { Logging } = require('@google-cloud/logging');
const logging = new Logging();
const log = logging.log('token-refresh-log');  // You can name the log whatever you want

const db = new Firestore();


async function writeLog(severity, message, data = {}) {
  const metadata = { severity };
  const entry = log.entry(metadata, { message, ...data });
  await log.write(entry);
}

/**
 * Checks a user’s stored token in Firestore and refreshes it if it’s
 * within 60s of expiry. Returns a valid access_token.
 */
async function refreshTokenIfNeeded(userId) {
  // 1) Fetch the stored record
  const userDoc = await db.collection('users').doc(userId).get();
  if (!userDoc.exists) {
    throw new Error(`User ${userId} not found in Firestore.`);
  }

  // 2) See how long since we stored it
  const { access_token, refresh_token, expires_in, timestamp } = userDoc.data();
  const elapsed = (Date.now() - new Date(timestamp)) / 1000;
  // still valid?
  if (elapsed < expires_in - 60) {
    return access_token;
  }

  // 3) If expired (or about to), grab your FreeAgent client creds
  const clientId     = await getSecret('freeagent-client-id');
  const clientSecret = await getSecret('freeagent-client-secret');

  // 4) Call the token endpoint to refresh
  const resp = await fetch('https://api.freeagent.com/v2/token_endpoint', {
    method:  'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type:    'refresh_token',
      refresh_token: refresh_token,
      client_id:     clientId,
      client_secret: clientSecret,
    }),
  });

  if (!resp.ok) {
    throw new Error(`Failed to refresh token: ${await resp.text()}`);
  }

  // 5) Store the new tokens & timestamp
  const nt = await resp.json();
  const updated = {
    access_token:  nt.access_token,
    refresh_token: nt.refresh_token || refresh_token,
    expires_in:    nt.expires_in,
    timestamp:     new Date().toISOString(),
  };
  await db.collection('users').doc(userId).set(updated, { merge: true });

  // 6) Return the fresh access_token
  return updated.access_token;
  
  await writeLog('INFO', `Refreshed token for user ${userId}`, { userId });
  
}

module.exports = { refreshTokenIfNeeded };