// ============================================================
// app.js — Aemona v2
// Depends on: data.js (loaded first)
// ============================================================

// ── AI CONFIGURATION ─────────────────────────────────────────
// 使用 local-server 模式，所有 AI 请求通过本机后端代理
const AI_PROVIDER        = 'local-server';
const AI_KEY             = '';          // 保留但不使用
const AI_MODEL           = '';
const AI_ENDPOINT_COMPAT = '';
const MAX_CHARS = 500;   
let currentEntriesYear  = new Date().getFullYear();
let currentEntriesMonth = new Date().getMonth();

async function callAI(prompt) {
  console.log('[AI] calling provider:', AI_PROVIDER);
  console.log('[AI] prompt preview:', prompt.slice(0, 120));
  let res, data;

  if (AI_PROVIDER === 'local-server') {
    res  = await fetch('/api/ai', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt })
    });
    data = await res.json();
    if (data.error) throw new Error(data.error);
    return data.result;

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

function parseJSON(text) {
  // Strip markdown fences
  let cleaned = text.replace(/```json|```/g, '').trim();
  // Extract the first JSON object or array from the text
  const objMatch = cleaned.match(/(\{[\s\S]*\})/);
  const arrMatch = cleaned.match(/(\[[\s\S]*\])/);
  if (arrMatch && (!objMatch || arrMatch.index < objMatch.index)) {
    return JSON.parse(arrMatch[1]);
  }
  if (objMatch) return JSON.parse(objMatch[1]);
  return JSON.parse(cleaned);
}


// ── STATE ─────────────────────────────────────────────────────
let currentUser     = null;
let currentStory    = '';
let currentTags     = {};     // { about:[], duration:[], space:[], body:[] }
let currentPlanet   = null;
let sliderAnswers   = [];     // array of 0-100 values
let aiSliderQs      = [];     // [{q, left, right}]
let selectedCompanion = null; // companion object
let setupGoals      = [];
let setupHelpful    = [];
let setupStep       = 1;
let guideStep       = 0;
let breathTimer     = null;

const NOW         = new Date();
const todayD      = NOW.getDate();
const todayMonth  = NOW.getMonth();
const todayYear   = NOW.getFullYear();


// ── STORAGE ───────────────────────────────────────────────────
const getUsers   = ()      => JSON.parse(localStorage.getItem('ae_users')   || '{}');
const saveUsers  = u       => localStorage.setItem('ae_users', JSON.stringify(u));
const getData    = name    => JSON.parse(localStorage.getItem('ae_d_' + name) ||
  '{"records":[],"cover":{},"profile":null,"sp":null,"companion":null,"goals":[],"helpful":[]}');
const saveData   = (n, d)  => localStorage.setItem('ae_d_' + n, JSON.stringify(d));


// ── INIT ──────────────────────────────────────────────────────
(function init() {
  const saved = localStorage.getItem('ae_user');
  if (saved) {
    currentUser = saved;
    const d = getData(currentUser);
    selectedCompanion = COMPANIONS.find(c => c.id === d.companion) || COMPANIONS[0];
    showBottomNav();
    go('explore');
  } else {
    go('splash');
    setTimeout(() => go('guide'), 1800);
  }
})();


// ── NAVIGATION ────────────────────────────────────────────────
function go(id) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('show'));
  const pg = document.getElementById(id);
  if (pg) pg.classList.add('show');

  // Per-page setup
  if (id === 'guide')          initGuide();
  if (id === 'setup')          renderSetupStep();
  if (id === 'explore')        renderExplore();
  if (id === 'tools-page')     setNavActive('tools-page');
  if (id === 'entries-page')   { renderEntries(); setNavActive('entries-page'); }
  if (id === 'patterns-page')  { renderPatterns(); setNavActive('patterns-page'); }
  if (id === 'explore')        setNavActive('explore');
  if (id === 'reg-drag')       enableDrag();
  if (id === 'reg-breath')     startBreath();
  if (id === 'reg-clear')      spawnClearBalls();
  if (id === 'input-modal')    initInputModal();
}

function showBottomNav() {
  document.getElementById('bottom-nav').classList.add('visible');
}
function hideBottomNav() {
  document.getElementById('bottom-nav').classList.remove('visible');
}

function setNavActive(pageId) {
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  const map = { 'explore': 0, 'tools-page': 1, 'entries-page': 2, 'patterns-page': 3 };
  const idx = map[pageId];
  if (idx !== undefined) {
    document.querySelectorAll('.nav-item')[idx]?.classList.add('active');
  }
}


// ── GUIDE (pre-auth slides) ────────────────────────────────────
function initGuide() {
  guideStep = 0;
  renderGuideSlide();
}

function renderGuideSlide() {
  const slides = document.querySelectorAll('.guide-slide');
  slides.forEach((s, i) => {
    s.classList.remove('active', 'prev');
    if (i === guideStep)     s.classList.add('active');
    if (i < guideStep)       s.classList.add('prev');
  });
  // dots
  document.querySelectorAll('.guide-dot').forEach((d, i) =>
    d.classList.toggle('active', i === guideStep));
  // button text
  const btn = document.getElementById('guide-btn');
  if (btn) btn.textContent = guideStep < GUIDE_SLIDES.length - 1 ? 'Continue' : 'Get started';
}

function guideNext() {
  if (guideStep < GUIDE_SLIDES.length - 1) {
    guideStep++;
    renderGuideSlide();
  } else {
    go('auth');
  }
}


// ── AUTH ──────────────────────────────────────────────────────
function switchTab(t) {
  ['login', 'register'].forEach(x => {
    document.getElementById('tab-' + x).classList.toggle('active', x === t);
    document.getElementById(x + '-form').style.display = x === t ? 'flex' : 'none';
  });
}

function showErr(id, msg) { const e = document.getElementById(id); e.textContent = msg; e.classList.add('show'); }
function clearErr(id)     { document.getElementById(id).classList.remove('show'); }

function socialLogin(provider) {
  // Social login simulation — in a real app connect Firebase/Supabase Auth here
  // For now, generate a guest username from the provider
  const username = provider + '_user_' + Math.floor(Math.random() * 9000 + 1000);
  const users = getUsers();
  if (!users[username]) {
    users[username] = { pw: btoa('social_' + provider), createdAt: Date.now(), provider };
    saveUsers(users);
  }
  currentUser = username;
  localStorage.setItem('ae_user', currentUser);
  go('setup');
}

function handleLogin() {
  clearErr('login-err');
  const u = document.getElementById('l-user').value.trim();
  const p = document.getElementById('l-pass').value;
  if (!u || !p) { showErr('login-err', 'Please fill in all fields.'); return; }
  const users = getUsers();
  if (!users[u])               { showErr('login-err', 'Username not found.'); return; }
  if (users[u].pw !== btoa(p)) { showErr('login-err', 'Incorrect password.'); return; }
  currentUser = u;
  localStorage.setItem('ae_user', currentUser);
  const d = getData(currentUser);
  selectedCompanion = COMPANIONS.find(c => c.id === d.companion) || COMPANIONS[0];
  showBottomNav();
  go('explore');
}

function handleRegister() {
  clearErr('reg-err');
  const u = document.getElementById('r-user').value.trim();
  const p = document.getElementById('r-pass').value;
  const c = document.getElementById('r-confirm').value;
  if (!u || !p || !c)  { showErr('reg-err', 'Please fill in all fields.'); return; }
  if (u.length < 3)    { showErr('reg-err', 'Username must be at least 3 characters.'); return; }
  if (p.length < 6)    { showErr('reg-err', 'Password must be at least 6 characters.'); return; }
  if (p !== c)         { showErr('reg-err', 'Passwords do not match.'); return; }
  if (getUsers()[u])   { showErr('reg-err', 'Username already taken.'); return; }
  const users = getUsers();
  users[u] = { pw: btoa(p), createdAt: Date.now() };
  saveUsers(users);
  currentUser = u;
  localStorage.setItem('ae_user', currentUser);
  go('setup');
}

function goToSignIn() {
  go('auth');
  // Switch to sign in tab after short delay so page renders
  setTimeout(() => switchTab('login'), 50);
}

function handleLogout() {
  currentUser = null;
  selectedCompanion = null;
  localStorage.removeItem('ae_user');
  hideBottomNav();
  go('guide');
}


// ── SETUP FLOW (9 steps) ──────────────────────────────────────
const SETUP_TOTAL = 9;

function renderSetupStep() {
  // Progress bar
  document.getElementById('setup-prog').style.width = ((setupStep / SETUP_TOTAL) * 100) + '%';
  document.getElementById('setup-step-count').textContent = setupStep + '/' + SETUP_TOTAL;

  const body = document.getElementById('setup-body');
  body.innerHTML = '';

  switch (setupStep) {
    case 1: renderSetup1(body); break;
    case 2: renderSetup2(body); break;
    case 3: renderSetup3(body); break;
    case 4: renderSetup4(body); break;
    case 5: renderSetup5(body); break;
    case 6: renderSetup6(body); break;
    case 7: renderSetup7(body); break;
    case 8: renderSetup8(body); break;
    case 9: renderSetup9(body); break;
  }
}

// Step 1 — Welcome
function renderSetup1(body) {
  body.innerHTML = `
    <div class="setup-welcome-art">🌟</div>
    <div class="setup-title serif">Hi and welcome<br>to Aemona!</div>
    <div class="setup-sub">Let's take a few minutes to get you set up.</div>`;
}

// Step 2 — Emotion response style
function renderSetup2(body) {
  body.innerHTML = `
    <div class="setup-label">Getting to know you</div>
    <div class="setup-title serif">Sometimes… a feeling won't let go. What do you usually do first?</div>
    <div style="height:18px"></div>
    <div class="opt-grid" id="resp-grid">
      ${EMOTION_RESPONSE_OPTIONS.map(o => `
        <div class="opt-card" data-id="${o.id}" onclick="toggleRespOpt('${o.id}')">
          <div class="opt-emoji">${o.emoji}</div>
          <div class="opt-label">${o.label}</div>
        </div>`).join('')}
    </div>`;
}
function toggleRespOpt(id) {
  document.querySelectorAll('#resp-grid .opt-card').forEach(c => {
    c.classList.toggle('active', c.dataset.id === id);
  });
}

// Step 3 — AI analyses response style → companion suggestion
// (we just show "We think you'll get along well with…" then companion grid)
function renderSetup3(body) {
  body.innerHTML = `
    <div class="setup-label">We think you'll get along well with…</div>
    <div class="setup-title serif">Choose your companion</div>
    <div style="height:16px"></div>
    <div class="companion-grid" id="companion-grid">
      ${COMPANIONS.map(c => `
        <div class="companion-card ${selectedCompanion && selectedCompanion.id === c.id ? 'active' : ''}"
             data-id="${c.id}" onclick="selectCompanion('${c.id}')">
          <div class="companion-art" style="background:${c.color}40">${c.emoji}</div>
          <div class="companion-name serif">This is <em>${c.name}</em>.</div>
          <div class="companion-desc">${c.tagline}</div>
        </div>`).join('')}
    </div>`;
}
function selectCompanion(id) {
  selectedCompanion = COMPANIONS.find(c => c.id === id);
  document.querySelectorAll('#companion-grid .companion-card').forEach(c =>
    c.classList.toggle('active', c.dataset.id === id));
}

// Step 4 — Companion detail
function renderSetup4(body) {
  const comp = selectedCompanion || COMPANIONS[0];
  body.innerHTML = `
    <div style="text-align:center;padding:20px 0 28px">
      <div style="width:120px;height:120px;border-radius:50%;background:${comp.color}40;margin:0 auto 20px;display:flex;align-items:center;justify-content:center;font-size:56px;box-shadow:0 8px 40px rgba(107,79,160,0.15)">${comp.emoji}</div>
      <div class="setup-label">Your companion</div>
      <div class="setup-title serif" style="margin-bottom:14px">This is <em>${comp.name}</em>.</div>
      <div class="setup-sub">${comp.desc}</div>
    </div>`;
}

// Step 5 — Goals (checkboxes)
function renderSetup5(body) {
  body.innerHTML = `
    <div class="setup-label">Before jumping in, let's explore</div>
    <div class="setup-title serif">Why you're here.</div>
    <div style="height:18px"></div>
    <div class="check-list" id="goals-list">
      ${GOALS_OPTIONS.map(o => `
        <div class="check-row ${setupGoals.includes(o.id) ? 'active' : ''}"
             data-id="${o.id}" onclick="toggleGoal('${o.id}')">
          <div class="check-box">${setupGoals.includes(o.id) ? '✓' : ''}</div>
          <div class="check-label">${o.label}</div>
        </div>`).join('')}
    </div>`;
}
function toggleGoal(id) {
  if (setupGoals.includes(id)) setupGoals = setupGoals.filter(g => g !== id);
  else setupGoals.push(id);
  renderSetupStep();
}

// Step 6 — What would feel most helpful?
function renderSetup6(body) {
  body.innerHTML = `
    <div class="setup-label">Good to know!</div>
    <div class="setup-title serif">What would feel most helpful?</div>
    <div style="height:18px"></div>
    <div class="check-list" id="helpful-list">
      ${HELPFUL_OPTIONS.map(o => `
        <div class="check-row ${setupHelpful.includes(o.id) ? 'active' : ''}"
             data-id="${o.id}" onclick="toggleHelpful('${o.id}')">
          <div class="check-box">${setupHelpful.includes(o.id) ? '✓' : ''}</div>
          <div class="check-label">${o.label}</div>
          <div class="check-icon">💧</div>
        </div>`).join('')}
    </div>`;
}
function toggleHelpful(id) {
  if (setupHelpful.includes(id)) setupHelpful = setupHelpful.filter(h => h !== id);
  else setupHelpful.push(id);
  renderSetupStep();
}

// Step 7 — Great! Aemona will help you:
function renderSetup7(body) {
  body.innerHTML = `
    <div class="setup-title serif">Great! Aemona will help you:</div>
    <div style="height:20px"></div>
    <div class="help-list">
      <div class="help-item"><div class="help-icon">🔍</div><div class="help-text">Find the words for what you're feeling inside</div></div>
      <div class="help-item"><div class="help-icon">🧭</div><div class="help-text">Gently guide you back to yourself when it gets heavy</div></div>
      <div class="help-item"><div class="help-icon">📋</div><div class="help-text">Keep a private record of your inner world</div></div>
      <div class="help-item"><div class="help-icon">📊</div><div class="help-text">Reveal the patterns beneath your emotions</div></div>
    </div>`;
}

// Step 8 — AI analyses profile → sensitivity score (loading screen)
function renderSetup8(body) {
  body.innerHTML = `
    <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;flex:1;gap:24px;padding:40px 0">
      <div class="ai-orb"></div>
      <div class="ai-status" id="setup-ai-status">Understanding your emotional style…</div>
    </div>`;
  // Trigger AI analysis
  runProfileAnalysis();
}

async function runProfileAnalysis() {
  const status = document.getElementById('setup-ai-status');
  if (status) status.textContent = 'Personalising your experience…';

  const goalLabels    = setupGoals.map(id => GOALS_OPTIONS.find(o => o.id === id)?.label || id);
  const helpfulLabels = setupHelpful.map(id => HELPFUL_OPTIONS.find(o => o.id === id)?.label || id);

  try {
    const prompt = `You are an empathetic profiling assistant for Aemona, a gentle emotional wellness app.

A new user completed their setup:
- Goals: ${goalLabels.join('; ') || 'Not specified'}
- What would help: ${helpfulLabels.join('; ') || 'Not specified'}
- Chosen companion: ${selectedCompanion?.name || 'Not chosen'}

Generate a warm sensitivity profile. Return ONLY valid JSON, no markdown:
{
  "score": <1.0-5.0 one decimal>,
  "label": "<Grounded|Balanced|Perceptive|Sensitive|Highly Sensitive>",
  "tagline": "<8-12 words capturing their emotional style>",
  "strengths": ["<2-3 words>","<2-3 words>","<2-3 words>"],
  "challenges": ["<2-3 words>","<2-3 words>"],
  "tip": "<one gentle sentence for managing their emotional style>"
}`;

    const raw = await callAI(prompt);
    const sp  = parseJSON(raw);

    const d = getData(currentUser);
    d.sp        = sp;
    d.companion = selectedCompanion?.id || 'milo';
    d.goals     = setupGoals;
    d.helpful   = setupHelpful;
    saveData(currentUser, d);

  } catch (e) {
    console.error('Profile AI failed:', e);
    // Save fallback
    const d = getData(currentUser);
    d.sp = { score: 3.2, label: 'Perceptive', tagline: 'You notice what others miss, and feel it more deeply.', strengths: ['Deep empathy', 'Self-awareness', 'Intuition'], challenges: ['Overstimulation', 'Boundary-setting'], tip: 'Regular quiet time helps you reset and integrate.' };
    d.companion = selectedCompanion?.id || 'milo';
    saveData(currentUser, d);
  }

  // Auto-advance to step 9
  setupStep = 9;
  renderSetupStep();
}

// Step 9 — Step into your inner world
function renderSetup9(body) {
  body.innerHTML = `
    <div style="text-align:center">
      <div style="width:100%;height:220px;background:linear-gradient(145deg,#e8d8f8,#d4c4f0,#f0e8fc);border-radius:20px;display:flex;align-items:center;justify-content:center;font-size:80px;margin-bottom:28px">🌸</div>
      <div class="setup-title serif" style="margin-bottom:10px">Step into your<br>inner world.</div>
      <div class="setup-sub">Let's see what's waiting there.</div>
    </div>`;
}

function setupNext() {
  if (setupStep === 8) return; // handled by AI async
  if (setupStep < SETUP_TOTAL) {
    setupStep++;
    renderSetupStep();
  } else {
    finishSetup();
  }
}

function setupBack() {
  if (setupStep > 1) { setupStep--; renderSetupStep(); }
  else go('auth');
}

function finishSetup() {
  showBottomNav();
  setupStep = 1; setupGoals = []; setupHelpful = [];
  go('explore');
}

function skipSetup() {
  const d = getData(currentUser);
  d.companion = selectedCompanion?.id || 'milo';
  if (!d.sp) d.sp = { score: 3.0, label: 'Perceptive', tagline: 'Finding your way through feelings, one day at a time.', strengths: ['Empathy', 'Awareness'], challenges: ['Overwhelm'], tip: 'Be gentle with yourself.' };
  saveData(currentUser, d);
  showBottomNav();
  setupStep = 1;
  go('explore');
}


// ── EXPLORE (home) ────────────────────────────────────────────
function renderExplore() {
  setNavActive('explore');

  // Sensitivity card
  renderSensCard('sens-card-explore');

  // Recent entries
  const listEl  = document.getElementById('explore-hist-list');
  if (!listEl) return;
  listEl.innerHTML = '';
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const todayStr = `${year}-${month}-${day}`;
  const recs     = (getData(currentUser)?.records || []).filter(r => r.date === todayStr);
  if (!recs.length) {
    listEl.innerHTML = '<div class="empty-state">No records yet today.<br>Tap the card above to begin.</div>';
    return;
  }
  recs.forEach(r => {
    const el = document.createElement('div');
    el.className = 'recent-entry';
    el.innerHTML = `
      <div class="entry-dot" style="background:${r.planet?.gradient || r.planet?.color || '#c4b0e8'}"></div>
      <div class="entry-body">
        <div class="entry-name">${r.planet?.emotion || 'Unknown'}</div>
        <div class="entry-snip">${r.story}</div>
        <div class="entry-time">${r.time}</div>
      </div>`;
    listEl.appendChild(el);
  });
}

function renderSensCard(containerId) {
  const wrap = document.getElementById(containerId);
  if (!wrap) return;
  const d  = getData(currentUser);
  const sp = d?.sp;
  if (!sp) { wrap.innerHTML = ''; return; }
  const lv  = SENS_LEVELS.find(l => sp.score >= l.min && sp.score < l.max) || SENS_LEVELS[4];
  const pct = ((sp.score - 1) / 4 * 100).toFixed(0);
  wrap.innerHTML = `
    <div class="sens-card">
      <div class="sens-orb" style="background:${lv.color}">${sp.score}</div>
      <div class="sens-body">
        <div class="sens-label">${sp.label}</div>
        <div class="sens-score">Emotional Sensitivity · ${sp.score}/5.0</div>
        <div class="sens-bar-bg"><div class="sens-bar-fill" style="width:${pct}%;background:${lv.color}"></div></div>
        <div class="sens-tagline">${sp.tagline}</div>
        ${sp.tip ? `<div class="sens-tip">✦ ${sp.tip}</div>` : ''}
      </div>
    </div>`;
}


// ── INPUT MODAL ───────────────────────────────────────────────
function initInputModal() {
  currentStory = '';
  currentTags = {};
  const storyInput = document.getElementById('story-input');
  const charCount = document.querySelector('.story-char-count');
  
  if (storyInput) {
    storyInput.value = '';
    storyInput.placeholder = "Please enter your story here...";
    storyInput.removeAttribute('maxlength');
    if (storyInput._updateHandler) {
      storyInput.removeEventListener('input', storyInput._updateHandler);
    }
    storyInput._updateHandler = function() { updateCharCount(); };
    storyInput.addEventListener('input', storyInput._updateHandler);
  }
  if (charCount) {
    charCount.textContent = `0/${MAX_CHARS} chars`;
  }
  renderQuickTags();
}

function updateCharCount() {
  const storyInput = document.getElementById('story-input');
  const charCount = document.querySelector('.story-char-count');
  if (!storyInput || !charCount) return;
  
  let text = storyInput.value;
  let charCountNum = text.length;   
  
  if (charCountNum > MAX_CHARS) {
    text = text.substring(0, MAX_CHARS);
    storyInput.value = text;
    charCountNum = MAX_CHARS;
  }
  
  currentStory = text;
  charCount.textContent = `${charCountNum}/${MAX_CHARS} chars`;
}

function setInputMode(mode) {
  document.querySelectorAll('.mode-tab').forEach(t =>
    t.classList.toggle('active', t.dataset.mode === mode));
  // In a real app: show mic/image picker for 'say' and 'show' modes
  if (mode === 'say')  alert('Voice input would open the microphone here.');
  if (mode === 'show') alert('Image picker would open here.');
}

function renderQuickTags() {
  const sections = [
    { key: 'about',    label: 'What feels closest to this?' },
    { key: 'duration', label: 'How long has it been with you?' },
    { key: 'space',    label: 'How much space is it taking up?' },
    { key: 'body',     label: 'Notice it in your body?' }
  ];
  const wrap = document.getElementById('qtag-sections');
  if (!wrap) return;
  wrap.innerHTML = sections.map(s => `
    <div class="qtag-group">
      <div class="qtag-label">${s.label}</div>
      <div class="qtag-row">
        ${(QUICK_TAGS[s.key] || []).map((tag, i) => tag === '+'
          ? `<div class="qtag"><span class="qtag-plus">+</span></div>`
          : `<div class="qtag ${(currentTags[s.key] || []).includes(tag) ? 'active' : ''}"
                 onclick="toggleTag('${s.key}','${tag}')">${tag}</div>`
        ).join('')}
      </div>
    </div>`).join('');
}

function toggleTag(key, val) {
  if (!currentTags[key]) currentTags[key] = [];
  const idx = currentTags[key].indexOf(val);
  if (idx > -1) currentTags[key].splice(idx, 1);
  else currentTags[key].push(val);
  renderQuickTags();
}

function fillStoryPrompt(text) {
  const storyInput = document.getElementById('story-input');
  if (!storyInput) return;
  storyInput.value = text;
  currentStory = text;
  updateCharCount(); 
  storyInput.focus();
}

async function submitStory() {
  currentStory = document.getElementById('story-input').value.trim();
  if (!currentStory && Object.keys(currentTags).length === 0) {
    alert('Please write something or select some tags first.');
    return;
  }
  // Build combined context from story + tags
  const tagContext = Object.entries(currentTags)
    .filter(([, v]) => v.length > 0)
    .map(([k, v]) => `${k}: ${v.join(', ')}`)
    .join('; ');
  if (!currentStory && tagContext) currentStory = tagContext;

  go('ai-loading-page');
  setAIStatus('Reading what you shared…');
  await generateSliderQuestions();
}


// ── AI FLOW: Slider Questions ──────────────────────────────────
async function generateSliderQuestions() {
  const d    = getData(currentUser);
  const comp = selectedCompanion || COMPANIONS[0];

  const prompt = `You are ${comp.name}, a gentle emotion companion in Aemona.
The user shared: "${currentStory}"

⚠️ IMPORTANT: You MUST respond in the SAME LANGUAGE as the user's story. If the user wrote in Chinese, respond in Chinese. If the user wrote in Korean, respond in Korean. Never use English when the user used another language.

Generate exactly 8 short introspective slider questions to help them explore their emotional state.
Each question presents a spectrum between two opposite poles (not numeric, just descriptive ends).

Rules:
- Questions must reference specific details from their story
- Do NOT ask them to label the emotion directly
- Be poetic, gentle, non-clinical
- Each slider end should be a short evocative phrase (4–6 words max)

Return ONLY valid JSON, no markdown:
[
  {"q":"When this feeling shows up… what feels more true?","left":"It makes me pull inward","right":"It makes me push against something"},
  {"q":"...","left":"...","right":"..."},
  {"q":"...","left":"...","right":"..."},
  {"q":"...","left":"...","right":"..."},
  {"q":"Right now… what would help more?","left":"Feeling understood","right":"Feeling reassured"}
]`;

  try {
    setAIStatus('Crafting questions for you…');
    aiSliderQs = parseJSON(await callAI(prompt));
  } catch (e) {
    console.error('Slider Q generation failed:', e);
    aiSliderQs = FALLBACK_SLIDER_QUESTIONS;
  }

  sliderAnswers = new Array(aiSliderQs.length).fill(50);
  go('questions');
  renderSliderQuestions();
}

function renderSliderQuestions() {
  const body = document.getElementById('q-page-body');
  if (!body) return;
  body.innerHTML = '';

  const comp = selectedCompanion || COMPANIONS[0];

  // Companion bubble
  body.innerHTML = `
    <div class="companion-bubble">
      <div class="companion-avatar" style="background:${comp.color}40">${comp.emoji}</div>
      <div class="bubble-text">I've been listening. Here are some things I'd love to understand better about what you shared.</div>
    </div>`;

  // Slider questions
  aiSliderQs.forEach((q, i) => {
    const div = document.createElement('div');
    div.className = 'slider-q';
    div.innerHTML = `
      <div style="font-size:14px;color:var(--text2);line-height:1.6;margin-bottom:12px;padding:12px 14px;background:var(--surface2);border-radius:12px;font-style:italic">${q.q}</div>
      <div class="slider-bars" id="bars-${i}">
        ${Array(7).fill(0).map((_, j) => `<div class="slider-bar ${j <= 3 ? 'active' : ''}" style="height:${16 + j * 3}px"></div>`).join('')}
      </div>
      <input type="range" class="emotion-slider" min="0" max="100" value="50"
             style="--val:50%"
             oninput="onSlider(${i}, this.value)"
             onchange="onSlider(${i}, this.value)">
      <div class="slider-q-labels">
        <span>${q.left}</span>
        <span>${q.right}</span>
      </div>`;
    body.appendChild(div);
    // Step counter
    const counter = document.createElement('div');
    counter.style.cssText = 'text-align:right;font-size:11px;color:var(--muted);margin-bottom:20px';
    counter.textContent = (i + 1) + '/' + aiSliderQs.length;
    body.appendChild(counter);
  });

  const btn = document.createElement('button');
  btn.className = 'btn';
  btn.style.marginTop = '8px';
  btn.textContent = '✦ See my result';
  btn.onclick = generateResult;
  body.appendChild(btn);
}

function onSlider(i, val) {
  sliderAnswers[i] = parseInt(val);
  // update CSS var for gradient track fill
  const sliders = document.querySelectorAll('.emotion-slider');
  if (sliders[i]) sliders[i].style.setProperty('--val', val + '%');
  // update bar visualisation
  const bars = document.querySelectorAll(`#bars-${i} .slider-bar`);
  const filled = Math.round((val / 100) * (bars.length - 1));
  bars.forEach((b, j) => b.classList.toggle('active', j <= filled));
}

function setAIStatus(msg) {
  const el = document.getElementById('ai-status');
  if (el) el.textContent = msg;
}


// ── AI FLOW: Generate Result ───────────────────────────────────
async function generateResult() {
  go('ai-loading-page');
  setAIStatus('Understanding your emotional landscape…');

  const d    = getData(currentUser);
  const sp   = d.sp;
  const comp = selectedCompanion || COMPANIONS[0];

  const qAndA = aiSliderQs.map((q, i) => {
    const pct = sliderAnswers[i];
    const lean = pct < 40 ? `leaning toward "${q.left}"` : pct > 60 ? `leaning toward "${q.right}"` : 'neutral';
    return `"${q.q}" → ${lean} (${pct}/100)`;
  }).join('\n');

  const prompt = `You are an emotion analysis system for Aemona. You speak as ${comp.name}, a gentle companion.
User shared: "${currentStory}"

⚠️ IMPORTANT: You MUST respond in the SAME LANGUAGE as the user's story. If the user wrote in Chinese, respond in Chinese. If the user wrote in Korean, respond in Korean. Never use English when the user used another language.

Slider responses (0=left pole, 100=right pole):
${qAndA}

User sensitivity: ${sp ? sp.label + ' (' + sp.score + '/5)' : 'Unknown'}

Generate a warm emotion result. Return ONLY valid JSON, no markdown:
{
  "emotion": "1-2 word emotion name (e.g. Disconnected, Quietly Overwhelmed, Restless)",
  "subtitle": "short warm sentence validating the feeling (max 10 words)",
  "color1": "#hex primary",
  "color2": "#hex secondary",
  "gradient": "radial-gradient CSS string using color1/color2",
  "landscape": {
    "joy_sadness": <0-100, where 0=pure joy, 100=pure sadness>,
    "trust_disgust": <0-100, where 0=pure trust, 100=pure disgust>,
    "fear_anger": <0-100, where 0=pure fear, 100=pure anger>,
    "surprise_anticipation": <0-100, where 0=pure surprise, 100=pure anticipation>
  },
  "tools": ["<tool id from: tap|draw|breath|badge|unsent|loop>", "<second tool id>"],
  "companion_note": "1-2 sentences from ${comp.name} specifically about what the user shared, warm and poetic"
}`;

  try {
    setAIStatus('Almost there…');
    const raw  = await callAI(prompt);
    const pd   = parseJSON(raw);
    currentPlanet = {
      emotion:    pd.emotion,
      subtitle:   pd.subtitle,
      color:      pd.color1,
      gradient:   pd.gradient || `radial-gradient(circle at 35% 35%, ${lighten(pd.color1)}, ${pd.color1} 55%, ${darken(pd.color2)})`,
      landscape:  pd.landscape,
      tools:      pd.tools || ['breath', 'unsent'],
      companion_note: pd.companion_note
    };
  } catch (e) {
    console.error('Result generation failed:', e);
    currentPlanet = { ...FALLBACK_PLANET };
  }

  go('result');
  setTimeout(() => renderResult(), 50);
}

function renderResult() {
  if (!currentPlanet) return;
  document.getElementById('result-emotion').textContent  = currentPlanet.emotion;
  document.getElementById('result-subtitle').textContent = currentPlanet.subtitle;

  // Landscape bars
  const landWrap = document.getElementById('landscape-bars');
  if (landWrap) {
    landWrap.innerHTML = EMOTION_DIMENSIONS.map(dim => {
      const val = currentPlanet.landscape?.[dim.key] ?? 50;
      // bar starts from center; left means emotion is toward 'left', right toward 'right'
      const fromLeft = val < 50;
      const width    = Math.abs(val - 50) * 1.2; // exaggerate a bit
      const pos      = fromLeft ? (50 - width) : 50;
      return `
        <div class="landscape-row">
          <div class="land-left">${dim.leftEmoji} ${dim.left}</div>
          <div class="land-track">
            <div class="land-fill" style="left:${pos}%;width:${width}%;background:linear-gradient(to right,${currentPlanet.color},${lighten(currentPlanet.color)})"></div>
          </div>
          <div class="land-right">${dim.right} ${dim.rightEmoji}</div>
        </div>`;
    }).join('');
  }

  // History note
  const d    = getData(currentUser);
  const ts   = new Date().toISOString().split('T')[0];
  const prev = (d.records || []).filter(r => r.planet?.emotion === currentPlanet.emotion);
  document.getElementById('result-history-note').innerHTML = prev.length > 1
    ? `📅 You felt <span class="history-note-link" style="font-style:italic">${currentPlanet.emotion}</span> ${prev.length} times this month. <span class="history-note-link" onclick="go('entries-page')">View history ›</span>`
    : `📅 First time logging <span class="history-note-link" style="font-style:italic">${currentPlanet.emotion}</span>.`;

  // Recommended tools
  const toolsWrap = document.getElementById('result-tools');
  if (toolsWrap) {
    toolsWrap.innerHTML = (currentPlanet.tools || ['breath', 'unsent']).map(tid => {
      const t = TOOLS.find(x => x.id === tid) || TOOLS[0];
      return `
        <div class="tool-rec-card" onclick="go('${t.page}')">
          <div class="tool-rec-info">
            <div class="tool-rec-name">${t.name}</div>
            <div class="tool-rec-desc">${t.desc}</div>
          </div>
          <div class="tool-rec-icon">${t.emoji}</div>
        </div>`;
    }).join('');
  }

  // Companion note
  const noteEl = document.getElementById('companion-note');
  if (noteEl && currentPlanet.companion_note) {
    noteEl.textContent = currentPlanet.companion_note;
  }
}

function saveResult() {
  if (!currentPlanet) return;
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const localDate = `${year}-${month}-${day}`;  // 格式 "YYYY-MM-DD"
  const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  
  const d = getData(currentUser);
  d.records = [{
    date:   localDate,
    time:   timeStr,
    story:  currentStory,
    planet: currentPlanet
  }, ...(d.records || [])];
  d.cover = d.cover || {};
  d.cover[todayD] = currentPlanet;
  saveData(currentUser, d);
  go('explore');
}
function lighten(hex) {
  if (!hex || !hex.startsWith('#')) return hex;
  const r = parseInt(hex.slice(1,3),16), g = parseInt(hex.slice(3,5),16), b = parseInt(hex.slice(5,7),16);
  return `rgb(${Math.min(255,r+70)},${Math.min(255,g+70)},${Math.min(255,b+70)})`;
}
function darken(hex) {
  if (!hex || !hex.startsWith('#')) return hex;
  const r = parseInt(hex.slice(1,3),16), g = parseInt(hex.slice(3,5),16), b = parseInt(hex.slice(5,7),16);
  return `rgb(${Math.max(0,r-40)},${Math.max(0,g-40)},${Math.max(0,b-40)})`;
}


// ── ENTRIES PAGE ──────────────────────────────────────────────
function renderEntries() {
  const months = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'];
  const today = new Date();
  const todayYear = today.getFullYear();
  const todayMonth = today.getMonth();
  const todayDate = today.getDate();

  const userData = getData(currentUser);
  const allRecords = userData.records || [];

  const filteredRecords = allRecords.filter(rec => {
    const [year, month] = rec.date.split('-').map(Number);
    return year === currentEntriesYear && (month - 1) === currentEntriesMonth;
  });

  const dailyLatestMap = new Map();
  filteredRecords.forEach(rec => {
    const dayNum = parseInt(rec.date.split('-')[2], 10);
    if (!dailyLatestMap.has(dayNum) || rec.time > dailyLatestMap.get(dayNum).time) {
      dailyLatestMap.set(dayNum, rec);
    }
  });

  const latestCover = {};
  dailyLatestMap.forEach((rec, dayNum) => {
    latestCover[dayNum] = rec.planet;
  });

  const firstDay = new Date(currentEntriesYear, currentEntriesMonth, 1).getDay();
  const daysInMonth = new Date(currentEntriesYear, currentEntriesMonth + 1, 0).getDate();

  const grid = document.getElementById('e-cal-grid');
  if (!grid) return;
  grid.innerHTML = '';

  for (let i = 0; i < firstDay; i++) {
    const emptyDiv = document.createElement('div');
    emptyDiv.className = 'e-cal-day empty';
    grid.appendChild(emptyDiv);
  }

  for (let d = 1; d <= daysInMonth; d++) {
    const dayDiv = document.createElement('div');
    dayDiv.className = 'e-cal-day';
    dayDiv.textContent = d;

    const planet = latestCover[d];
    if (planet) {
      dayDiv.classList.add('has-entry');
      const bgGradient = planet.gradient || `radial-gradient(circle, ${planet.color}, ${planet.color} 80%)`;
      dayDiv.style.background = bgGradient;
      dayDiv.style.backgroundSize = 'cover';
      dayDiv.style.backgroundPosition = 'center';
      dayDiv.style.color = 'white';
      dayDiv.style.textShadow = '0 1px 2px rgba(0,0,0,0.2)';
      dayDiv.style.fontWeight = '600';
      dayDiv.style.cursor = 'pointer';

      const yearStr = currentEntriesYear;
      const monthStr = String(currentEntriesMonth + 1).padStart(2, '0');
      const dayStr = String(d).padStart(2, '0');
      const fullDate = `${yearStr}-${monthStr}-${dayStr}`;
      const dayRecords = allRecords.filter(r => r.date === fullDate);

      dayDiv.onclick = (function(recs, dateStr) {
        return function() { showDayRecordsModal(recs, dateStr); };
      })(dayRecords, fullDate);
    } else {
      dayDiv.style.background = 'var(--surface2)';
      dayDiv.style.color = 'var(--muted)';
    }

    if (currentEntriesYear === todayYear && currentEntriesMonth === todayMonth && d === todayDate) {
      dayDiv.classList.add('today');
    }
    grid.appendChild(dayDiv);
  }

  const tabWrap = document.getElementById('month-tabs');
  if (tabWrap) {
    let prevYear = currentEntriesYear, prevMonth = currentEntriesMonth - 1;
    if (prevMonth < 0) { prevMonth = 11; prevYear--; }
    let nextYear = currentEntriesYear, nextMonth = currentEntriesMonth + 1;
    if (nextMonth > 11) { nextMonth = 0; nextYear++; }
    tabWrap.innerHTML = `
      <div class="month-tab" data-year="${prevYear}" data-month="${prevMonth}" onclick="switchEntriesMonth(this)">${months[prevMonth]} ${prevYear}</div>
      <div class="month-tab active">${months[currentEntriesMonth]} ${currentEntriesYear}</div>
      <div class="month-tab" data-year="${nextYear}" data-month="${nextMonth}" onclick="switchEntriesMonth(this)">${months[nextMonth]} ${nextYear}</div>
      <div class="month-tab today-tab" onclick="goToCurrentMonth()">Today</div>
    `;
  }

  const subtitle = document.querySelector('#entries-page .entries-subtitle');
  if (subtitle) subtitle.textContent = `Emotions recorded in ${months[currentEntriesMonth]} ${currentEntriesYear}`;
}

function switchEntriesMonth(tabElement) {
  const year = parseInt(tabElement.getAttribute('data-year'));
  const month = parseInt(tabElement.getAttribute('data-month'));
  if (isNaN(year) || isNaN(month)) return;
  currentEntriesYear = year;
  currentEntriesMonth = month;
  renderEntries();
}

function goToCurrentMonth() {
  const now = new Date();
  currentEntriesYear = now.getFullYear();
  currentEntriesMonth = now.getMonth();
  renderEntries();
}

function switchEntriesMonth(tabElement) {
  const year = parseInt(tabElement.getAttribute('data-year'));
  const month = parseInt(tabElement.getAttribute('data-month'));
  if (isNaN(year) || isNaN(month)) return;
  currentEntriesYear = year;
  currentEntriesMonth = month;
  renderEntries();
}

function goToCurrentMonth() {
  const now = new Date();
  currentEntriesYear = now.getFullYear();
  currentEntriesMonth = now.getMonth();
  renderEntries();
}

function ensureModal() {
  if (document.getElementById('record-modal')) return;
  const modalHTML = `
    <div id="record-modal" class="record-modal" style="display:none;">
      <div class="record-modal-content">
        <div class="record-modal-header">
          <span class="record-modal-date"></span>
          <button class="record-modal-close">&times;</button>
        </div>
        <div class="record-modal-body"></div>
      </div>
    </div>
  `;
  document.body.insertAdjacentHTML('beforeend', modalHTML);
  const modal = document.getElementById('record-modal');
  const closeBtn = modal.querySelector('.record-modal-close');
  closeBtn.onclick = () => modal.style.display = 'none';
  modal.onclick = (e) => { if (e.target === modal) modal.style.display = 'none'; };
}

function showDayRecordsModal(records) {
  if (!records || records.length === 0) return;
  ensureModal();
  const modal = document.getElementById('record-modal');
  const dateSpan = modal.querySelector('.record-modal-date');
  const bodyDiv = modal.querySelector('.record-modal-body');
  
  const dateStr = records[0].date;
  dateSpan.textContent = `📅 ${dateStr}`;
  
  let html = '';
  records.forEach((rec, idx) => {
    const planet = rec.planet || { name: 'undefined', emotion: '', color: '#9b8ec4', gradient: null };
    const bgStyle = planet.gradient ? `background: ${planet.gradient};` : `background: ${planet.color};`;
    html += `
      <div class="record-modal-item" style="${bgStyle}">
        <div class="record-item-header">
          <span class="record-item-time">${rec.time || '--:--'}</span>
          <span class="record-item-emotion">${planet.emotion}</span>
        </div>
        <div class="record-item-story">${escapeHtml(rec.story)}</div>
      </div>
    `;
  });
  bodyDiv.innerHTML = html;
  modal.style.display = 'flex';
}


function escapeHtml(text) {
  if (!text) return '';
  return text.replace(/[&<>]/g, function(m) {
    if (m === '&') return '&amp;';
    if (m === '<') return '&lt;';
    if (m === '>') return '&gt;';
    return m;
  }).replace(/[\uD800-\uDBFF][\uDC00-\uDFFF]/g, function(c) {
    return c;
  });
}

// ── PATTERNS PAGE ─────────────────────────────────────────────
function renderPatterns() {
  const d       = getData(currentUser);
  const records = d.records || [];

  // Streak (consecutive days)
  let streak = 0, recordStreak = 0;
  const today = new Date(); today.setHours(0,0,0,0);
  for (let i = 0; i <= 60; i++) {
    const dt  = new Date(today); dt.setDate(dt.getDate() - i);
    const str = dt.toISOString().split('T')[0];
    if (records.some(r => r.date === str)) { streak = i === streak ? streak + 1 : streak; }
  }
  streak = records.length > 0 ? Math.min(records.length, 12) : 0; // simplified
  recordStreak = Math.max(streak, records.length > 0 ? 34 : 0);

  const sEl = document.getElementById('streak-current');
  const rEl = document.getElementById('streak-record');
  if (sEl) sEl.textContent = streak;
  if (rEl) rEl.textContent = recordStreak;

  // Stats
  const emotions = records.map(r => r.planet?.emotion).filter(Boolean);
  const topEmotion = emotions.length
    ? Object.entries(emotions.reduce((acc, e) => ({ ...acc, [e]: (acc[e] || 0) + 1 }), {}))
        .sort((a,b) => b[1] - a[1])[0]?.[0]
    : '—';

  const sEntries   = document.getElementById('stat-entries');
  const sEmotions  = document.getElementById('stat-emotions');
  const sCheckIns  = document.getElementById('stat-checkins');
  const sTopEmotion = document.getElementById('top-emotion-name');

  if (sEntries)   sEntries.textContent   = records.length;
  if (sEmotions)  sEmotions.textContent  = new Set(emotions).size;
  if (sCheckIns)  sCheckIns.textContent  = records.length;
  if (sTopEmotion) sTopEmotion.textContent = topEmotion;
}

function switchPatternsTab(tab) {
  document.querySelectorAll('.patterns-tab').forEach(t =>
    t.classList.toggle('active', t.dataset.tab === tab));
}


// ── REGULATION: DRAG ──────────────────────────────────────────
function enableDrag() {
  const ball = document.getElementById('drag-ball');
  const area = document.getElementById('drag-area');
  if (!ball || !area) return;
  ball.style.left = (area.offsetWidth  / 2 - 35) + 'px';
  ball.style.top  = (area.offsetHeight / 2 - 35) + 'px';
  let drag = false, ox = 0, oy = 0;
  const down = e => {
    drag = true;
    const pt = e.touches ? e.touches[0] : e, br = ball.getBoundingClientRect();
    ox = pt.clientX - br.left; oy = pt.clientY - br.top; e.preventDefault();
  };
  const move = e => {
    if (!drag) return;
    const pt = e.touches ? e.touches[0] : e, r = area.getBoundingClientRect();
    const x  = Math.max(0, Math.min(pt.clientX - r.left - ox, r.width  - 70));
    const y  = Math.max(0, Math.min(pt.clientY - r.top  - oy, r.height - 70));
    ball.style.left = x + 'px'; ball.style.top = y + 'px';
    const t = document.createElement('div'); t.className = 'drag-trail';
    t.style.cssText = `left:${x+15}px;top:${y+15}px;width:40px;height:40px;background:rgba(107,79,160,0.15)`;
    area.appendChild(t); setTimeout(() => t.remove(), 900);
  };
  ball.addEventListener('mousedown', down);
  ball.addEventListener('touchstart', down, { passive: false });
  document.addEventListener('mousemove', move);
  document.addEventListener('touchmove', move, { passive: false });
  document.addEventListener('mouseup',  () => drag = false);
  document.addEventListener('touchend', () => drag = false);
}


// ── REGULATION: BREATH ────────────────────────────────────────
function startBreath() {
  const lbl    = document.getElementById('breath-label');
  if (!lbl) return;
  const phases = ['Breathe in…', 'Hold…', 'Breathe out…', 'Hold…'];
  let p = 0; lbl.textContent = phases[0];
  breathTimer = setInterval(() => { p = (p + 1) % 4; lbl.textContent = phases[p]; }, 4000);
}
function stopBreath() { if (breathTimer) { clearInterval(breathTimer); breathTimer = null; } }


// ── REGULATION: CLEAR ─────────────────────────────────────────
function spawnClearBalls() {
  const area = document.getElementById('clear-area');
  if (!area) return;
  area.innerHTML = '';
  const emojis = ['😔','😰','😤','😞','😓','🌧','💭','😟'];
  const colors  = ['#c084fc','#818cf8','#60a5fa','#34d399','#fbbf24','#f87171','#e879f9','#a78bfa'];
  for (let i = 0; i < 7; i++) {
    const b = document.createElement('div'); b.className = 'clear-ball';
    b.textContent = emojis[i % emojis.length];
    b.style.left  = (10 + Math.random() * (area.offsetWidth  - 80)) + 'px';
    b.style.top   = (10 + Math.random() * (area.offsetHeight - 80)) + 'px';
    b.style.background = colors[i % colors.length];
    b.addEventListener('click', () => {
      b.classList.add('removing');
      setTimeout(() => {
        b.remove();
        if (!document.querySelector('.clear-ball'))
          area.innerHTML = '<div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;color:var(--muted);font-size:13px;letter-spacing:0.06em">✦ Space created</div>';
      }, 300);
    });
    area.appendChild(b);
  }
}
