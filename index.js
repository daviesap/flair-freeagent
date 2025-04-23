const { SecretManagerServiceClient } = require('@google-cloud/secret-manager');
const client = new SecretManagerServiceClient();

async function getSecret(secretName) {
  const [version] = await client.accessSecretVersion({
    name: `projects/flair-december-2024/secrets/${secretName}/versions/latest`
  });
  return version.payload.data.toString('utf8');
}

exports.getSecretTest = async (req, res) => {
  try {
    const clientId = await getSecret('freeagent-client-id');
    const clientSecret = await getSecret('freeagent-client-secret');

    res.status(200).send(`
      <h1>FreeAgent Secrets (for testing)</h1>
      <p><strong>Client ID:</strong> ${clientId}</p>
      <p><strong>Client Secret:</strong> ${clientSecret}</p>
    `);
  } catch (err) {
    console.error("Error accessing secrets:", err.message);
    res.status(500).send("Failed to access secrets.");
  }
};