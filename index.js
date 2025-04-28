// index.js

process.env.GOOGLE_CLOUD_PROJECT = 'flair-freeagent';
const { authCallback }     = require('./handlers/auth');
const { adminDashboard }   = require('./handlers/dashboard');
const { freeAgentHandler } = require('./handlers/freeagent');

exports.authCallback = authCallback;
exports.adminDashboard = adminDashboard;
exports.FreeAgent = freeAgentHandler;;