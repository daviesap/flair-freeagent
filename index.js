const { SecretManagerServiceClient } = require('@google-cloud/secret-manager');

const client = new SecretManagerServiceClient();

exports.getSecretTest = async (req, res) => {
  const secretName = req.query.name;

  if (!secretName) {
    return res.status(400).send("Please provide a secret name using ?name=YOUR_SECRET_NAME");
  }

  try {
    const [version] = await client.accessSecretVersion({
      name: `projects/flair-december-2024/secrets/${secretName}/versions/latest`,
    });

    const payload = version.payload.data.toString('utf8');

    res.status(200).send(`Secret "${secretName}": ${payload}`);
  } catch (err) {
    console.error('Error accessing secret:', err.message);
    res.status(500).send(`Failed to retrieve secret: ${err.message}`);
  }
};