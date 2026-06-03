// ============================================================
// server.js — Aemona v2 backend (static files from memory)
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

// 在启动时读取静态文件内容到内存中
let dataJsContent = '';
let appJsContent = '';
let styleCssContent = '';
let indexHtmlContent = '';

try {
  dataJsContent = fs.readFileSync(path.join(__dirname, 'data.js'), 'utf8');
  appJsContent = fs.readFileSync(path.join(__dirname, 'app.js'), 'utf8');
  styleCssContent = fs.readFileSync(path.join(__dirname, 'style.css'), 'utf8');
  indexHtmlContent = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');
  console.log('✓ Static files loaded into memory');
} catch (err) {
  console.error('❌ Failed to load static files:', err.message);
  process.exit(1);
}

// 显式返回静态文件内容
app.get('/data.js', (req, res) => {
  res.setHeader('Content-Type', 'application/javascript');
  res.send(dataJsContent);
});

app.get('/app.js', (req, res) => {
  res.setHeader('Content-Type', 'application/javascript');
  res.send(appJsContent);
});

app.get('/style.css', (req, res) => {
  res.setHeader('Content-Type', 'text/css');
  res.send(styleCssContent);
});

// API 路由
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

// 根路径返回 index.html
app.get('/', (req, res) => {
  res.send(indexHtmlContent);
});

// 其他所有路径返回 index.html（用于前端路由）
app.get('*', (req, res) => {
  res.send(indexHtmlContent);
});

app.listen(PORT, () => {
  console.log(`✦ Aemona running at http://localhost:${PORT}`);
});
