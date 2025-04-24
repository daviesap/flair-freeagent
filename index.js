// === IMPORTS ===
const { SecretManagerServiceClient } = require('@google-cloud/secret-manager');
const { Firestore } = require('@google-cloud/firestore');
const fetch = require('node-fetch');
const functions = require('@google-cloud/functions-framework');

const secretsClient = new SecretManagerServiceClient();
const db = new Firestore();

// === UTILITY: GET SECRET ===
async function getSecret(name) {
  const [version] = await secretsClient.accessSecretVersion({
    name: `projects/flair-december-2024/secrets/${name}/versions/latest`,
  });
  return version.payload.data.toString('utf8').trim();
}

// === UTILITY: REFRESH TOKEN IF NEEDED ===
async function refreshTokenIfNeeded(userId) {
  const userDoc = await db.collection('users').doc(userId).get();
  if (!userDoc.exists) {
    throw new Error(`User ${userId} not found in Firestore.`);
  }
  const userData = userDoc.data();
  const expiresIn = userData.expires_in || 0;
  const timestamp = new Date(userData.timestamp);
  const now = new Date();
  const elapsed = (now - timestamp) / 1000;
  if (elapsed < expiresIn - 60) {
    return userData.access_token;
  }
  const clientId = await getSecret('freeagent-client-id');
  const clientSecret = await getSecret('freeagent-client-secret');
  const response = await fetch('https://api.freeagent.com/v2/token_endpoint', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: userData.refresh_token,
      client_id: clientId,
      client_secret: clientSecret,
    }),
  });
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to refresh token: ${errorText}`);
  }
  const newTokens = await response.json();
  const updatedData = {
    access_token: newTokens.access_token,
    refresh_token: newTokens.refresh_token || userData.refresh_token,
    expires_in: newTokens.expires_in,
    timestamp: new Date().toISOString(),
  };
  await db.collection('users').doc(userId).set(updatedData, { merge: true });
  return updatedData.access_token;
}

// === FUNCTION: AUTH CALLBACK (no API key check) ===
functions.http('authCallback', async (req, res) => {
  const { code, state } = req.query;
  if (!code || !state) {
    return res.status(400).send("Missing 'code' or 'state' parameter.");
  }
  try {
    const clientId = await getSecret('freeagent-client-id');
    const clientSecret = await getSecret('freeagent-client-secret');
    const redirectUri = 'https://europe-west2-flair-december-2024.cloudfunctions.net/authCallback';
    const tokenResponse = await fetch('https://api.freeagent.com/v2/token_endpoint', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: redirectUri,
        client_id: clientId,
        client_secret: clientSecret,
      }),
    });
    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      console.error('Token exchange failed:', errorText);
      return res.status(500).send('Failed to exchange code for token.');
    }
    const tokenData = await tokenResponse.json();
    await db.collection('users').doc(state).set({
      access_token: tokenData.access_token,
      refresh_token: tokenData.refresh_token,
      expires_in: tokenData.expires_in,
      timestamp: new Date().toISOString(),
    });
    // OPTIONAL: Notify Glide
    const GLIDE_API_TOKEN = await getSecret('glide-api-token');
    const GLIDE_APP_ID = await getSecret('glide-app-id');
    const GLIDE_TABLE_NAME = await getSecret('glide-table-name');
    const glideUrl = `https://api.glideapps.com/apps/${GLIDE_APP_ID}/tables/${GLIDE_TABLE_NAME}/rows/${state}`;
    await fetch(glideUrl, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${GLIDE_API_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        'api-write/timestamp': new Date().toISOString(),
        'api-write/message': 'Authenticated',
      }),
    });
    return res.status(200).send(`
      <html>
        <head><title>Redirecting...</title></head>
        <body>
          <script>window.location.href='https://receipts.flair.london';</script>
          <p>Redirecting… <a href='https://receipts.flair.london'>Click here</a> if needed.</p>
        </body>
      </html>
    `);
  } catch (err) {
    console.error('OAuth handler error:', err.message);
    res.status(500).send('Unexpected error during OAuth process.');
  }
});

// === FUNCTION: ADMIN DASHBOARD ===
functions.http('adminDashboard', async (req, res) => {
  try {
    const snapshot = await db.collection('users').get();
    const tokens = {};
    snapshot.forEach(doc => (tokens[doc.id] = doc.data()));
    res.status(200).send(`
      <h1>Flair Admin Dashboard</h1>
      <pre>${JSON.stringify(tokens, null, 2)}</pre>
    `);
  } catch (err) {
    console.error('Dashboard error:', err.message);
    res.status(500).send('Failed to fetch token data.');
  }
});

// === FUNCTION: FREEAGENT MAIN HANDLER ===
functions.http('FreeAgent', async (req, res) => {
  if (req.method !== 'POST') {
    return res
      .status(405)
      .json({ success: false, message: 'Only POST supported.' });
  }

  // Pull all expected fields from the JSON body
  const {
    action,
    userId,
    api_key,
    bank_account,
    bankAccount,
    bankTransactionUrl,
    explanationUrl,
    gross_value,
    dated_on,
    description,
    category,       // now matching your JSON
    attachment,
    htmlBody        // if you need it later
  } = req.body || {};

  // Basic validation
  if (!action || !userId || !api_key) {
    return res.status(400).json({
      success:   false,
      message:   "Missing required fields (action, userId, api_key).",
      timestamp: new Date().toISOString(),
    });
  }

  // Verify your own API key
  const expectedKey = await getSecret('flair-receipts-api-key');
  if (api_key.trim() !== expectedKey.trim()) {
    return res.status(403).json({
      success:   false,
      message:   'Invalid api_key',
      timestamp: new Date().toISOString(),
    });
  }

  try {
    // Ensure a valid FreeAgent access token
    const accessToken = await refreshTokenIfNeeded(userId);
    const headers     = { Authorization: `Bearer ${accessToken}` };

    switch (action) {
      // --- getInfo ---
      case 'getInfo': {
        const urls = [
          'https://api.freeagent.com/v2/company',
          'https://api.freeagent.com/v2/users/me',
          'https://api.freeagent.com/v2/categories',
          'https://api.freeagent.com/v2/bank_accounts',
          'https://api.freeagent.com/v2/projects?view=active',
        ];
        const [company, me, categories, bank_accounts, active_projects] =
          await Promise.all(urls.map(u => fetch(u, { headers }).then(r => r.json())));

        return res.status(200).json({
          success:   true,
          message:   'Fetched FreeAgent info successfully',
          timestamp: new Date().toISOString(),
          data: { company, me, categories, bank_accounts, active_projects },
        });
      }

      // --- getTransactions ---
      case 'getTransactions': {
        const account = bank_account || bankAccount;
        if (!account) {
          return res.status(400).json({
            success:   false,
            message:   "Missing 'bank_account' in request body.",
            timestamp: new Date().toISOString(),
          });
        }

        const url      = `https://api.freeagent.com/v2/bank_transactions?bank_account=${encodeURIComponent(account)}&per_page=100`;
        const response = await fetch(url, { headers });
        if (!response.ok) {
          const errText = await response.text();
          return res.status(response.status).json({
            success:   false,
            message:   `FreeAgent API error: ${errText}`,
            timestamp: new Date().toISOString(),
          });
        }
        const data = await response.json();
        return res.status(200).json({
          success:   true,
          message:   'Fetched transactions successfully',
          timestamp: new Date().toISOString(),
          data,
        });
      }

      // --- attachReceipt ---
      case 'attachReceipt': {
        // 1) Required fields for attachReceipt
        if (!bankTransactionUrl || !attachment || !category) {
          return res.status(400).json({
            success:   false,
            message:   "Missing required fields: bankTransactionUrl, attachment or category",
            timestamp: new Date().toISOString(),
          });
        }

        try {
          // 2) Delete existing explanation (if provided)
          if (explanationUrl) {
            const del = await fetch(explanationUrl, { method: 'DELETE', headers });
            if (!del.ok) {
              console.warn('Warning: delete explanation failed:', await del.text());
            }
          }

          // 3) Fetch the attachment and base64-encode it
          const fileResp = await fetch(attachment);
          if (!fileResp.ok) {
            throw new Error(`Failed to fetch attachment at ${attachment}`);
          }
          const arrayBuf   = await fileResp.arrayBuffer();
          const base64Data = Buffer.from(arrayBuf).toString('base64');

          // 4) Create a new bank_transaction_explanation with category + attachment
          const createResp = await fetch(
            'https://api.freeagent.com/v2/bank_transaction_explanations',
            {
              method: 'POST',
              headers: { ...headers, 'Content-Type': 'application/json' },
              body: JSON.stringify({
                bank_transaction_explanation: {
                  bank_transaction:    bankTransactionUrl,
                  explanation_amount:  gross_value,
                  dated_on:            dated_on,
                  description:         description,
                  category:            category,
                  attachment:          base64Data
                }
              }),
            }
          );

          if (!createResp.ok) {
            const errText = await createResp.text();
            console.error('📦 FreeAgent 422 response body:', errText);
            return res.status(createResp.status).json({
              success:   false,
              message:   `FreeAgent API error: ${errText}`,
              timestamp: new Date().toISOString(),
            });
          }

          // 5) Success response envelope
          return res.status(200).json({
            info: {
              success:   true,
              timestamp: new Date().toISOString(),
              message:   'Receipt attached to FreeAgent transaction'
            },
            payload: {}
          });
        } catch (err) {
          console.error('attachReceipt error:', err);
          return res.status(500).json({
            success:   false,
            message:   'Internal error in attachReceipt: ' + err.message,
            timestamp: new Date().toISOString(),
          });
        }
      }

      // --- unsupported action ---
      default:
        return res.status(400).json({
          success:   false,
          message:   `Unsupported action '${action}'`,
          timestamp: new Date().toISOString(),
        });
    }
  } catch (err) {
    console.error('FreeAgent handler error:', err.message);
    return res.status(500).json({
      success:   false,
      message:   'Unexpected error.',
      timestamp: new Date().toISOString(),
    });
  }
});