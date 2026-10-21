// Crea/aggiorna gli utenti Firebase Authentication a partire dall'anagrafica (collezione "people").
// Uso (sul tuo computer, una volta e ogni volta che aggiungi persone o cambi un codice):
//   cd scripts && npm install
//   GOOGLE_APPLICATION_CREDENTIALS=/percorso/serviceAccount.json node sync-auth-users.js
// Il file serviceAccount.json si scarica da Firebase Console > Impostazioni progetto > Account di servizio.
// NON caricarlo su GitHub.
const admin = require('firebase-admin');
admin.initializeApp({ credential: admin.credential.applicationDefault(), projectId: 'pasini-racing' });
const SUFFIX = '@pasiniracing.app';

(async () => {
  const snap = await admin.firestore().collection('people').get();
  let ok = 0, skipped = [];
  for (const d of snap.docs) {
    const p = d.data(); const id = d.id;
    const username = (p.username || '').trim().toLowerCase();
    const pin = (p.pin || '').trim();
    if (!username || pin.length < 6) { skipped.push(`${p.name || id} (username o codice mancante/troppo corto)`); continue; }
    const user = { email: username + SUFFIX, password: pin, displayName: p.name || id, disabled: false };
    try { await admin.auth().updateUser(id, user); }
    catch (e) {
      if (e.code === 'auth/user-not-found') await admin.auth().createUser(Object.assign({ uid: id }, user));
      else { skipped.push(`${p.name || id}: ${e.message}`); continue; }
    }
    await admin.auth().setCustomUserClaims(id, { admin: !!p.isAdmin, personId: id });
    ok++;
  }
  console.log(`Utenti sincronizzati: ${ok}`);
  if (skipped.length) console.log('Saltati:\n - ' + skipped.join('\n - '));
  process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });
