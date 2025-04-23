// index.js
const { Firestore } = require('@google-cloud/firestore');
const { SecretManagerServiceClient } = require('@google-cloud/secret-manager');
const fetch = require('node-fetch');
const db = new Firestore();
const secretsClient = new SecretManagerServiceClient();

// --- Helper to get secret ---
async function getSecret(name) {
  const [version] = await secretsClient.accessSecretVersion({
    name: `projects/flair-december-2024/secrets/${name}/versions/latest`,
  });
  return version.payload.data.toString('utf8');
}

// === 1. OAuth Handler ===
exports.authCallback = async (req, res) => {
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
        client_secret: clientSecret
      })
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
      timestamp: new Date().toISOString()
    });

    res.status(200).send(`
      ✅ <h1>Token Stored</h1>
      <p><strong>User ID:</strong> ${state}</p>
      <pre>${JSON.stringify(tokenData, null, 2)}</pre>
    `);
  } catch (err) {
    console.error("OAuth handler error:", err.message);
    res.status(500).send("Unexpected error during OAuth process.");
  }
};

// === 2. Admin Dashboard ===
exports.adminDashboard = async (req, res) => {
  try {
    const snapshot = await db.collection('users').get();
    let html = `
      <h1>Flair Admin Dashboard</h1>
      <p>Stored tokens:</p>
      <ul>
    `;

    snapshot.forEach(doc => {
      const data = doc.data();
      html += `<li><strong>${doc.id}</strong><br><pre>${JSON.stringify(data, null, 2)}</pre></li>`;
    });

    html += '</ul>';
    res.status(200).send(html);
  } catch (err) {
    console.error("Dashboard error:", err.message);
    res.status(500).send("Error fetching user data.");
  }
};