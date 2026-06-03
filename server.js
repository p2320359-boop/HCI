// ============================================================
// server.js — Aemona v2 backend (DeepSeek API)
// ============================================================
require('dotenv').config();
const express = require('express');
const path = require('path');
const cors = require('cors');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// 静态文件服务：优先处理所有静态资源（.js, .css, .html 等）
app.use(express.static(__dirname, {
  index: false,        
  extensions: false
}));

// API 路由
app.post('/api/ai', async (req, res) => {
  const { prompt } = req.body;
  if (!prompt) {
    return res.status(400).json({ error: 'Missing prompt' });
  }

  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) {
    console.error('❌ DEEPSEEK_API_KEY is not set in .env file');
    return res.status(500).json({ error: 'API key not configured.' });
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
  const filePath = path.join(__dirname, req.path);
  try {
    if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
      res.sendFile(filePath);
    } else {
      res.sendFile(path.join(__dirname, 'index.html'));
    }
  } catch (err) {
    res.sendFile(path.join(__dirname, 'index.html'));
  }
});

app.listen(PORT, () => {
  console.log(`✦ Aemona running at http://localhost:${PORT}`);
  console.log(`✦ AI backend: DeepSeek (model: deepseek-v3-2-251201)`);
});
