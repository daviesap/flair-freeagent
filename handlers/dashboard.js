
// dashboard.js - serves a simple admin dashboard displaying tokens and expiry times

// === IMPORTS ===
const { Firestore } = require('@google-cloud/firestore');
//const functions     = require('@google-cloud/functions-framework');

// Initialize Firestore client
const db = new Firestore();

/**
 * HTTP Cloud Function to render an admin dashboard of stored OAuth tokens
 */
async function adminDashboard(req, res) {
  try {
    // Fetch all user docs
    const snapshot = await db.collection('users').get();
    const tokens = {};
    snapshot.forEach(doc => {
      tokens[doc.id] = doc.data();
    });

    // Send minimal HTML page
    res.status(200).send(
      `<!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>Flair Admin Dashboard</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 20px; }
          pre { background: #f4f4f4; padding: 10px; border-radius: 4px; }
        </style>
      </head>
      <body>
        <h1>Flair Admin Dashboard</h1>
        <p>Stored user tokens and metadata:</p>
        <pre>${JSON.stringify(tokens, null, 2)}</pre>
      </body>
      </html>`
    );
  } catch (err) {
    console.error('Dashboard error:', err);
    res.status(500).send('Failed to fetch token data.');
  }
}

// Export the handler so index.js can wire it up
module.exports = { adminDashboard };
