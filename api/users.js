// Gestione accessi (Firebase Authentication) dall'app: crea, aggiorna, elimina utenti.
// Richiede su Vercel la variabile d'ambiente FIREBASE_SERVICE_ACCOUNT (contenuto del file JSON dell'account di servizio)
// e la dipendenza "firebase-admin" in package.json. Solo chi e' amministratore puo' chiamarla.
const admin = require('firebase-admin');
const SUFFIX = '@pasiniracing.app';

function init() {
  if (admin.apps.length) return;
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!raw) throw new Error('FIREBASE_SERVICE_ACCOUNT non configurata');
  admin.initializeApp({ credential: admin.credential.cert(JSON.parse(raw)) });
}

function sameSite(req) {
  const host = req.headers['x-forwarded-host'] || req.headers.host || '';
  const src = req.headers.origin || req.headers.referer || '';
  try { return !!src && new URL(src).host === host; } catch (e) { return false; }
}

function claimsFor(p) {
  const perms = p.perms || {};
  return { admin: !!p.isAdmin, personId: p.id, costs: !!(p.isAdmin || perms.costs) };
}

async function upsert(p) {
  const username = String(p.username || '').trim().toLowerCase();
  const pin = String(p.pin || '').trim();
  if (!p.id || !username) throw new Error('id e username obbligatori');
  if (pin.length < 6) throw new Error('il codice deve avere almeno 6 caratteri');
  const data = { email: username + SUFFIX, password: pin, displayName: p.name || p.id, disabled: false };
  try { await admin.auth().updateUser(p.id, data); }
  catch (e) {
    if (e.code === 'auth/user-not-found') await admin.auth().createUser(Object.assign({ uid: p.id }, data));
    else throw e;
  }
  await admin.auth().setCustomUserClaims(p.id, claimsFor(p));
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (!sameSite(req)) return res.status(403).json({ error: 'Origine non consentita' });
  try {
    init();
    const token = (req.headers.authorization || '').replace(/^Bearer /, '');
    if (!token) return res.status(401).json({ error: 'Login mancante' });
    const caller = await admin.auth().verifyIdToken(token);
    if (caller.admin !== true) return res.status(403).json({ error: 'Solo gli amministratori' });

    const b = req.body || {};
    if (b.action === 'upsert') { await upsert(b.person || {}); return res.json({ ok: true }); }
    if (b.action === 'upsertMany') {
      let n = 0; const errors = [];
      for (const p of (b.people || [])) { try { await upsert(p); n++; } catch (e) { errors.push((p.name || p.id) + ': ' + e.message); } }
      return res.json({ ok: errors.length === 0, count: n, errors });
    }
    if (b.action === 'delete') {
      if (!b.id) return res.status(400).json({ error: 'id mancante' });
      if (b.id === caller.uid) return res.status(400).json({ error: 'Non puoi eliminare te stesso' });
      try { await admin.auth().deleteUser(b.id); } catch (e) { if (e.code !== 'auth/user-not-found') throw e; }
      return res.json({ ok: true });
    }
    if (b.action === 'prune') { // elimina tutti gli accessi tranne quelli indicati (e sempre chi chiama)
      const keep = new Set([caller.uid].concat(b.keep || []));
      let deleted = 0, pageToken;
      do {
        const page = await admin.auth().listUsers(1000, pageToken);
        const ids = page.users.map(u => u.uid).filter(id => !keep.has(id));
        if (ids.length) { await admin.auth().deleteUsers(ids); deleted += ids.length; }
        pageToken = page.pageToken;
      } while (pageToken);
      return res.json({ ok: true, deleted });
    }
    return res.status(400).json({ error: 'Azione sconosciuta' });
  } catch (e) {
    return res.status(500).json({ ok: false, error: e.message });
  }
};
