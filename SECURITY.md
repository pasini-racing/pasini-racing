# Sicurezza e gestione accessi

## Come funziona ora
- Gli utenti si creano, modificano ed eliminano dalla pagina Team (⚙️). Per ognuno si imposta: ruolo di lavoro, amministratore si/no e permessi singoli
  (vede prenotazioni di tutti, checklist, costi, pianificatore voli, export).
- Il login usa Firebase Authentication (email `username@pasiniracing.app` + codice). Se l'utente non e' ancora in Authentication
  vale il vecchio accesso, cosi' nulla si blocca durante il passaggio.
- `api/users.js` allinea gli accessi quando crei, modifichi o elimini un utente dall'app. Serve la variabile Vercel
  `FIREBASE_SERVICE_ACCOUNT` e la dipendenza `firebase-admin` in `package.json`.
- `api/claude.js`: solo richieste dal sito stesso, modello e token limitati, limite richieste per IP.
- Reset totale (Team, in fondo): backup obbligatorio, conferma scrivendo RESET, cancella tutto e tutti gli utenti tranne chi lo esegue.

## Attivazione, una volta sola
1. Firebase Console > Authentication > Metodo di accesso: attiva **Email/password**.
2. Firebase Console > Impostazioni progetto > Account di servizio > Genera nuova chiave privata (scarica un file .json).
3. Vercel > progetto > Settings > Environment Variables: crea `FIREBASE_SERVICE_ACCOUNT` e incolla **tutto il contenuto** del file .json. Poi Redeploy.
4. Crea il tuo accesso admin in Authentication con lo script `scripts/sync-auth-users.js` (istruzioni in testa al file): serve una volta sola, per il primo admin.
5. Prova il login. Da ora ogni utente creato dall'app ha subito l'accesso.
6. Solo dopo: incolla `firestore.rules` in Firebase Console > Firestore > Regole.
   (Se le incolli prima di avere gli accessi in Authentication l'app si blocca.)

## Limiti noti
- Ogni membro loggato puo' leggere l'anagrafica (compresi i documenti). Per nasconderli servirebbe una collezione separata.
- I permessi (costi, voli, export...) nascondono le pagine nell'app; i costi sono protetti anche dalle regole Firestore.
- Il file `firebase-admin` e la chiave dell'account di servizio non vanno mai caricati su GitHub.
