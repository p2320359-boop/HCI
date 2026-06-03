async function callAI(prompt) {
  console.log('[AI] calling provider:', AI_PROVIDER);
  console.log('[AI] prompt preview:', prompt.slice(0, 120));
  let res, data;
  if (AI_PROVIDER === 'local-server') {
    try {
      res  = await fetch('/api/ai', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt })
      });
      data = await res.json();
      if (data.error) throw new Error(data.error);
      return data.result;
    }catch(err){
      // AI接口不通直接返回对应兜底JSON文本，分场景
      if(prompt.includes('sensitivity profile')){
        return `{"score":3.2,"label":"Perceptive","tagline":"You notice what others miss, and feel it more deeply.","strengths":["Deep empathy","Self-awareness","Intuition"],"challenges":["Overstimulation","Boundary-setting"],"tip":"Regular quiet time helps you reset and integrate."}`
      }else if(prompt.includes('slider questions')){
        return `[{"q":"When this feeling shows up… what feels more true?","left":"It makes me pull inward","right":"It makes me push against something"},{"q":"Right now… how close does it feel to the surface?","left":"Buried deep","right":"Right at the edge"},{"q":"How long has this been sitting with you?","left":"Just arrived","right":"Been here a while"},{"q":"In your body… where do you feel it most?","left":"Scattered","right":"One clear place"},{"q":"Right now… what would help more?","left":"Feeling understood","right":"Feeling reassured"}]`
      }else{
        return `{"emotion":"Unclear","subtitle":"A feeling waiting to unfold","color1":"#9b8ec4","color2":"#d4c4f0","gradient":"radial-gradient(circle at 35% 35%, #c4b8e8, #9b8ec4 55%, #4a3a6a)","landscape":{"joy_sadness":35,"trust_disgust":55,"fear_anger":40,"surprise_anticipation":50},"tools":["breath","unsent"],"companion_note":"It’s okay to not have words for everything you carry."}`
      }
    }
  } else if (AI_PROVIDER === 'openai') {
    res  = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${AI_KEY}` },
      body: JSON.stringify({ model: AI_MODEL || 'gpt-4o', max_tokens: 1024, messages: [{ role: 'user', content: prompt }] })
    });
    data = await res.json();
    if (data.error) throw new Error(data.error.message);
    return data.choices[0].message.content;
  } else if (AI_PROVIDER === 'doubao') {
    res  = await fetch('https://ark.cn-beijing.volces.com/api/v3/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${AI_KEY}` },
      body: JSON.stringify({ model: AI_MODEL || 'ep-your-endpoint-id', max_tokens: 1024, messages: [{ role: 'user', content: prompt }] })
    });
    data = await res.json();
    if (data.error) throw new Error(data.error.message);
    return data.choices[0].message.content;
  } else if (AI_PROVIDER === 'openai-compat') {
    const base = AI_ENDPOINT_COMPAT || 'https://api.deepseek.com';
    res  = await fetch(`${base}/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${AI_KEY}` },
      body: JSON.stringify({ model: AI_MODEL || 'deepseek-chat', max_tokens: 1024, messages: [{ role: 'user', content: prompt }] })
    });
    data = await res.json();
    if (data.error) throw new Error(data.error.message);
    return data.choices[0].message.content;
  }
  throw new Error('Unknown AI_PROVIDER: ' + AI_PROVIDER);
}
