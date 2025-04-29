/**
 * @file dashboard.js
 * @description HTTP Cloud Function to render the Flair Admin Dashboard, including:
 *   - Stored user tokens and their expiry
 *   - Google Cloud Function deploy times
 */

// Initialize Firestore client
import { Firestore } from '@google-cloud/firestore';
import { GoogleAuth } from 'google-auth-library';
import { writeLog } from '../utils/log.js';

const db = new Firestore();

/**
 * Helper to fetch deploy times of all HTTP-triggered functions
 */
async function fetchFunctionDeployTimes() {
  const auth = new GoogleAuth({
    scopes: 'https://www.googleapis.com/auth/cloud-platform',
  });

  const client = await auth.getClient();
  const region = 'europe-west2'; // Adjust if needed

  const url = `https://cloudfunctions.googleapis.com/v2/projects/${process.env.GOOGLE_CLOUD_PROJECT}/locations/${region}/functions`;

  const res = await client.request({ url });
  const functions = res.data.functions || [];

  const deployTimes = {};

  // Populate deployTimes
  functions.forEach(func => {
    const functionName = func.name.split('/').pop();
    deployTimes[functionName] = func.updateTime || null;
  });

  // Sort the deploy times
  const sortedDeployTimes = Object.keys(deployTimes)
    .sort()
    .reduce((obj, key) => {
      obj[key] = {
        deployTime: deployTimes[key]
      };
      return obj;
    }, {});

  return sortedDeployTimes;
}

/**
 * Format an ISO date string into human-readable form in Europe/London timezone.
 * Returns 'Unknown' for null/undefined, and preserves 'Never'.
 * @param {string|null} isoString
 * @returns {string}
 */
function formatDateTime(isoString) {
  if (isoString === null || isoString === undefined) return 'Unknown';
  if (isoString === 'Never') return 'Never';
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
 * Format a timestamp or date string into a relative expiry string
 * (e.g., 'in 5 min', 'Expired').
 * @param {string|Date|null} expiresAt
 * @returns {string}
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

// HTTP Cloud Function to render the admin dashboard
async function adminDashboard(req, res) {

  await writeLog({
    logName: 'dashboard-log',
    functionName: 'adminDashboard',
    severity: 'INFO',
    event: 'Serving dashboard'
  });
  
  try {
    const snapshot = await db.collection('users').get();
    const tokens = {};
    snapshot.forEach(doc => {
      tokens[doc.id] = doc.data();
    });

    const deployTimes = await fetchFunctionDeployTimes();

    // Build table rows for function metadata
    const functionTableRows = Object.entries(deployTimes).map(([funcName, data]) => `
      <tr>
        <td>${funcName}</td>
        <td>${formatDateTime(data.deployTime)}</td>
      </tr>
    `).join('');

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

    res.status(200).send(
      `<!DOCTYPE html>
      <html lang="en">
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
        <!-- Dashboard logo -->
        <img src="https://storage.googleapis.com/admin-dashboard-assets/flair-logo.png" alt="Flair Logo" style="height: 60px; margin-bottom: 20px;">
        <h1>Flair Admin Dashboard</h1>

        <h2>Service Info</h2>
        <ul>
          <li><strong>Revision:</strong> ${revision}</li>
        </ul>

        <h2>Deploy Times</h2>
        <table>
          <thead>
            <tr>
              <th>Function Name</th>
              <th>Deploy Time</th>
            </tr>
          </thead>
          <tbody>
            ${functionTableRows}
          </tbody>
        </table>

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
    await writeLog({
      logName: 'dashboard-log',
      functionName: 'adminDashboard',
      severity: 'ERROR',
      event: 'Failed to fetch dashboard data',
      data: {
        error: err
      }
    });
    res.status(500).send('Failed to fetch dashboard data.');
  }
}

export { adminDashboard };