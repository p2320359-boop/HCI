// ============================================================
// server.js — Aemona v2 backend (DeepSeek API) with fixed static serving
// ============================================================
require('dotenv').config();
const express = require('express');
const path = require('path');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// 显式处理关键静态文件（避免被通配路由拦截）
app.get('/data.js', (req, res) => {
  res.sendFile(path.join(__dirname, 'data.js'), { headers: { 'Content-Type': 'application/javascript' } });
});
app.get('/app.js', (req, res) => {
  res.sendFile(path.join(__dirname, 'app.js'), { headers: { 'Content-Type': 'application/javascript' } });
});
app.get('/style.css', (req, res) => {
  res.sendFile(path.join(__dirname, 'style.css'), { headers: { 'Content-Type': 'text/css' } });
});
// 其他静态资源（如果有图片等）可以使用 express.static，但显式处理足够
app.use(express.static(__dirname, { index: false })); // 备用

// AI API 代理
app.post('/api/ai', async (req, res) => {
  const { prompt } = req.body;
  if (!prompt) return res.status(400).json({ error: 'Missing prompt' });

  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) {
    console.error('❌ DEEPSEEK_API_KEY not set');
    return res.status(500).json({ error: 'API key not configured' });
  }

  try {
    const response = await fetch('https://ark.cn-beijing.volces.com/api/v3/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'deepseek-v3-2-251201',
        messages: [
          { role: 'system', content: 'You are a gentle, empathetic assistant for an emotional wellness app called Aemona. Always respond with valid JSON only when requested.' },
          { role: 'user', content: prompt }
        ],
        temperature: 0.7,
        max_tokens: 1200
      })
    });

    const data = await response.json();
    if (!response.ok) throw new Error(data.error?.message || 'API call failed');

    const result = data.choices?.[0]?.message?.content;
    if (!result) throw new Error('Empty response');

    res.json({ result });
  } catch (err) {
    console.error('Server error:', err);
    res.status(500).json({ error: err.message });
  }
});

// 所有其他请求返回 index.html（前端路由）
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`✦ Aemona running at http://localhost:${PORT}`);
});
