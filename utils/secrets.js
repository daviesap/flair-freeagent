// utils/secrets.js
const { SecretManagerServiceClient } = require('@google-cloud/secret-manager');
const client = new SecretManagerServiceClient();

async function getSecret(name) {
  const [version] = await client.accessSecretVersion({
    name: `projects/${process.env.GOOGLE_CLOUD_PROJECT}/secrets/${name}/versions/latest`,
  });
  return version.payload.data.toString('utf8').trim();
}

module.exports = { getSecret };