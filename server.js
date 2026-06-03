// ============================================================
// server.js — Aemona v2 backend (fixed for Render)
// ============================================================
require('dotenv').config();
const express = require('express');
const path = require('path');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// 关键: 将所有静态文件（.js, .css, .html 等）放在最前面，用 express.static 托管
// 注意：第一个参数是当前目录（__dirname），这样请求 /data.js 就会去根目录找 data.js
app.use(express.static(__dirname, {
  index: false,   // 禁用自动索引，因为我们会手动处理根路径
}));

// API 路由
app.post('/api/ai', async (req, res) => {
  const { prompt } = req.body;
  if (!prompt) return res.status(400).json({ error: 'Missing prompt' });

  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) {
    console.error('❌ DEEPSEEK_API_KEY is not set');
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
          { role: 'system', content: 'You are a gentle, empathetic assistant for Aemona. Always respond with valid JSON only when requested.' },
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
    console.error('API error:', err);
    res.status(500).json({ error: err.message });
  }
});


app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`✦ Aemona running at http://localhost:${PORT}`);
});
