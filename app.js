// ============================================================
// app.js — Aemona frontend logic
// All AI calls go to /api/ai (our local server), never directly
// to Anthropic. The API key lives only in .env on the server.
// Depends on: data.js (loaded first in index.html)
// ============================================================

// ── GLOBAL STATE ─────────────────────────────────────────────
let currentUser    = null;   // signed-in username
let currentStory   = '';     // story entered on "Today" screen
let currentPlanet  = null;   // planet object from AI
let aiQuestions    = [];     // [{q:"..."}] from AI
let selAnswers     = [];     // user's 1-5 answers to aiQuestions
let onboardAnswers = new Array(5).fill(null);
let breathInterval = null;

const today        = new Date().getDate();
const currentMonth = new Date().getMonth();
const currentYear  = new Date().getFullYear();


// ── STORAGE HELPERS ───────────────────────────────────────────
function getUsers()             { return JSON.parse(localStorage.getItem('aemona_users') || '{}'); }
function saveUsers(u)           { localStorage.setItem('aemona_users', JSON.stringify(u)); }
function getUserData(name)      { return JSON.parse(localStorage.getItem('aemona_data_' + name) || '{"records":[],"calendarCover":{},"profile":null,"sensitivityProfile":null}'); }
function saveUserData(name, d)  { localStorage.setItem('aemona_data_' + name, JSON.stringify(d)); }


// ── AI HELPER ─────────────────────────────────────────────────
// All AI calls go through this one function.
// It talks to our own server (/api/ai), which holds the API key.
async function callAI(prompt) {
  const res  = await fetch('/api/ai', {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ prompt })
  });
  const data = await res.json();
  if (data.error) throw new Error(data.error);
  return data.result;   // plain text string from the AI
}

// Parse JSON that may be wrapped in markdown code fences
function parseJSON(text) {
  return JSON.parse(text.replace(/```json|```/g, '').trim());
}


// ── INIT ──────────────────────────────────────────────────────
(function init() {
  const saved = localStorage.getItem('aemona_current_user');
  if (saved) {
    currentUser = saved;
    const data  = getUserData(currentUser);
    go(data.profile ? 'calendar' : 'onboarding');
  } else {
    go('welcome');
  }
})();


// ── NAVIGATION ────────────────────────────────────────────────
function go(pageId) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('show'));
  const page = document.getElementById(pageId);
  if (page) page.classList.add('show');

  switch (pageId) {
    case 'onboarding': renderOnboarding();                                         break;
    case 'calendar':   renderCalendar(); renderTodayHistory(); renderSensitivity(); updateCalHeader(); break;
    case 'reg-drag':   enableDrag();                                               break;
    case 'reg-pinch':  enablePinch();                                              break;
    case 'reg-breath': startBreath();                                              break;
    case 'reg-clear':  spawnClearBalls();                                          break;
    case 'today':      document.getElementById('story').value = '';               break;
  }
}


// ── AUTH ──────────────────────────────────────────────────────
function switchAuthTab(tab) {
  ['login','register'].forEach(t => {
    document.getElementById('tab-' + t).classList.toggle('active', t === tab);
    document.getElementById(t + '-form').style.display = t === tab ? 'flex' : 'none';
  });
}

function showError(id, msg) { const el = document.getElementById(id); el.textContent = msg; el.classList.add('show'); }
function clearError(id)     { document.getElementById(id).classList.remove('show'); }

function handleLogin() {
  clearError('login-error');
  const username = document.getElementById('login-username').value.trim();
  const password = document.getElementById('login-password').value;
  if (!username || !password) { showError('login-error','Please fill in all fields.'); return; }

  const users = getUsers();
  if (!users[username])                            { showError('login-error','Username not found.'); return; }
  if (users[username].password !== btoa(password)) { showError('login-error','Incorrect password.'); return; }

  currentUser = username;
  localStorage.setItem('aemona_current_user', currentUser);
  go(getUserData(currentUser).profile ? 'calendar' : 'onboarding');
}

function handleRegister() {
  clearError('register-error');
  const username = document.getElementById('reg-username').value.trim();
  const password = document.getElementById('reg-password').value;
  const confirm  = document.getElementById('reg-confirm').value;

  if (!username || !password || !confirm)    { showError('register-error','Please fill in all fields.'); return; }
  if (username.length < 3)                   { showError('register-error','Username must be at least 3 characters.'); return; }
  if (password.length < 6)                   { showError('register-error','Password must be at least 6 characters.'); return; }
  if (password !== confirm)                  { showError('register-error','Passwords do not match.'); return; }
  if (getUsers()[username])                  { showError('register-error','Username already taken.'); return; }

  const users = getUsers();
  users[username] = { password: btoa(password), createdAt: Date.now() };
  saveUsers(users);
  currentUser = username;
  localStorage.setItem('aemona_current_user', currentUser);
  go('onboarding');
}

function handleLogout() {
  currentUser = null;
  localStorage.removeItem('aemona_current_user');
  go('welcome');
}


// ── ONBOARDING ────────────────────────────────────────────────
function renderOnboarding() {
  onboardAnswers = new Array(5).fill(null);
  const box = document.getElementById('onboardBox');
  box.innerHTML = '';
  ONBOARDING_QUESTIONS.forEach((q, i) => {
    const div = document.createElement('div');
    div.className = 'question-block';
    div.innerHTML = `<p>${q}</p><div class="options">
      ${[1,2,3,4,5].map(v => `<div class="option" onclick="selOnboard(${i},${v})">${v}</div>`).join('')}
    </div>`;
    box.appendChild(div);
  });
  updateOnboardProgress();
}

function selOnboard(i, v) {
  onboardAnswers[i] = v;
  document.querySelectorAll('#onboardBox .question-block')[i]
    .querySelectorAll('.option')
    .forEach((o, j) => o.classList.toggle('active', j + 1 === v));
  updateOnboardProgress();
}

function updateOnboardProgress() {
  const filled = onboardAnswers.filter(a => a !== null).length;
  document.getElementById('onboard-fill').style.width = (filled / 5 * 100) + '%';
}

// When the user submits onboarding:
// 1. Save the raw answers
// 2. Ask the AI to analyse them and produce a sensitivity profile
// 3. Save the AI profile and show the calendar
async function finishOnboarding() {
  if (onboardAnswers.includes(null)) { alert('Please answer all 5 questions!'); return; }

  const btn = document.querySelector('#onboarding .btn');
  btn.disabled     = true;
  btn.textContent  = 'Analysing with AI…';

  const data = getUserData(currentUser);
  data.profile = onboardAnswers;

  try {
    data.sensitivityProfile = await analyseOnboardingWithAI(onboardAnswers);
  } catch (e) {
    // If AI fails, calculate a basic score from the answers
    data.sensitivityProfile = buildFallbackSensitivityProfile(onboardAnswers);
  }

  saveUserData(currentUser, data);
  btn.disabled    = false;
  btn.textContent = 'Save & Continue';
  go('calendar');
}

// ── AI: Onboarding Analysis ────────────────────────────────────
// Sends the 5 answers to AI and gets back a sensitivity profile object.
async function analyseOnboardingWithAI(answers) {
  const lines = ONBOARDING_QUESTIONS
    .map((q, i) => `${PROFILE_DIMENSIONS[i]}: ${answers[i]}/5`)
    .join('\n');

  const prompt = `You are an empathetic psychological profiling assistant for Aemona, a gentle emotional wellness app.

A user completed a 5-question sensitivity onboarding (1=low, 5=high):
${lines}

Based on these answers, generate a warm, non-clinical personality sensitivity profile.

Return ONLY valid JSON in this exact format, no preamble, no markdown:
{
  "score": <number 1.0–5.0, one decimal, average of the 5 answers weighted by emotional impact>,
  "label": "<one of: Grounded | Balanced | Perceptive | Sensitive | Highly Sensitive>",
  "tagline": "<8–12 word phrase capturing their core emotional style, e.g. 'A deep feeler who processes the world with quiet intensity'>",
  "strengths": ["<strength 1>", "<strength 2>", "<strength 3>"],
  "challenges": ["<challenge 1>", "<challenge 2>"],
  "tip": "<one gentle, practical sentence for managing their emotional style>"
}`;

  const raw = await callAI(prompt);
  return parseJSON(raw);
}

// Fallback if AI is unavailable
function buildFallbackSensitivityProfile(answers) {
  const score = answers.reduce((a, b) => a + b, 0) / answers.length;
  const level = SENSITIVITY_LEVELS.find(l => score >= l.min && score <= l.max)
    || SENSITIVITY_LEVELS[SENSITIVITY_LEVELS.length - 1];
  return {
    score:      +score.toFixed(1),
    label:      level.label,
    tagline:    level.desc,
    strengths:  ["Deep empathy", "Strong intuition", "Emotional awareness"],
    challenges: ["Overstimulation", "Difficulty setting boundaries"],
    tip:        "Regular quiet time helps you reset and process your experiences."
  };
}


// ── CALENDAR / HOME ───────────────────────────────────────────
function updateCalHeader() {
  if (!currentUser) return;
  document.getElementById('cal-avatar').textContent   = currentUser.charAt(0).toUpperCase();
  document.getElementById('cal-username').textContent = currentUser;
}

// Renders the AI-generated sensitivity card at the top of the home screen
function renderSensitivity() {
  const container = document.getElementById('sensitivity-card-wrap');
  if (!container) return;

  const data = getUserData(currentUser);
  const sp   = data.sensitivityProfile;
  if (!sp) { container.innerHTML = ''; return; }

  // Find the matching level for colour
  const level = SENSITIVITY_LEVELS.find(l => sp.score >= l.min && sp.score <= l.max)
    || SENSITIVITY_LEVELS[SENSITIVITY_LEVELS.length - 1];

  const pct = ((sp.score - 1) / 4 * 100).toFixed(0);

  container.innerHTML = `
    <div class="sensitivity-card">
      <div class="sensitivity-orb" style="background:${level.color}">
        ${sp.score}
      </div>
      <div class="sensitivity-info">
        <div class="sensitivity-label">${sp.label}</div>
        <div class="sensitivity-score">Emotional Sensitivity · ${sp.score} / 5.0</div>
        <div class="sensitivity-bar-wrap">
          <div class="sensitivity-bar" style="width:${pct}%;background:${level.color}"></div>
        </div>
        <div class="sensitivity-desc">${sp.tagline}</div>
        ${sp.tip ? `<div class="sensitivity-ai-note">✦ ${sp.tip}</div>` : ''}
      </div>
    </div>`;
}

function renderCalendar() {
  const months = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  document.getElementById('calendar-month-year').textContent = `${months[currentMonth]} ${currentYear}`;

  const grid      = document.getElementById('calendar-grid');
  grid.innerHTML  = '';
  const firstDay  = new Date(currentYear, currentMonth, 1).getDay();
  const daysInMon = new Date(currentYear, currentMonth + 1, 0).getDate();
  const cover     = getUserData(currentUser).calendarCover || {};

  for (let i = 0; i < firstDay; i++) grid.appendChild(document.createElement('div'));
  for (let d = 1; d <= daysInMon; d++) {
    const el = document.createElement('div');
    el.className   = 'calendar-day';
    el.textContent = d;
    if (cover[d]) { el.classList.add('has-planet'); el.style.background = cover[d].gradient || cover[d].color; }
    if (d === today) el.classList.add('today-marker');
    grid.appendChild(el);
  }
}

function renderTodayHistory() {
  const list    = document.getElementById('today-history-list');
  list.innerHTML = '';
  const todayStr = new Date().toISOString().split('T')[0];
  const recs     = (getUserData(currentUser).records || []).filter(r => r.date === todayStr);

  if (!recs.length) {
    list.innerHTML = '<div class="empty-state">No records yet today.<br>Tap + to add one.</div>';
    return;
  }
  recs.forEach(r => {
    const item = document.createElement('div');
    item.className = 'history-item';
    item.innerHTML = `
      <div class="history-planet" style="background:${r.planet.gradient || r.planet.color}"></div>
      <div class="history-content">
        <div class="history-planet-name">${r.planet.name}</div>
        <div class="history-text">${r.story}</div>
        <div class="history-time">${r.time} · ${r.planet.emotion || ''}</div>
      </div>`;
    list.appendChild(item);
  });
}


// ── FAB ───────────────────────────────────────────────────────
function toggleFab() { document.getElementById('fabMenu').classList.toggle('open'); }
function closeFab()  { document.getElementById('fabMenu').classList.remove('open'); }


// ── AI FLOW: Step 1 — Generate Questions ──────────────────────
async function goToAIQuestions() {
  currentStory = document.getElementById('story').value.trim();
  if (!currentStory) { alert('Please write something first.'); return; }

  go('ai-loading-page');
  setAIStatus('Reading your story…');

  const prompt = `You are a gentle emotion exploration assistant for Aemona, a mental wellness app.
The user wrote: "${currentStory}"

Generate exactly 4 short introspective questions to help them explore their emotional state.
Rules:
- Base each question on specific details from their story
- Do NOT ask them to name or label the emotion directly
- Be gentle, non-clinical, non-judgmental
- Focus on bodily sensations, thoughts, or situational awareness
- Each suits a 1 (low) to 5 (high) response scale

Return ONLY valid JSON, no preamble, no markdown:
[
  {"q": "question text"},
  {"q": "question text"},
  {"q": "question text"},
  {"q": "question text"}
]`;

  try {
    setAIStatus('Crafting questions for you…');
    aiQuestions = parseJSON(await callAI(prompt));
  } catch (e) {
    console.error('Question generation failed:', e);
    aiQuestions = FALLBACK_QUESTIONS;
  }

  go('questions');
  renderAIQuestions();
}

function renderAIQuestions() {
  const box     = document.getElementById('qBox');
  box.innerHTML = '';
  selAnswers    = new Array(aiQuestions.length).fill(null);
  aiQuestions.forEach((q, i) => {
    const div = document.createElement('div');
    div.className = 'question-block';
    div.innerHTML = `<p>${q.q}</p><div class="options">
      ${[1,2,3,4,5].map(v => `<div class="option" onclick="selQ(${i},${v})">${v}</div>`).join('')}
    </div>`;
    box.appendChild(div);
  });
}

function selQ(i, v) {
  selAnswers[i] = v;
  document.querySelectorAll('#qBox .question-block')[i]
    .querySelectorAll('.option')
    .forEach((o, j) => o.classList.toggle('active', j + 1 === v));
}


// ── AI FLOW: Step 2 — Generate Planet ─────────────────────────
async function generatePlanet() {
  if (selAnswers.some(a => a === null)) { alert('Please answer all questions!'); return; }

  go('ai-loading-page');
  setAIStatus('Shaping your emotion planet…');

  const data    = getUserData(currentUser);
  const profile = data.profile || [3,3,3,3,3];
  const sp      = data.sensitivityProfile;
  const qAndA   = aiQuestions.map((q, i) => `${q.q}: ${selAnswers[i]}/5`).join('\n');

  const prompt = `You are an emotion analysis system for Aemona, a gentle mental wellness app.

The user wrote: "${currentStory}"

Their answers to follow-up questions (1=low, 5=high):
${qAndA}

Their sensitivity profile:
- Overwhelm sensitivity:  ${profile[0]}/5
- Pressure sensitivity:   ${profile[1]}/5
- Overthinking tendency:  ${profile[2]}/5
- Emotional intensity:    ${profile[3]}/5
- Need for solitude:      ${profile[4]}/5
${sp ? `- Overall sensitivity label: ${sp.label} (score ${sp.score}/5)` : ''}

Generate an "emotion planet" representing their current state.

Return ONLY valid JSON, no preamble, no markdown:
{
  "name":        "1–2 word evocative planet name (e.g. Duskfall, Gentle Storm, Quiet Haze)",
  "emotion":     "short emotion label (e.g. Overwhelmed, Quietly Anxious, Restless but Hopeful)",
  "color1":      "#hexcolor — dominant emotional tone",
  "color2":      "#hexcolor — secondary shade",
  "description": "2–3 warm non-judgmental sentences. Validate, don't analyse. Be poetic and gentle.",
  "hasRing":     true or false
}`;

  try {
    setAIStatus('Almost there…');
    const raw        = await callAI(prompt);
    const planetData = parseJSON(raw);
    currentPlanet = {
      name:        planetData.name,
      emotion:     planetData.emotion,
      color:       planetData.color1,
      gradient:    `radial-gradient(circle at 35% 35%, ${lighten(planetData.color1)}, ${planetData.color1} 55%, ${planetData.color2})`,
      description: planetData.description,
      hasRing:     planetData.hasRing
    };
  } catch (e) {
    console.error('Planet generation failed:', e);
    currentPlanet = FALLBACK_PLANET;
  }

  renderResult();
  go('result');
}

function setAIStatus(msg) {
  const el = document.getElementById('ai-status-text');
  if (el) el.textContent = msg;
}

function lighten(hex) {
  const r = parseInt(hex.slice(1,3), 16);
  const g = parseInt(hex.slice(3,5), 16);
  const b = parseInt(hex.slice(5,7), 16);
  return `rgb(${Math.min(255,r+60)},${Math.min(255,g+60)},${Math.min(255,b+60)})`;
}

function renderResult() {
  document.getElementById('planet-orb').style.background   = currentPlanet.gradient;
  document.getElementById('planet-ring').style.display      = currentPlanet.hasRing ? 'block' : 'none';
  document.getElementById('planet-name').textContent        = currentPlanet.name;
  document.getElementById('emotion-label').textContent      = currentPlanet.emotion;
  document.getElementById('emotion-label').style.background = currentPlanet.color + '33';
  document.getElementById('analysis-text').textContent      = currentPlanet.description;
}


// ── SAVE ──────────────────────────────────────────────────────
function saveToCalendar() {
  const now     = new Date();
  const dateStr = now.toISOString().split('T')[0];
  const timeStr = now.toLocaleTimeString([], { hour:'2-digit', minute:'2-digit' });

  const data = getUserData(currentUser);
  data.records       = [{ date:dateStr, time:timeStr, story:currentStory, planet:currentPlanet }, ...(data.records||[])];
  data.calendarCover = data.calendarCover || {};
  data.calendarCover[today] = currentPlanet;
  saveUserData(currentUser, data);
  go('calendar');
}


// ── REGULATION: DRAG ──────────────────────────────────────────
function enableDrag() {
  const ball = document.getElementById('dragBall');
  const area = document.getElementById('dragArea');
  if (!ball || !area) return;

  ball.style.left = (area.offsetWidth  / 2 - 36) + 'px';
  ball.style.top  = (area.offsetHeight / 2 - 36) + 'px';

  let dragging = false, ox = 0, oy = 0;

  ball.addEventListener('mousedown', e => {
    dragging = true;
    const br = ball.getBoundingClientRect();
    ox = e.clientX - br.left; oy = e.clientY - br.top;
    e.preventDefault();
  });
  ball.addEventListener('touchstart', e => {
    dragging = true;
    const pt = e.touches[0], br = ball.getBoundingClientRect();
    ox = pt.clientX - br.left; oy = pt.clientY - br.top;
    e.preventDefault();
  }, { passive: false });

  const move = e => {
    if (!dragging) return;
    const pt = e.touches ? e.touches[0] : e;
    const r  = area.getBoundingClientRect();
    let x = Math.max(0, Math.min(pt.clientX - r.left - ox, r.width  - 72));
    let y = Math.max(0, Math.min(pt.clientY - r.top  - oy, r.height - 72));
    ball.style.left = x + 'px';
    ball.style.top  = y + 'px';
    const t = document.createElement('div');
    t.className = 'drag-trail';
    t.style.cssText = `left:${x+16}px;top:${y+16}px;width:40px;height:40px;background:rgba(123,159,212,0.25)`;
    area.appendChild(t);
    setTimeout(() => t.remove(), 800);
  };
  const up = () => { dragging = false; };

  document.addEventListener('mousemove', move);
  document.addEventListener('touchmove', move, { passive: false });
  document.addEventListener('mouseup',   up);
  document.addEventListener('touchend',  up);
}


// ── REGULATION: PINCH ─────────────────────────────────────────
function enablePinch() {
  const ball    = document.getElementById('pinchBall');
  const counter = document.getElementById('pinch-count');
  if (!ball) return;
  let squeezes = 0;
  const press   = () => { ball.style.transform = 'scale(0.2)'; };
  const release = () => {
    ball.style.transform = 'scale(1)';
    counter.textContent  = `Released ${++squeezes} time${squeezes !== 1 ? 's' : ''}`;
  };
  ball.addEventListener('mousedown',  press);
  ball.addEventListener('touchstart', press,   { passive: true });
  ball.addEventListener('mouseup',    release);
  ball.addEventListener('mouseleave', release);
  ball.addEventListener('touchend',   release);
}


// ── REGULATION: BREATH ────────────────────────────────────────
function startBreath() {
  const label  = document.getElementById('breathLabel');
  if (!label) return;
  const phases = ['Breathe in…','Hold…','Breathe out…','Hold…'];
  let phase    = 0;
  label.textContent = phases[0];
  breathInterval    = setInterval(() => { phase = (phase + 1) % 4; label.textContent = phases[phase]; }, 4000);
}
function stopBreath() { if (breathInterval) { clearInterval(breathInterval); breathInterval = null; } }


// ── REGULATION: CLEAR ─────────────────────────────────────────
function spawnClearBalls() {
  const area = document.getElementById('clearArea');
  if (!area) return;
  area.innerHTML = '';
  for (let i = 0; i < 7; i++) {
    const b = document.createElement('div');
    b.className  = 'clear-ball';
    b.textContent = CLEAR_WORRIES[i % CLEAR_WORRIES.length];
    b.style.left  = (10 + Math.random() * (area.offsetWidth  - 80)) + 'px';
    b.style.top   = (10 + Math.random() * (area.offsetHeight - 80)) + 'px';
    b.style.background = CLEAR_COLORS[i % CLEAR_COLORS.length];
    b.addEventListener('click', () => {
      b.classList.add('removing');
      setTimeout(() => {
        b.remove();
        if (!document.querySelector('.clear-ball'))
          area.innerHTML = '<div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;color:var(--muted);font-size:14px;">✦ Space created</div>';
      }, 300);
    });
    area.appendChild(b);
  }
}
