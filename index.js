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
  // .trim() to avoid stray newlines/spaces
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

  const clientId = await getSecret("freeagent-client-id");
  const clientSecret = await getSecret("freeagent-client-secret");

  const response = await fetch("https://api.freeagent.com/v2/token_endpoint", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "refresh_token",
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
    const clientId = await getSecret("freeagent-client-id");
    const clientSecret = await getSecret("freeagent-client-secret");
    const redirectUri = "https://europe-west2-flair-december-2024.cloudfunctions.net/authCallback";

    const tokenResponse = await fetch("https://api.freeagent.com/v2/token_endpoint", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code,
        redirect_uri: redirectUri,
        client_id: clientId,
        client_secret: clientSecret,
      }),
    });

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      console.error("Token exchange failed:", errorText);
      return res.status(500).send("Failed to exchange code for token.");
    }

    const tokenData = await tokenResponse.json();

    await db.collection('users').doc(state).set({
      access_token: tokenData.access_token,
      refresh_token: tokenData.refresh_token,
      expires_in: tokenData.expires_in,
      timestamp: new Date().toISOString(),
    });

    // OPTIONAL: Notify Glide
    const GLIDE_API_TOKEN = await getSecret("glide-api-token");
    const GLIDE_APP_ID = await getSecret("glide-app-id");
    const GLIDE_TABLE_NAME = await getSecret("glide-table-name");
    const glideUrl = `https://api.glideapps.com/apps/${GLIDE_APP_ID}/tables/${GLIDE_TABLE_NAME}/rows/${state}`;
    const glidePayload = {
      "api-write/timestamp": new Date().toISOString(),
      "api-write/message": "Authenticated"
    };
    await fetch(glideUrl, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${GLIDE_API_TOKEN}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(glidePayload)
    });

    // Redirect the user back to your app
    return res.status(200).send(`
      <html>
        <head><title>Redirecting...</title></head>
        <body>
          <script>window.location.href="https://receipts.flair.london";</script>
          <p>Redirecting… <a href="https://receipts.flair.london">Click here</a> if not redirected.</p>
        </body>
      </html>
    `);
  } catch (err) {
    console.error("OAuth handler error:", err.message);
    res.status(500).send("Unexpected error during OAuth process.");
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
    console.error("Dashboard error:", err.message);
    res.status(500).send("Failed to fetch token data.");
  }
});

// === FUNCTION: FREEAGENT MAIN HANDLER ===
functions.http('FreeAgent', async (req, res) => {
  // Only POST supported
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: "Only POST supported." });
  }

  // Destructure required fields from JSON body
  const { userId, api_key, action, bank_account } = req.body || {};

  // Validate presence
  if (!userId || !api_key || !action) {
    return res.status(400).json({
      success: false,
      message: "Missing required fields in request body (userId, api_key, action).",
    });
  }

  // Debug logging to compare values
  const expectedKey = await getSecret("flair-api-key");
  console.log("🔍 Supplied API Key:", api_key);
  console.log("🔐 Stored  API Key:", expectedKey);

  if (api_key.trim() !== expectedKey.trim()) {
    return res.status(403).json({ success: false, message: "Invalid api_key" });
  }

  try {
    // Ensure valid access token
    const accessToken = await refreshTokenIfNeeded(userId);
    const headers = { Authorization: `Bearer ${accessToken}` };

    switch (action) {
      case 'getInfo': {
        const urls = [
          "https://api.freeagent.com/v2/company",
          "https://api.freeagent.com/v2/users/me",
          "https://api.freeagent.com/v2/categories",
          "https://api.freeagent.com/v2/bank_accounts",
          "https://api.freeagent.com/v2/projects?view=active"
        ];
        const [company, me, categories, bank_accounts, active_projects] = await Promise.all(
          urls.map(u => fetch(u, { headers }).then(r => r.json()))
        );
        return res.status(200).json({
          success: true,
          message: "Fetched FreeAgent info successfully",
          timestamp: new Date().toISOString(),
          data: { company, me, categories, bank_accounts, active_projects }
        });
      }

      case 'getTransactions': {
        if (!bank_account) {
          return res.status(400).json({ success: false, message: "Missing 'bank_account' in request body." });
        }
        const url = `https://api.freeagent.com/v2/bank_transactions?bank_account=${bank_account}&per_page=100`;
        const data = await fetch(url, { headers }).then(r => r.json());
        return res.status(200).json({
          success: true,
          message: "Fetched transactions successfully",
          timestamp: new Date().toISOString(),
          data
        });
      }

      default:
        return res.status(400).json({ success: false, message: `Unsupported action '${action}'` });
    }
  } catch (err) {
    console.error("FreeAgent handler error:", err.message);
    return res.status(500).json({ success: false, message: "Unexpected error." });
  }
});