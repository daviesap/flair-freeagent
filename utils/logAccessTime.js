// utils/logAccessTime.js
const { Firestore } = require('@google-cloud/firestore');
const db = new Firestore();

/**
 * Logs the access time and function name to Firestore
 * @param {string} functionName - The name of the function being accessed
 */
async function logAccessTime(functionName) {
  const currentTime = new Date().toISOString();

  try {
    // Log the function name and timestamp to Firestore
    await db.collection('metadata').doc(functionName).set({
      last_accessed_at: currentTime
    });

    console.log(`${functionName} access time logged successfully at ${currentTime}`);
  } catch (error) {
    console.error(`Error logging access time for ${functionName}:`, error);
  }
}

module.exports = { logAccessTime };