// freeagent.js - main HTTP handler for FreeAgent API operations

import fetch from 'node-fetch';
import { getSecret } from '../utils/secrets.js';
import { refreshTokenIfNeeded } from '../utils/token-utils.js';

/**
 * HTTP Cloud Function to handle various FreeAgent actions
 */
async function freeAgentHandler(req, res) {

  const {
    action, userId, api_key,
    bank_account, bankAccount,
    bankTransactionUrl, explanationUrl,
    gross_value, dated_on,
    description, category,
    attachment, htmlBody
  } = req.body || {};

  if (!action || !userId || !api_key) {
    return res.status(400).json({
      success: false,
      message: 'Missing required fields (action, userId, api_key).',
      timestamp: new Date().toISOString(),
    });
  }

  // Verify API key
  const expectedKey = await getSecret('flair-receipts-api-key');
  if (api_key.trim() !== expectedKey.trim()) {
    return res.status(403).json({
      success: false,
      message: 'Invalid api_key',
      timestamp: new Date().toISOString(),
    });
  }

  try {
    // Ensure valid FreeAgent access token
    const accessToken = await refreshTokenIfNeeded(userId);
    const headers = { Authorization: `Bearer ${accessToken}` };

    switch (action) {
      case 'getInfo': {
        // Fetch multiple endpoints in parallel
        const urls = [
          'https://api.freeagent.com/v2/company',
          'https://api.freeagent.com/v2/users/me',
          'https://api.freeagent.com/v2/categories',
          'https://api.freeagent.com/v2/bank_accounts',
          'https://api.freeagent.com/v2/projects?view=active'
        ];
        const [company, me, cats, banks, projects] = await Promise.all(
          urls.map(u => fetch(u, { headers }).then(r => r.json()))
        );
        return res.status(200).json({
          success: true,
          message: 'Fetched FreeAgent info successfully',
          timestamp: new Date().toISOString(),
          data: { company, me, categories: cats, bank_accounts: banks, active_projects: projects }
        });
      }

      case 'getTransactions': {
        const acct = bank_account || bankAccount;
        if (!acct) {
          return res.status(400).json({
            success: false,
            message: 'Missing \'bank_account\' in request body.',
            timestamp: new Date().toISOString(),
          });
        }
        const url = `https://api.freeagent.com/v2/bank_transactions?bank_account=${encodeURIComponent(acct)}&per_page=100`;
        const resp = await fetch(url, { headers });
        if (!resp.ok) {
          const t = await resp.text();
          return res.status(resp.status).json({
            success: false,
            message: `FreeAgent API error: ${t}`,
            timestamp: new Date().toISOString(),
          });
        }
        const data = await resp.json();
        return res.status(200).json({
          success: true,
          message: 'Fetched transactions successfully',
          timestamp: new Date().toISOString(),
          data
        });
      }

      case 'attachReceipt': {
        if (!bankTransactionUrl || !(attachment || htmlBody) || !category) {
          return res.status(400).json({
            success: false,
            message: 'Missing required fields: bankTransactionUrl, (attachment or htmlBody), category',
            timestamp: new Date().toISOString(),
          });
        }
        // Prepare URL paths for FreeAgent
        const txPath = new URL(bankTransactionUrl).pathname;
        const catPath = new URL(category).pathname;
        const delPath = explanationUrl ? new URL(explanationUrl).pathname : null;

        // Delete existing explanation if present
        if (delPath) {
          const d = await fetch(`https://api.freeagent.com${delPath}`, { method: 'DELETE', headers });
          if (!d.ok) console.warn('delete failed:', await d.text());
        }

        // Build attachment payload
        let attachmentPayload;
        if (attachment) {
          const f = await fetch(attachment);
          const buf = await f.arrayBuffer();
          attachmentPayload = {
            data: Buffer.from(buf).toString('base64'),
            content_type: f.headers.get('content-type') || 'application/octet-stream',
            file_name: attachment.split('/').pop().split('?')[0]
          };
        } else {
          attachmentPayload = {
            data: Buffer.from(htmlBody).toString('base64'),
            content_type: 'text/html',
            file_name: 'attachment.html'
          };
        }

        // Construct and POST the explanation
        const payload = { bank_transaction_explanation: {
          bank_transaction: txPath,
          dated_on:         dated_on,
          description:      description,
          gross_value:      gross_value,
          explanation_amount: gross_value,
          category:         catPath,
          attachment:       attachmentPayload
        }};

        const cr = await fetch(
          'https://api.freeagent.com/v2/bank_transaction_explanations',
          {
            method: 'POST',
            headers: { ...headers, 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          }
        );
        if (!cr.ok) {
          const t = await cr.text();
          return res.status(cr.status).json({
            success: false,
            message: `FreeAgent API error: ${t}`,
            timestamp: new Date().toISOString(),
          });
        }

        return res.status(200).json({
          info: {
            success: true,
            timestamp: new Date().toISOString(),
            message: 'Receipt attached to FreeAgent transaction'
          },
          payload: {}
        });
      }

      default:
        return res.status(400).json({
          success: false,
          message: `Unsupported action '${action}'`,
          timestamp: new Date().toISOString(),
        });
    }
  } catch (err) {
    console.error('FreeAgent handler error:', err);
    return res.status(500).json({
      success: false,
      message: 'Unexpected error.',
      timestamp: new Date().toISOString(),
    });
  }
}

export { freeAgentHandler };
