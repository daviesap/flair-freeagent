// index.js

const { authCallback }     = require('./handlers/auth');
const { adminDashboard }   = require('./handlers/dashboard');
//const { freeAgentHandler } = require('./handlers/freeagent');

exports.authCallback = authCallback;
exports.adminDashboard = adminDashboard;
//exports.FreeAgent = freeAgentHandler;;