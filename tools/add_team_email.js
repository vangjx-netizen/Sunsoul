// Adds a Gmail to the Sunsoul team (teamEmails/{email}) using the project's service-account key.
// Used by .github/workflows/team-email.yml, for when nobody on the team can sign in to add someone
// (for example after the only team device logged out). Normally the team adds people in Settings.
const admin = require('firebase-admin');

const email = String(process.env.EMAIL || '').trim().toLowerCase();
if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) { console.error('Not an e-mail address.'); process.exit(1); }
const key = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT || '{}');
if (!key.project_id) { console.error('FIREBASE_SERVICE_ACCOUNT is missing.'); process.exit(1); }

admin.initializeApp({ credential: admin.credential.cert(key), projectId: key.project_id });
admin.firestore().doc('teamEmails/' + email).set({ addedAt: Date.now(), by: 'github-action' }, { merge: true })
  .then(() => { console.log('Added to the team. Sign in with Google using that Gmail.'); process.exit(0); })
  .catch(e => { console.error(e.message); process.exit(1); });
