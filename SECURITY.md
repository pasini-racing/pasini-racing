# Sicurezza - stato e passi

## Gia' nel codice
- `api/claude.js`: solo richieste dal sito stesso, modello e token limitati, limite richieste per IP.
- Login con **Firebase Authentication** (email `username@pasiniracing.app` + codice). Se l'utente non esiste ancora in Authentication
  l'app usa il vecchio accesso, quindi nulla si rompe durante la transizione.
- Backup JSON dall'area admin (Team), controllo scadenze documenti, cache offline.

## Come attivare la protezione (in quest'ordine)
1. In Firebase Console > Authentication > Metodo di accesso: attiva **Email/password**.
2. Cambia i codici deboli dall'app (schema `Nome124@`), minimo 6 caratteri.
3. Scarica la chiave dell'account di servizio (Impostazioni progetto > Account di servizio) e lancia `scripts/sync-auth-users.js`
   (istruzioni in testa al file). Va rilanciato ogni volta che aggiungi una persona o cambi un codice.
4. Pubblica il nuovo codice, prova il login con un admin e con un utente normale.
5. Solo dopo: incolla `firestore.rules` in Firebase Console > Firestore > Regole.
6. Facoltativo: limite di spesa sulla chiave Anthropic in Vercel.

## Limiti noti
- Ogni membro loggato puo' leggere l'anagrafica (compresi documenti). Per nasconderli serve una collezione separata.
- Il cambio codice dal proprio profilo aggiorna solo Firestore: dopo va rilanciato lo script, altrimenti vale ancora il vecchio.
