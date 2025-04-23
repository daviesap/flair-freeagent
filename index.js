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


async function refreshTokenIfNeeded(userId) {
  const userDoc = await db.collection('users').doc(userId).get();
  if (!userDoc.exists) {
    throw new Error(`User ${userId} not found in Firestore.`);
  }

  const userData = userDoc.data();
  const expiresIn = userData.expires_in || 0;
  const timestamp = new Date(userData.timestamp);
  const now = new Date();
  const elapsed = (now - timestamp) / 1000; // seconds

  if (elapsed < expiresIn - 60) {
    // ⏱ Still valid
    return userData.access_token;
  }

  // 🔄 Need to refresh
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

module.exports = { refreshTokenIfNeeded };