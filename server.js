const express = require('express');
const path = require('path');
const cors = require('cors');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname)));

// ============================
// 我只改了这里！！！
// 只替换了 AI 接口！！！
// ============================
app.post('/api/ai', async (req, res) => {
  try {
    const { prompt } = req.body;
    if (!prompt) return res.status(400).json({ error: 'Missing prompt' });

    const response = await fetch('https://ark.cn-beijing.volces.com/api/v3/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ark-f9a3609f-7e3a-4299-ade9-13498944ca45-7c2f4'
      },
      body: JSON.stringify({
        model: 'deepseek-v3-2-251201',
        messages: [
          { role: 'user', content: prompt }
        ],
        temperature: 0.7,
        max_tokens: 1024
      })
    });

    const data = await response.json();
    const result = data.choices?.[0]?.message?.content || '';
    res.json({ result });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'AI 调用失败' });
  }
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, () => {
  console.log('✦ Aemona running at http://localhost:3000');
});
