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
  return version.payload.data.toString('utf8');
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

// === FUNCTION: AUTH CALLBACK ===
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

    res.status(200).send(`
      <h1>✅ Token Stored</h1>
      <p><strong>User ID:</strong> ${state}</p>
      <pre>${JSON.stringify(tokenData, null, 2)}</pre>
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
    snapshot.forEach(doc => tokens[doc.id] = doc.data());

    res.status(200).send(`
      <h1>Flair Admin Dashboard</h1>
      <p><strong>Stored tokens:</strong></p>
      <pre>${JSON.stringify(tokens, null, 2)}</pre>
    `);
  } catch (err) {
    console.error("Dashboard error:", err.message);
    res.status(500).send("Failed to fetch token data.");
  }
});


functions.http('testRefresh', async (req, res) => {
    const userId = req.query.userId;
    if (!userId) return res.status(400).send("Missing userId");
  
    try {
      const token = await refreshTokenIfNeeded(userId);
      res.status(200).send(`
        <h1>✅ Token after refresh check</h1>
        <p>User ID: ${userId}</p>
        <pre>${token}</pre>
      `);
    } catch (err) {
      console.error("Refresh test error:", err.message);
      res.status(500).send(`❌ Refresh test failed: ${err.message}`);
    }
  });