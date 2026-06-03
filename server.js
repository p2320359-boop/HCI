require('dotenv').config();
const express = require('express');
const fetch = require('node-fetch');
const app = express();
const PORT = process.env.PORT||5500;
app.use(express.json());
app.use(express.static(__dirname));

app.post("/api/ai",async (req,res)=>{
  const {prompt}=req.body;
  try{
    const resp=await fetch("https://ark.cn-beijing.volces.com/api/v3/chat/completions",{
      method:"POST",
      headers:{
        "Content-Type":"application/json",
        "Authorization":`Bearer ${process.env.ANTHROPIC_API_KEY}`
      },
      body:JSON.stringify({
        model:"deepseek-v3-2-251201",
        messages:[{role:"user",content:prompt}],
        temperature:0.7
      })
    })
    const json=await resp.json();
    // 关键：剔除换行空格，防止前端JSON.parse崩
    let raw=json.choices?.[0]?.message?.content||"";
    res.json({result:raw.trim()})
  }catch(e){
    res.json({result:""})
  }
})
app.get("*",(req,res)=>res.sendFile("index.html",{root:__dirname}))
app.listen(PORT)
