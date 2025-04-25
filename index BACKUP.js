// === IMPORTS ===
const { SecretManagerServiceClient } = require('@google-cloud/secret-manager');
const { Firestore }                  = require('@google-cloud/firestore');
const fetch                          = require('node-fetch');
const functions                      = require('@google-cloud/functions-framework');

const secretsClient = new SecretManagerServiceClient();
const db            = new Firestore();

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
  const { access_token, refresh_token, expires_in, timestamp } = userDoc.data();
  const elapsed = (Date.now() - new Date(timestamp)) / 1000;
  if (elapsed < expires_in - 60) {
    return access_token;
  }
  const clientId     = await getSecret('freeagent-client-id');
  const clientSecret = await getSecret('freeagent-client-secret');
  const resp = await fetch('https://api.freeagent.com/v2/token_endpoint', {
    method: 'POST',
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
  const nt = await resp.json();
  const updated = {
    access_token:  nt.access_token,
    refresh_token: nt.refresh_token || refresh_token,
    expires_in:    nt.expires_in,
    timestamp:     new Date().toISOString(),
  };
  await db.collection('users').doc(userId).set(updated, { merge: true });
  return updated.access_token;
}

// === FUNCTION: AUTH CALLBACK ===
functions.http('authCallback', async (req, res) => {
  const { code, state } = req.query;
  if (!code || !state) {
    return res.status(400).send("Missing 'code' or 'state' parameter.");
  }
  try {
    const clientId     = await getSecret('freeagent-client-id');
    const clientSecret = await getSecret('freeagent-client-secret');
    const redirectUri  = 'https://europe-west2-flair-december-2024.cloudfunctions.net/authCallback';
    const tokenResp    = await fetch('https://api.freeagent.com/v2/token_endpoint', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type:    'authorization_code',
        code,
        redirect_uri:  redirectUri,
        client_id:     clientId,
        client_secret: clientSecret,
      }),
    });
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
    await fetch(`https://api.glideapps.com/apps/${GLIDE_APP_ID}/tables/${GLIDE_TABLE_NAME}/rows/${state}`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${GLIDE_API_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        'api-write/timestamp': new Date().toISOString(),
        'api-write/message':   'Authenticated',
      }),
    });

    res.status(200).send(`
      <html><body>
        <script>window.location.href='https://receipts.flair.london';</script>
        Redirecting…
      </body></html>
    `);
  } catch (err) {
    console.error('OAuth handler error:', err);
    res.status(500).send('Unexpected error during OAuth process.');
  }
});

// === FUNCTION: ADMIN DASHBOARD ===
functions.http('adminDashboard', async (req, res) => {
  try {
    const snapshot = await db.collection('users').get();
    const tokens   = {};
    snapshot.forEach(doc => tokens[doc.id] = doc.data());
    res.status(200).send(`
      <h1>Flair Admin Dashboard</h1>
      <pre>${JSON.stringify(tokens, null, 2)}</pre>
    `);
  } catch (err) {
    console.error('Dashboard error:', err);
    res.status(500).send('Failed to fetch token data.');
  }
});

// === FUNCTION: FREEAGENT MAIN HANDLER ===
functions.http('FreeAgent', async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({
      success: false,
      message: 'Only POST supported.'
    });
  }

  const {
    action, userId, api_key,
    bank_account, bankAccount,
    bankTransactionUrl, explanationUrl,
    gross_value, dated_on,
    description, category,
    attachment, htmlBody
  } = req.body || {};

  if (!action || !userId || !api_key) {
    return res.status(400).json({
      success:   false,
      message:   "Missing required fields (action, userId, api_key).",
      timestamp: new Date().toISOString(),
    });
  }

  const expectedKey = await getSecret('flair-receipts-api-key');
  if (api_key.trim() !== expectedKey.trim()) {
    return res.status(403).json({
      success:   false,
      message:   'Invalid api_key',
      timestamp: new Date().toISOString(),
    });
  }

  try {
    const accessToken = await refreshTokenIfNeeded(userId);
    const headers     = { Authorization: `Bearer ${accessToken}` };

    switch (action) {
      case 'getInfo': {
        const urls = [
          'https://api.freeagent.com/v2/company',
          'https://api.freeagent.com/v2/users/me',
          'https://api.freeagent.com/v2/categories',
          'https://api.freeagent.com/v2/bank_accounts',
          'https://api.freeagent.com/v2/projects?view=active'
        ];
        const [ company, me, cats, banks, projects ] = await Promise.all(
          urls.map(u => fetch(u, { headers }).then(r => r.json()))
        );
        return res.status(200).json({
          success:   true,
          message:   'Fetched FreeAgent info successfully',
          timestamp: new Date().toISOString(),
          data:      { company, me, categories: cats, bank_accounts: banks, active_projects: projects }
        });
      }

      case 'getTransactions': {
        const acct = bank_account || bankAccount;
        if (!acct) {
          return res.status(400).json({
            success:   false,
            message:   "Missing 'bank_account' in request body.",
            timestamp: new Date().toISOString(),
          });
        }
        const url  = `https://api.freeagent.com/v2/bank_transactions?bank_account=${encodeURIComponent(acct)}&per_page=100`;
        const resp = await fetch(url, { headers });
        if (!resp.ok) {
          const t = await resp.text();
          return res.status(resp.status).json({
            success:   false,
            message:   `FreeAgent API error: ${t}`,
            timestamp: new Date().toISOString(),
          });
        }
        const data = await resp.json();
        return res.status(200).json({
          success:   true,
          message:   'Fetched transactions successfully',
          timestamp: new Date().toISOString(),
          data
        });
      }

      case 'attachReceipt': {
        if (!bankTransactionUrl || !(attachment || htmlBody) || !category) {
          return res.status(400).json({
            success:   false,
            message:   "Missing required fields: bankTransactionUrl, (attachment or htmlBody), category",
            timestamp: new Date().toISOString(),
          });
        }
        try {
          const txPath  = new URL(bankTransactionUrl).pathname;
          const catPath = new URL(category).pathname;
          const delPath = explanationUrl ? new URL(explanationUrl).pathname : null;

          if (delPath) {
            const d = await fetch(`https://api.freeagent.com${delPath}`, { method: 'DELETE', headers });
            if (!d.ok) console.warn('delete failed:', await d.text());
          }

          let attachmentPayload;
          if (attachment) {
            const f = await fetch(attachment);
            const buf = await f.arrayBuffer();
            attachmentPayload = {
              data:         Buffer.from(buf).toString('base64'),
              content_type: f.headers.get('content-type') || 'application/octet-stream',
              file_name:    attachment.split('/').pop().split('?')[0]
            };
          } else {
            attachmentPayload = {
              data:         Buffer.from(htmlBody).toString('base64'),
              content_type: 'text/html',
              file_name:    'attachment.html'
            };
          }

          const payload = {
            bank_transaction_explanation: {
              bank_transaction:   txPath,
              dated_on:           dated_on,
              description:        description,
              gross_value:        gross_value,
              explanation_amount: gross_value,
              category:           catPath,
              attachment:         attachmentPayload
            }
          };

          const cr = await fetch(
            'https://api.freeagent.com/v2/bank_transaction_explanations',
            {
              method:  'POST',
              headers: { ...headers, 'Content-Type': 'application/json' },
              body:    JSON.stringify(payload),
            }
          );
          if (!cr.ok) {
            const t = await cr.text();
            return res.status(cr.status).json({
              success:   false,
              message:   `FreeAgent API error: ${t}`,
              timestamp: new Date().toISOString(),
            });
          }

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

      default:
        return res.status(400).json({
          success:   false,
          message:   `Unsupported action '${action}'`,
          timestamp: new Date().toISOString(),
        });
    }
  } catch (err) {
    console.error('FreeAgent handler error:', err);
    return res.status(500).json({
      success:   false,
      message:   'Unexpected error.',
      timestamp: new Date().toISOString(),
    });
  }
});