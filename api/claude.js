// Proxy verso l'API Anthropic. Hardening:
// - nessun CORS aperto: accetta solo richieste dallo stesso sito (Origin/Referer = host del deploy)
// - solo POST, solo modelli e limiti di token consentiti
// - limite di richieste per IP (best effort: la memoria e' per istanza serverless)
const ALLOWED_MODELS = ['claude-sonnet-4-20250514'];
const MAX_TOKENS_CAP = 2500;
const MAX_BODY_CHARS = 8 * 1024 * 1024;   // PDF/immagini in base64
const RATE_WINDOW_MS = 10 * 60 * 1000;
const RATE_MAX = 30;                       // richieste per IP ogni 10 minuti
const hits = new Map();

function sameSite(req) {
  const host = req.headers['x-forwarded-host'] || req.headers.host || '';
  const src = req.headers.origin || req.headers.referer || '';
  if (!src) return false;
  try { return new URL(src).host === host; } catch (e) { return false; }
}

function rateLimited(ip) {
  const now = Date.now();
  const arr = (hits.get(ip) || []).filter(t => now - t < RATE_WINDOW_MS);
  arr.push(now);
  hits.set(ip, arr);
  if (hits.size > 5000) hits.clear();
  return arr.length > RATE_MAX;
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (!sameSite(req)) return res.status(403).json({ error: 'Origine non consentita' });

  const ip = String(req.headers['x-forwarded-for'] || req.socket?.remoteAddress || '').split(',')[0].trim();
  if (rateLimited(ip)) return res.status(429).json({ error: 'Troppe richieste, riprova tra qualche minuto' });

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'API key not configured' });

  const body = req.body || {};
  if (JSON.stringify(body).length > MAX_BODY_CHARS) return res.status(413).json({ error: 'Richiesta troppo grande' });
  if (!ALLOWED_MODELS.includes(body.model)) return res.status(400).json({ error: 'Modello non consentito' });
  if (!Array.isArray(body.messages) || body.messages.length === 0) return res.status(400).json({ error: 'Messaggi mancanti' });
  const safe = {
    model: body.model,
    max_tokens: Math.min(Number(body.max_tokens) || 1000, MAX_TOKENS_CAP),
    messages: body.messages,
  };
  if (typeof body.system === 'string') safe.system = body.system;

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify(safe),
    });
    const data = await response.json();
    return res.status(response.status).json(data);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};
