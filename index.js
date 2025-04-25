// index.js
// ————————————————————————————
// 1) imports & wiring only

const functions            = require('@google-cloud/functions-framework');
const { authCallback }     = require('./handlers/auth');
const { adminDashboard }   = require('./handlers/dashboard');
const { freeAgentHandler } = require('./handlers/freeagent');

// 2) register each handler as its own HTTP function:
functions.http('authCallback',   authCallback);
functions.http('adminDashboard', adminDashboard);
functions.http('FreeAgent',      freeAgentHandler);