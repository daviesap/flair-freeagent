const { SecretManagerServiceClient } = require('@google-cloud/secret-manager');
const fetch = require('node-fetch');

const client = new SecretManagerServiceClient();

async function getSecret(name) {
  const [version] = await client.accessSecretVersion({
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

    const redirectUri = "https://flair-receipts-513031796891.europe-west2.run.app"; // Replace with your Cloud Function's URL

    const response = await fetch("https://api.freeagent.com/v2/token_endpoint", {
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

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Token exchange failed:", errorText);
      return res.status(500).send("Failed to exchange code for token.");
    }

    const tokenData = await response.json();

    // 🧪 For testing only: display the result
    res.status(200).send(`
      <h1>Token Received from FreeAgent</h1>
      <p><strong>User ID (state):</strong> ${state}</p>
      <pre>${JSON.stringify(tokenData, null, 2)}</pre>
    `);

    // 🔜 TODO: Store tokens in Firestore or update Glide

  } catch (err) {
    console.error("OAuth handler error:", err.message);
    res.status(500).send("Unexpected error during OAuth process.");
  }
};