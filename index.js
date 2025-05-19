// index.js

process.env.GOOGLE_CLOUD_PROJECT = 'flair-freeagent';

import { authCallback } from './handlers/auth.js';
import { freeAgentHandler } from './handlers/freeagent.js';

export { authCallback, freeAgentHandler as FreeAgent };