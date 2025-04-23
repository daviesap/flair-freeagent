const { SecretManagerServiceClient } = require('@google-cloud/secret-manager');
const { Firestore } = require('@google-cloud/firestore');
const fetch = require('node-fetch');

const secretsClient = new SecretManagerServiceClient();
const db = new Firestore();

async function getSecret(name) {
  const [version] = await secretsClient.accessSecretVersion({
    name: `projects/flair-december-2024/secrets/${name}/versions/latest`,
  });
  return version.payload.data.toString('utf8');
}

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

    // 🔐 Store tokens in Firestore using `state` as user ID
    await db.collection('users').doc(state).set({
      access_token: tokenData.access_token,
      refresh_token: tokenData.refresh_token,
      expires_in: tokenData.expires_in,
      timestamp: new Date().toISOString()
    });

    // ✅ Success message
    res.status(200).send(`
      <h1>Tokens stored in Firestore</h1>
      <p>User ID: <strong>${state}</strong></p>
      <pre>${JSON.stringify(tokenData, null, 2)}</pre>
    `);
  } catch (err) {
    console.error("OAuth handler error:", err);
    res.status(500).send(`
      <h1>Unexpected error during OAuth process</h1>
      <p><strong>Message:</strong> ${err.message}</p>
      <pre>${err.stack}</pre>
    `);
  }
};