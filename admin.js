const { Firestore } = require('@google-cloud/firestore');
const db = new Firestore();

exports.adminDashboard = async (req, res) => {
  try {
    const snapshot = await db.collection('users').get();
    const users = [];

    snapshot.forEach(doc => {
      const data = doc.data();
      users.push({
        id: doc.id,
        expires_in: data.expires_in,
        timestamp: data.timestamp
      });
    });

    let html = `
      <h1>🔥 Admin Dashboard</h1>
      <table border="1" cellpadding="5">
        <tr><th>User ID</th><th>Expires In (s)</th><th>Saved At</th></tr>
        ${users.map(u => `<tr><td>${u.id}</td><td>${u.expires_in}</td><td>${u.timestamp}</td></tr>`).join('')}
      </table>
    `;

    res.status(200).send(html);
  } catch (err) {
    console.error("Admin error:", err);
    res.status(500).send("Error fetching users.");
  }
};