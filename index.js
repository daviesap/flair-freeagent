// index.js

process.env.GOOGLE_CLOUD_PROJECT = 'flair-freeagent';

import { authCallback } from './handlers/auth.js';
import { adminDashboard } from './handlers/dashboard.js';
import { freeAgentHandler } from './handlers/freeagent.js';

export { authCallback, adminDashboard, freeAgentHandler as FreeAgent };