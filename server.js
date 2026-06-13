// ============================================================
// server.js — Aemona v2 backend (DeepSeek API)
// ============================================================
require('dotenv').config();
const express = require('express');
const path = require('path');
const cors = require('cors');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 3000;
const DEEPSEEK_API_URL = 'https://ark.cn-beijing.volces.com/api/v3/chat/completions';
const DEEPSEEK_MODEL = process.env.DEEPSEEK_MODEL || 'deepseek-v3-2-251201';
const betaAttempts = new Map();

app.use(cors());
app.use(express.json({ limit: '100kb' }));

const staticOptions = {
  etag: false,
  lastModified: false,
  dotfiles: 'deny',
  setHeaders(res, filePath) {
    if (/\.(html|js|css)$/i.test(filePath)) {
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
    }
  }
};

app.use('/assets', express.static(path.join(__dirname, 'assets'), staticOptions));
app.get(['/app.js', '/data.js', '/firebase-auth.js', '/style.css'], (req, res) => {
  res.sendFile(path.join(__dirname, req.path), {
    headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate' }
  });
});

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.get('/api/firebase-config', (req, res) => {
  res.json({
    apiKey: process.env.FIREBASE_API_KEY || '',
    authDomain: process.env.FIREBASE_AUTH_DOMAIN || '',
    projectId: process.env.FIREBASE_PROJECT_ID || '',
    storageBucket: process.env.FIREBASE_STORAGE_BUCKET || '',
    messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID || '',
    appId: process.env.FIREBASE_APP_ID || '',
    measurementId: process.env.FIREBASE_MEASUREMENT_ID || ''
  });
});

app.post('/api/beta-access', (req, res) => {
  const attemptKey = req.ip;
  const now = Date.now();
  const attempt = betaAttempts.get(attemptKey) || { count: 0, resetAt: now + 15 * 60 * 1000 };
  if (now > attempt.resetAt) {
    attempt.count = 0;
    attempt.resetAt = now + 15 * 60 * 1000;
  }
  if (attempt.count >= 10) {
    return res.status(429).json({ error: 'Too many attempts. Please try again later.' });
  }

  const submittedCode = String(req.body?.code || '').trim();
  const configuredCode = String(process.env.BETA_ACCESS_CODE || '').trim();
  if (!configuredCode) return res.status(503).json({ error: 'Beta access is not configured.' });

  const submitted = Buffer.from(submittedCode);
  const configured = Buffer.from(configuredCode);
  const valid = submitted.length === configured.length &&
    crypto.timingSafeEqual(submitted, configured);
  if (!valid) {
    attempt.count++;
    betaAttempts.set(attemptKey, attempt);
    return res.status(401).json({ error: 'Invalid beta access code.' });
  }

  betaAttempts.delete(attemptKey);
  const accessId = crypto.createHash('sha256').update(configuredCode).digest('hex').slice(0, 16);
  res.json({ accessId });
});


// ── LOCAL EMAIL/PASSWORD AUTH ──────────────────────────────────
// Stores users in users.json (same folder as server.js).
// No Firebase config required. Google login still uses Firebase client-side.

const fs = require('fs');
const USERS_FILE = path.join(__dirname, 'users.json');

function loadLocalUsers() {
  try { return JSON.parse(fs.readFileSync(USERS_FILE, 'utf8')); }
  catch { return {}; }
}
function saveLocalUsers(users) {
  fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2), 'utf8');
}
function hashPw(password) {
  const salt = process.env.AUTH_SALT || 'aemona_local_salt_2026';
  return crypto.createHash('sha256').update(salt + password).digest('hex');
}
function emailToUid(email) {
  return crypto.createHash('sha256').update(email.toLowerCase().trim()).digest('hex').slice(0, 24);
}

app.post('/api/auth/register', (req, res) => {
  const { email, password, name } = req.body || {};
  if (!email || !password) return res.status(400).json({ error: 'Email and password are required.' });
  const uid   = emailToUid(email);
  const users = loadLocalUsers();
  if (users[uid]) return res.status(409).json({ error: 'An account with this email already exists.' });
  users[uid] = { uid, email: email.toLowerCase().trim(), name: (name || '').trim(), passwordHash: hashPw(password), createdAt: new Date().toISOString() };
  saveLocalUsers(users);
  console.log(`[Auth] Registered: ${email}`);
  res.json({ uid, email: users[uid].email, name: users[uid].name, isNewUser: true });
});

app.post('/api/auth/login', (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) return res.status(400).json({ error: 'Email and password are required.' });
  const uid   = emailToUid(email);
  const users = loadLocalUsers();
  const user  = users[uid];
  if (!user) return res.status(404).json({ error: 'No account found with this email.' });
  if (user.passwordHash !== hashPw(password)) return res.status(401).json({ error: 'The email or password is incorrect.' });
  console.log(`[Auth] Login: ${email}`);
  res.json({ uid: user.uid, email: user.email, name: user.name });
});

// DeepSeek API 代理
function countPatternMatches(records, groups) {
  return groups.map(group => {
    const regex = new RegExp(group.words.join('|'), 'i');
    const evidence = records.filter(record => regex.test(`${record.story} ${record.tags.join(' ')}`));
    return { title: group.title, count: evidence.length, evidence: evidence[0]?.story?.slice(0, 150) || '' };
  }).filter(item => item.count > 0).sort((a, b) => b.count - a.count);
}

function buildLocalPatternInsights(records) {
  const match = groups => countPatternMatches(records, groups);
  const topics = match([
    { title: 'Friendships & connection', words: ['friend', 'relationship', 'reply', 'conversation', 'misunderstood'] },
    { title: 'School & performance', words: ['school', 'exam', 'grade', 'assignment', 'study'] },
    { title: 'Work & responsibility', words: ['work', 'deadline', 'task', 'responsib'] },
    { title: 'Rest & energy', words: ['tired', 'sleep', 'rest', 'exhaust', 'overwhelm'] },
    { title: 'Self-image', words: ['myself', 'enough', 'failure', 'body', 'confidence'] }
  ]);
  const cognitive = match([
    { title: 'Rumination', words: ['keep thinking', 'replay', 'cannot stop thinking', 'overthink'] },
    { title: 'Self-criticism', words: ['my fault', 'not enough', 'should have', 'failure'] },
    { title: 'Perfectionism', words: ['perfect', 'must', 'have to', 'mistake'] },
    { title: 'Catastrophizing', words: ['everything', 'never', 'always', 'worst'] }
  ]);
  const relationships = match([
    { title: 'Conflict sensitivity', words: ['argument', 'fight', 'conflict', 'awkward', 'misunderstood'] },
    { title: 'Need for reassurance', words: ['reply', 'reassur', 'still care', 'waiting'] },
    { title: 'Boundary difficulty', words: ['boundary', 'say no', 'people pleasing', 'disappoint'] }
  ]);
  const regulation = match([
    { title: 'Reflection', words: ['notice', 'understand', 'reflect', 'realize'] },
    { title: 'Seeking support', words: ['asked', 'talked', 'help', 'support'] },
    { title: 'Avoidance', words: ['avoid', 'ignore', 'distract', 'numb'] },
    { title: 'Emotional expression', words: ['cried', 'said', 'wrote', 'shared'] }
  ]);
  const needs = match([
    { title: 'Rest', words: ['tired', 'sleep', 'rest', 'exhaust'] },
    { title: 'Safety', words: ['safe', 'anxious', 'afraid', 'uncertain'] },
    { title: 'Connection', words: ['friend', 'lonely', 'reply', 'together'] },
    { title: 'Autonomy', words: ['choice', 'control', 'space', 'boundary'] },
    { title: 'Growth', words: ['learn', 'improve', 'grow', 'change'] }
  ]);
  const strengths = match([
    { title: 'Self-awareness', words: ['notice', 'realize', 'understand', 'reflect'] },
    { title: 'Curiosity', words: ['wonder', 'why', 'curious', 'explore'] },
    { title: 'Persistence', words: ['keep', 'continue', 'try again', 'still'] },
    { title: 'Help-seeking', words: ['asked', 'help', 'support', 'talked'] }
  ]);
  const lead = cognitive[0]?.title || topics[0]?.title || 'what keeps returning';
  return {
    recurringTopics: topics.slice(0, 4),
    cognitivePatterns: cognitive.slice(0, 3),
    relationshipPatterns: relationships.slice(0, 3),
    regulationPatterns: regulation.slice(0, 3),
    psychologicalNeeds: needs.slice(0, 3),
    protectiveFactors: strengths.slice(0, 3),
    reflectionPrompt: `What might become easier if you met ${lead.toLowerCase()} with a little more patience?`
  };
}

function buildLocalPatternClassification(insights) {
  const has = (key, regex) => (insights[key] || []).some(item => regex.test(String(item.title || '')));
  return {
    dominant_emotions: [],
    dominant_needs: (insights.psychologicalNeeds || []).slice(0, 3).map(item => item.title.toLowerCase()),
    frequent_topics: (insights.recurringTopics || []).slice(0, 4).map(item => item.title.toLowerCase()),
    thinking_pattern: has('cognitivePatterns', /perfection/i) ? 'perfectionism' : has('cognitivePatterns', /self.?critic|self.?doubt/i) ? 'self_doubt' : has('cognitivePatterns', /worry|catastroph/i) ? 'future_worry' : 'rumination',
    relationship_pattern: has('relationshipPatterns', /boundary/i) ? 'boundary_fatigue' : has('relationshipPatterns', /pleas|approval/i) ? 'people_pleasing' : 'post_conflict',
    strength_pattern: has('protectiveFactors', /awareness/i) ? 'observer' : has('protectiveFactors', /curiosity/i) ? 'seeker' : 'pillar',
    growth_pattern: has('psychologicalNeeds', /autonomy|boundary/i) ? 'boundary_building' : has('protectiveFactors', /awareness/i) ? 'emotional_awareness' : 'self_compassion',
    risk_pattern: has('psychologicalNeeds', /rest/i) ? 'overload' : ''
  };
}

function normalizePatternClassification(value, fallback) {
  const allowed = {
    thinking_pattern: ['rumination', 'self_doubt', 'future_worry', 'perfectionism'],
    relationship_pattern: ['post_conflict', 'people_pleasing', 'boundary_fatigue'],
    strength_pattern: ['pillar', 'observer', 'seeker'],
    growth_pattern: ['self_compassion', 'emotional_awareness', 'boundary_building']
  };
  const result = { ...fallback };
  Object.entries(allowed).forEach(([key, values]) => {
    if (values.includes(value?.[key])) result[key] = value[key];
  });
  ['dominant_emotions', 'dominant_needs', 'frequent_topics'].forEach(key => {
    if (Array.isArray(value?.[key])) result[key] = value[key].slice(0, 5).map(item => String(item).slice(0, 40));
  });
  result.risk_pattern = String(value?.risk_pattern || fallback.risk_pattern || '').slice(0, 40);
  return result;
}

function parsePatternJson(text) {
  return JSON.parse(String(text || '').replace(/^```json\s*|```$/g, '').trim());
}

app.post('/api/patterns', async (req, res) => {
  const records = Array.isArray(req.body?.records) ? req.body.records : [];
  const safeRecords = records
    .filter(record => record && typeof record === 'object')
    .map(record => ({
      date: String(record.date || ''),
      time: String(record.time || ''),
      emotion: String(record.primary_emotion || record.planet?.emotion || record.emotion || ''),
      secondaryEmotion: String(record.secondary_emotion || ''),
      story: String(record.raw_text || record.story || '').slice(0, 800),
      landscape: record.emotion_distribution || record.planet?.landscape || record.landscape || {},
      emotionalNeed: String(record.emotional_need || ''),
      bodyLocation: String(record.body_location || ''),
      intensity: Number(record.intensity || 0),
      tags: Array.isArray(record.tags) ? record.tags.slice(0, 12).map(String) : []
    }))
    .filter(record => record.date);

  const emotionCounts = {};
  const tagCounts = {};
  safeRecords.forEach(record => {
    if (record.emotion) emotionCounts[record.emotion] = (emotionCounts[record.emotion] || 0) + 1;
    record.tags.forEach(tag => {
      const key = String(tag);
      tagCounts[key] = (tagCounts[key] || 0) + 1;
    });
  });

  const topEmotion = Object.entries(emotionCounts).sort((a, b) => b[1] - a[1])[0] || null;
  const today = new Date();
  const recentCutoff = new Date(today);
  recentCutoff.setDate(today.getDate() - 6);
  const recentRecords = safeRecords.filter(record => {
    const date = new Date(record.date);
    return !Number.isNaN(date.valueOf()) && date >= recentCutoff;
  });

  const localInsights = buildLocalPatternInsights(safeRecords);
  const localClassification = buildLocalPatternClassification(localInsights);
  localClassification.dominant_emotions = Object.entries(emotionCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4)
    .map(([name]) => name);
  let insights = localInsights;
  let classification = localClassification;
  let recentEvidence = localInsights.recurringTopics.map(item => item.evidence).filter(Boolean).slice(0, 2).join(' ').slice(0, 500);
  let source = 'local-fallback';
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (apiKey && safeRecords.length >= 5 && req.body?.useAI !== false) {
    const prompt = `Classify these emotional wellness records for Aemona. Return ONLY valid JSON.
Do not write insight pages, advice, actions, reflections, diagnoses, or personality reports.
Choose only from the allowed classification codes. Recent evidence must be 50-80 words maximum, gentle, non-diagnostic, and based only on the records.
Allowed codes:
thinking_pattern: rumination | self_doubt | future_worry | perfectionism
relationship_pattern: post_conflict | people_pleasing | boundary_fatigue
strength_pattern: pillar | observer | seeker
growth_pattern: self_compassion | emotional_awareness | boundary_building
Required shape:
{"classification":{"dominant_emotions":[],"dominant_needs":[],"frequent_topics":[],"thinking_pattern":"","relationship_pattern":"","strength_pattern":"","growth_pattern":"","risk_pattern":""},"recent_evidence":""}
Records: ${JSON.stringify(safeRecords.slice(0, 12))}`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 7000);
    try {
      const response = await fetch(DEEPSEEK_API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
        signal: controller.signal,
        body: JSON.stringify({
          model: DEEPSEEK_MODEL,
          messages: [
            { role: 'system', content: 'You are Aemona pattern analysis. Return valid JSON only. Never diagnose.' },
            { role: 'user', content: prompt }
          ],
          temperature: 0.15,
          max_tokens: 900
        })
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error?.message || 'Pattern AI request failed');
      const parsed = parsePatternJson(result.choices?.[0]?.message?.content);
      classification = normalizePatternClassification(parsed.classification, localClassification);
      recentEvidence = String(parsed.recent_evidence || recentEvidence).slice(0, 500);
      source = 'ai';
    } catch (error) {
      console.warn('[Patterns] AI fallback:', error.message);
    } finally {
      clearTimeout(timeout);
    }
  }

  res.json({
    generatedAt: new Date().toISOString(),
    source,
    minimumEntriesMet: safeRecords.length >= 5,
    totalEntries: safeRecords.length,
    recentEntries: recentRecords.length,
    uniqueEmotions: Object.keys(emotionCounts).length,
    topEmotion: topEmotion ? { name: topEmotion[0], count: topEmotion[1] } : null,
    topTags: Object.entries(tagCounts).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([name, count]) => ({ name, count })),
    insights,
    classification,
    recentEvidence
  });
});

app.post('/api/ai', async (req, res) => {
  const { prompt } = req.body;
  if (!prompt) {
    return res.status(400).json({ error: 'Missing prompt' });
  }

  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) {
    console.error('❌ DEEPSEEK_API_KEY is not set in .env file');
    return res.status(500).json({ error: 'API key not configured. Please add DEEPSEEK_API_KEY to .env' });
  }

  try {
    const response = await fetch(DEEPSEEK_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: DEEPSEEK_MODEL,
        messages: [
          {
            role: 'system',
            content: 'You are a gentle, empathetic assistant for an emotional wellness app called Aemona. Always respond with valid JSON only when requested. Never include extra text outside the JSON structure.'
          },
          { role: 'user', content: prompt }
        ],
        temperature: 0.7,
        max_tokens: 1200
      })
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('DeepSeek API error:', data);
      return res.status(502).json({ error: data.error?.message || 'API call failed' });
    }

    const result = data.choices?.[0]?.message?.content;
    if (!result) {
      console.error('DeepSeek returned empty content', data);
      return res.status(502).json({ error: 'Empty response from AI' });
    }

    res.json({ result });

  } catch (err) {
    console.error('Server error:', err);
    res.status(500).json({ error: 'Server error: ' + err.message });
  }
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`✦ Aemona running at http://localhost:${PORT}`);
  console.log(`✦ AI backend: DeepSeek (model: ${DEEPSEEK_MODEL})`);
});
