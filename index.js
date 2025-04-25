// index.js
// ————————————————————————————
// 1) imports & wiring only

const functions            = require('@google-cloud/functions-framework');
const { authCallback }     = require('./auth');
const { adminDashboard }   = require('./dashboard');
const { freeAgentHandler } = require('./freeagent');

// 2) register each handler as its own HTTP function:
functions.http('authCallback',   authCallback);
functions.http('adminDashboard', adminDashboard);
functions.http('FreeAgent',      freeAgentHandler);