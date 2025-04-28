// dashboard.js - fully cleaned and polished Flair Admin Dashboard

const { logAccessTime } = require('../utils/logAccessTime'); 
const { Firestore } = require('@google-cloud/firestore');
const { GoogleAuth } = require('google-auth-library');

// Initialize Firestore client
const db = new Firestore();

/**
 * Helper to fetch deploy times and last accessed times of all HTTP-triggered functions
 */
async function fetchFunctionDeployTimes() {
  const auth = new GoogleAuth({
    scopes: 'https://www.googleapis.com/auth/cloud-platform',
  });

  const client = await auth.getClient();
  const projectId = await auth.getProjectId();
  const region = 'europe-west2'; // Adjust if needed

  const url = `https://cloudfunctions.googleapis.com/v2/projects/${projectId}/locations/${region}/functions`;

  const res = await client.request({ url });
  const functions = res.data.functions || [];

  const deployTimes = {};
  const lastAccessedTimes = {}; // To store last accessed times from Firestore

  for (const func of functions) {
    const nameParts = func.name.split('/');
    const functionName = nameParts[nameParts.length - 1];

    // Get deploy time from the API
    deployTimes[functionName] = func.updateTime || 'Unknown';

    // Fetch last accessed time from Firestore
    const metadataSnapshot = await db.collection('metadata').doc(functionName).get();
    const lastAccessed = metadataSnapshot.exists ? metadataSnapshot.data().last_accessed_at : 'Never';
    lastAccessedTimes[functionName] = lastAccessed;
  }

  // Sort the deploy times and last accessed times
  const sortedDeployTimes = Object.keys(deployTimes)
    .sort()
    .reduce((obj, key) => {
      obj[key] = {
        deployTime: deployTimes[key],
        lastAccessedTime: lastAccessedTimes[key], // Include last accessed time
      };
      return obj;
    }, {});

  return sortedDeployTimes;
}

/**
 * Helper to format both deploy times and last access times nicely
 */
function formatDateTime(isoString) {
  if (!isoString) return 'Unknown';
  try {
    const options = {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
      timeZone: 'Europe/London' // Adjust to your preferred timezone
    };
    const date = new Date(isoString);
    return date.toLocaleString('en-GB', options).replace(',', ' at');
  } catch {
    return 'Invalid date';
  }
}

/**
 * Helper to format token expiry times nicely
 */
function formatExpiry(expiresAt) {
  if (!expiresAt) return 'Unknown';
  const expiryDate = new Date(expiresAt);
  if (isNaN(expiryDate)) return 'Invalid date';

  const now = new Date();
  const diffMs = expiryDate - now;
  const diffMinutes = diffMs / (1000 * 60);
  const diffHours = diffMinutes / 60;
  const diffDays = diffHours / 24;

  if (diffMinutes <= 0) return 'Expired';
  if (diffMinutes < 60) return `in ${Math.round(diffMinutes)} min`;
  if (diffHours < 24) return `in ${Math.round(diffHours)} hours`;
  return `in ${Math.round(diffDays)} days`;
}

/**
 * HTTP Cloud Function to render the admin dashboard
 */
async function adminDashboard(req, res) {
  // Log access time for adminDashboard
  await logAccessTime('adminDashboard');
  try {
    const snapshot = await db.collection('users').get();
    const tokens = {};
    snapshot.forEach(doc => {
      tokens[doc.id] = doc.data();
    });

    const deployTimesAndLastAccessed = await fetchFunctionDeployTimes(); // Fetch both deploy times and last accessed times

    const revision = process.env.K_REVISION || 'unknown';

    const tableHeader = `
      <tr>
        <th>User ID</th>
        <th>Access Token</th>
        <th>Expires At</th>
      </tr>
    `;

    let tableRows = '';
    for (const [userId, tokenData] of Object.entries(tokens)) {
      const accessToken = tokenData.access_token || 'N/A';
      const expiresAt = tokenData.expires_at || '';
      const nicelyFormattedExpiry = formatExpiry(expiresAt);

      tableRows += `
        <tr>
          <td>${userId}</td>
          <td style="word-break: break-all;">${accessToken}</td>
          <td>${nicelyFormattedExpiry}</td>
        </tr>
      `;
    }

    // Build deploy times and last accessed times lists
    const deployTimeList = Object.entries(deployTimesAndLastAccessed).map(([funcName, data]) => `
      <li><strong>${funcName} Deploy Time:</strong> ${formatDateTime(data.deployTime)}</li>
      <li><strong>${funcName} Last Accessed:</strong> ${formatDateTime(data.lastAccessedTime)}</li>
    `).join('');

    res.status(200).send(
      `<!DOCTYPE html>
      <html lang="en">
      <img src="https://storage.googleapis.com/admin-dashboard-assets/flair-logo.png" alt="Flair Logo" style="height: 60px; margin-bottom: 20px;">
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>Flair Admin Dashboard</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 20px; }
          table { width: 100%; border-collapse: collapse; margin-top: 20px; }
          th, td { border: 1px solid #ccc; padding: 8px; text-align: left; vertical-align: top; }
          th { background-color: #eee; }
          td { word-break: break-word; }
        </style>
      </head>
      <body>
        <h1>Flair Admin Dashboard</h1>

        <h2>Service Info</h2>
        <ul>
          <li><strong>Revision:</strong> ${revision}</li>
        </ul>

        <h2>Deploy Times and Last Accessed Times</h2>
        <ul>
          ${deployTimeList}
        </ul>

        <h2>Stored User Tokens</h2>
        <table>
          <thead>
            ${tableHeader}
          </thead>
          <tbody>
            ${tableRows}
          </tbody>
        </table>
      </body>
      </html>`
    );
  } catch (err) {
    console.error('Dashboard error:', err);
    res.status(500).send('Failed to fetch dashboard data.');
  }
}

module.exports = { adminDashboard };