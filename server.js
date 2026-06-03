// ============================================================
// server.js — Aemona backend
// Serves /public and proxies AI calls to Anthropic.
// Your API key lives only here, never in the browser.
//
// HOW TO SWITCH AI PROVIDER:
//   This server only proxies to Anthropic.
//   To use a different provider, either:
//   1) Edit the fetch() call below to point to your provider, OR
//   2) Set AI_PROVIDER in app.js to 'openai', 'doubao', etc.
//      and paste your key in AI_KEY — the server is then bypassed.
//
// RUN:
//   node server.js        (production)
//   npx nodemon server.js (auto-restart during development)
// ============================================================

require('dotenv').config();
const express = require('express');
const fetch   = require('node-fetch');
const path    = require('path');

const app  = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(__dirname));

// ── POST /api/ai ──────────────────────────────────────────────
app.post('/api/ai', async (req, res) => {
  const { prompt } = req.body;
  if (!prompt || typeof prompt !== 'string')
    return res.status(400).json({ error: 'Missing prompt field.' });

  if (!process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_API_KEY.includes('YOUR-KEY'))
    return res.status(500).json({ error: 'API key not configured. Edit .env and restart.' });

  try {
    const r    = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type':      'application/json',
        'x-api-key':         process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model:      'deepseek-v3-2-251201',
        max_tokens: 1024,
        messages:   [{ role: 'user', content: prompt }]
      })
    });
    const data = await r.json();
    if (data.error) { console.error('Anthropic error:', data.error); return res.status(502).json({ error: data.error.message }); }
    res.json({ result: (data.content || []).map(b => b.text || '').join('') });
  } catch (err) {
    console.error('Server error:', err);
    res.status(500).json({ error: 'Server failed to reach AI.' });
  }
});

app.listen(PORT, () => console.log(`\n✦ Aemona running at http://localhost:${PORT}\n`));
