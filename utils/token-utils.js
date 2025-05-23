// token-utils.js

import { Firestore } from '@google-cloud/firestore';
import fetch from 'node-fetch';
import { getSecret } from './secrets.js';
import { writeLog } from './log.js';

const db = new Firestore();


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
    refresh_token: nt.refresh_token || refresh_token, // keep old if none provided
    expires_in:    nt.expires_in,
    timestamp:     new Date().toISOString(),
    expires_at:    new Date(Date.now() + nt.expires_in * 1000).toISOString(), // <-- NEW FIELD
  };
  await db.collection('users').doc(userId).set(updated, { merge: true });

  // 6) write a log message then Return the fresh access_token
  await writeLog({
    logName: 'oauth-log',
    severity: 'INFO',
    functionName: 'refreshTokenIfNeeded',
    message: 'Successfully refreshed access token for user ${userId}'
  });

  return updated.access_token;
  
}

export { refreshTokenIfNeeded };