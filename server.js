require('dotenv').config();
const express = require('express');
const fetch = require('node-fetch');
const path = require('path');
const app = express();
const PORT = process.env.PORT || 300;
app.use(express.json());
app.use(express.static(__dirname));

// 适配字节方舟接口（你的key是ark，不能用anthropic入参格式）
app.post('/api/ai', async (req, res) => {
  const { prompt } = req.body;
  if (!prompt) return res.status(400).json({ error: 'Missing prompt' });
  const key = process.env.ANTHROPIC_API_KEY;
  try {
    const resp = await fetch('https://ark.cn-beijing.volces.com/api/v3/chat/completions', {
      method: 'POST',
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${key}`
      },
      body: JSON.stringify({
        model: "deepseek-v3-2-251201",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.7,
        max_tokens: 1024
      })
    })
    const data = await resp.json();
    const content = data.choices?.[0]?.message?.content || '';
    res.json({ result: content });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'AI接口异常' });
  }
})

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});
app.listen(PORT, () => console.log('✦ Aemona running at http://localhost:3000'));
