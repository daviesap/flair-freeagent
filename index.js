// 1) Pull in the handlers & helpers from your other files:
const { authCallback }         = require('./auth');          // auth.js exports { authCallback }
const { adminDashboard }       = require('./dashboard');     // dashboard.js exports { adminDashboard }
const { freeAgentHandler }     = require('./freeagent');     // freeagent.js exports { freeAgentHandler }
const { getSecret }            = require('./secrets');       // secrets.js exports { getSecret }
const { refreshTokenIfNeeded } = require('./token-utils');   // token-utils.js exports { refreshTokenIfNeeded }

// 2) Grab the Cloud Functions Framework so we can register HTTP endpoints:
const functions = require('@google-cloud/functions-framework');

// 3) “Wire up” each named export as its own HTTP-triggered function:
//    functions.http('<name>', <your handler function>);
functions.http('authCallback',     authCallback);
functions.http('adminDashboard',   adminDashboard);
functions.http('FreeAgent',        freeAgentHandler);
