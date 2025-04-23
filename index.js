const { SecretManagerServiceClient } = require('@google-cloud/secret-manager');

const client = new SecretManagerServiceClient();

exports.getSecretTest = async (req, res) => {
  try {
    const [idVersion] = await client.accessSecretVersion({
      name: 'projects/flair-december-2024/secrets/freeagent-client-id/versions/latest',
    });

    const [secretVersion] = await client.accessSecretVersion({
      name: 'projects/flair-december-2024/secrets/freeagent-client-secret/versions/latest',
    });

    const clientId = idVersion.payload.data.toString('utf8');
    const clientSecret = secretVersion.payload.data.toString('utf8');

    res.status(200).send({
      clientId,
      clientSecret
    });
  } catch (err) {
    console.error('Error accessing secrets:', err.message);
    res.status(500).send(`Failed to retrieve secrets: ${err.message}`);
  }
};