// auth.js
// Handles the OAuth callback from FreeAgent and stores tokens in Firestore

import { getSecret } from '../utils/secrets.js';
import { Firestore } from '@google-cloud/firestore';
import fetch from 'node-fetch';
import { writeLog } from '../utils/log.js';

// Initialize Firestore client
const db = new Firestore();

/**
 * Your auth callback handler.
 * Expects req.query.code and req.query.state.
 */
async function authCallback(req, res) {
  const { code, state } = req.query;

    // --- Helper function to log errors ---
    async function logTokenExchangeFailed(error) {
      await writeLog({
        logName: 'oauth-log',
        severity: 'ERROR',
        functionName: 'logTokenExchangeFailed',
        event: 'Token Exchange Failed',
        data: {
          errorMessage: error?.message || error,   // use message if Error object, otherwise string
          userId: state
        }
      });
    }
  
  
    if (!code || !state) {
    return res.status(400).send('Missing \'code\' or \'state\' parameter.');
  }

  try {
    // Exchange code for tokens
    const clientId     = await getSecret('freeagent-client-id');
    const clientSecret = await getSecret('freeagent-client-secret');
    const redirectUri  = 'https://europe-west2-flair-freeagent.cloudfunctions.net/authCallback';

    const tokenResp = await fetch(
      'https://api.freeagent.com/v2/token_endpoint',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          grant_type:    'authorization_code',
          code,
          redirect_uri:  redirectUri,
          client_id:     clientId,
          client_secret: clientSecret,
        }),
      }
    );

    if (!tokenResp.ok) {
      const err = await tokenResp.text();
      await logTokenExchangeFailed(err); // Log the error
      return res.status(500).send('Failed to exchange code for token.');
    }

    const tokenData = await tokenResp.json();
    await db.collection('users').doc(state).set({
      access_token:  tokenData.access_token,
      refresh_token: tokenData.refresh_token,
      expires_in:    tokenData.expires_in,
      timestamp:     new Date().toISOString(),
    });

    // OPTIONAL: notify Glide
    const GLIDE_API_TOKEN  = await getSecret('glide-api-token');
    const GLIDE_APP_ID     = await getSecret('glide-app-id');
    const GLIDE_TABLE_NAME = await getSecret('glide-table-name');

    await fetch(
      `https://api.glideapps.com/apps/${GLIDE_APP_ID}/tables/${GLIDE_TABLE_NAME}/rows/${state}`,
      {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${GLIDE_API_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          'api-write/timestamp': new Date().toISOString(),
          'api-write/message':   'Authenticated',
        }),
      }
    );

    // Log the successful token exchange
    await writeLog({
      logName: 'oauth-log',
      functionName: 'authCallback',
      severity: 'INFO',
      event: 'Token Exchange Successful',
      data: {
        userId: state
      }
    });

    // Redirect back to your app
    return res.status(200).send(`
      <html><body>
        <script>
          window.location.href = 'https://receipts.flair.london';
        </script>
        <p>Redirecting… <a href="https://receipts.flair.london">Click here</a></p>
      </body></html>
    `);

  } catch (err) {
    await logTokenExchangeFailed(err); // Log the error
    return res.status(500).send('Unexpected error during OAuth process.');
  }
}

export { authCallback };
