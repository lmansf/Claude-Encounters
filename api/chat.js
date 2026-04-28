// api/chat.js
// Vercel serverless proxy — keeps your Anthropic API key server-side.
//
// Setup:
//   1. In your Vercel project dashboard go to Settings → Environment Variables
//   2. Add a variable named  ANTHROPIC_API_KEY  with your Anthropic API key as the value
//   3. Redeploy — the key will never appear in your client-side code

const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';
const ANTHROPIC_VERSION = '2023-06-01';

// Allowed origins — tighten this list once you know your production domain
const ALLOWED_ORIGINS = ['*'];

module.exports = async function handler(req, res) {

    // ── CORS headers ──────────────────────────────────────────────
    const origin = req.headers.origin || '*';
    const allowed = ALLOWED_ORIGINS.includes('*') || ALLOWED_ORIGINS.includes(origin);
    if (allowed) {
        res.setHeader('Access-Control-Allow-Origin', origin);
    }
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    // Handle preflight
    if (req.method === 'OPTIONS') {
        return res.status(204).end();
    }

    // ── Method guard ──────────────────────────────────────────────
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed. Use POST.' });
    }

    // ── API key check ─────────────────────────────────────────────
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
        console.error('ANTHROPIC_API_KEY environment variable is not set.');
        return res.status(500).json({
            error: 'Server configuration error: ANTHROPIC_API_KEY is not set. ' +
                   'Add it in your Vercel project → Settings → Environment Variables.',
        });
    }

    // ── Validate request body ─────────────────────────────────────
    const { model, max_tokens, system, messages } = req.body || {};

    if (!model) {
        return res.status(400).json({ error: 'Missing required field: model' });
    }
    if (!messages || !Array.isArray(messages) || messages.length === 0) {
        return res.status(400).json({ error: 'Missing or empty required field: messages' });
    }

    // ── Forward to Anthropic ──────────────────────────────────────
    try {
        const anthropicRes = await fetch(ANTHROPIC_API_URL, {
            method  : 'POST',
            headers : {
                'Content-Type'      : 'application/json',
                'x-api-key'         : apiKey,
                'anthropic-version' : ANTHROPIC_VERSION,
            },
            body: JSON.stringify({
                model,
                max_tokens : max_tokens ?? 4096,
                system     : system ?? '',
                messages,
            }),
        });

        const data = await anthropicRes.json();

        // Forward whatever status Anthropic returned (200, 400, 429, etc.)
        return res.status(anthropicRes.status).json(data);

    } catch (err) {
        console.error('Proxy fetch error:', err);
        return res.status(502).json({
            error: `Proxy could not reach Anthropic API: ${err.message}`,
        });
    }
};
