// auth.js
// Handles the OAuth callback from FreeAgent and stores tokens in Firestore

const { getSecret } = require('./secrets');
const { Firestore } = require('@google-cloud/firestore');
const fetch         = require('node-fetch');

// Initialize Firestore client
const db = new Firestore();

/**
 * Your auth callback handler.
 * Expects req.query.code and req.query.state.
 */
async function authCallback(req, res) {
  const { code, state } = req.query;
  if (!code || !state) {
    return res.status(400).send("Missing 'code' or 'state' parameter.");
  }

  try {
    // Exchange code for tokens
    const clientId     = await getSecret('freeagent-client-id');
    const clientSecret = await getSecret('freeagent-client-secret');
    const redirectUri  = 'https://europe-west2-flair-december-2024.cloudfunctions.net/authCallback';

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
      console.error('Token exchange failed:', err);
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
    console.error('OAuth handler error:', err);
    return res.status(500).send('Unexpected error during OAuth process.');
  }
}

module.exports = { authCallback };