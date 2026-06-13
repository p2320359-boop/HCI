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
const MAX_CHARS = 1000;   
let currentEntriesYear  = new Date().getFullYear();
let currentEntriesMonth = new Date().getMonth();
let selectedEntriesDate = '';
let currentPatternsTab = 'overview';
let selectedNoteEmotion = 'Exhilarated';
let selectedNoteGroup = 6;
let switchingEntryMode = false;
let noteFamilyScrollTimer = null;


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
  if (!text) throw new Error('Empty AI response');
  // Strip markdown fences
  let cleaned = text.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
  // Try direct parse first
  try { return JSON.parse(cleaned); } catch(e) {}
  // Extract JSON array first (appears before object in most AI responses)
  const arrMatch = cleaned.match(/\[[\s\S]*\]/);
  const objMatch = cleaned.match(/\{[\s\S]*\}/);
  if (arrMatch && objMatch) {
    if (arrMatch.index < objMatch.index) {
      try { return JSON.parse(arrMatch[0]); } catch(e) {}
    }
    try { return JSON.parse(objMatch[0]); } catch(e) {}
    try { return JSON.parse(arrMatch[0]); } catch(e) {}
  }
  if (arrMatch) { try { return JSON.parse(arrMatch[0]); } catch(e) {} }
  if (objMatch) { try { return JSON.parse(objMatch[0]); } catch(e) {} }
  throw new Error('Could not parse JSON from AI response: ' + cleaned.slice(0, 200));
}

const TOOL_SECTIONS = [
  { id: 'breathing', icon: '🌿', title: 'Breathing', subtitle: 'Calm your body and create space.', items: [
    ['Physiological Sigh', 'A quick reset for overwhelm.', "openBreathingTool('sigh')", 'sigh'],
    ['Box Breathing', 'A steady four-part rhythm.', "openBreathingTool('box')", 'box'],
    ['4-7-8 Breathing', 'Release tension before rest.', "openBreathingTool('relax')", 'relax'],
    ['Coherent Breathing', 'Return to a balanced rhythm.', "openBreathingTool('coherent')", 'coherent'],
    ['Belly Breathing', 'Soften physical stress.', "openBreathingTool('belly')", 'belly']
  ]},
  { id: 'expression', icon: '🎨', title: 'Expression', subtitle: 'Give shape to what is hard to say.', items: [
    ['Echo Canvas', 'Turn voice and movement into art.', "openInteractiveTool('Echo Canvas','Turn voice and movement into a living abstract canvas.','Echo Canvas/index.html')", 'canvas'],
    ['Unsent Letter', 'Say it without sending it.', "go('reg-unsent')", 'letter']
  ]},
  { id: 'grounding', icon: '◌', title: 'Grounding', subtitle: 'Return gently to your body and surroundings.', items: [
    ['Five Senses Reset', 'Come back through what is here.', "openRegulationTool('senses')", 'senses'],
    ['Orienting Light', 'Let your eyes follow a calm light.', "openRegulationTool('orient')", 'orient'],
    ['Bilateral Rhythm', 'Follow a steady left-right pulse.', "openRegulationTool('bilateral')", 'bilateral'],
    ['Muscle Release', 'Tense and soften one area at a time.', "openRegulationTool('release')", 'release'],
    ['One Minute Reset', 'Stay with one gentle minute.', "openRegulationTool('minute')", 'minute']
  ]},
  { id: 'connection', icon: '☀️', title: 'Connection', subtitle: 'Practice care, warmth, and belonging.', items: [
    ['Kind Voice', 'Hear one gentle reminder.', "openRegulationTool('kindvoice')", 'care'],
    ['Warmth Hold', 'Rest with a steady warm glow.', "openRegulationTool('warmth')", 'warmth']
  ]},
  { id: 'interactive', icon: '🫧', title: 'Interactive', subtitle: 'Let feelings move through play.', items: [
    ['Pull the Thread', 'Bring visual chaos into order.', "openInteractiveTool('Pull the Thread','Slowly gather scattered motion into something you can hold.','Pull the thread/dist/index.html')", 'thread'],
    ['Pop Away', 'Let go one bubble at a time.', "openInteractiveTool('Pop Away','Give pressure a shape, then release it gently.','Pop away/index.html')", 'pop'],
    ['Drift', 'Watch feelings shift and change.', "openInteractiveTool('Drift','Observe movement without asking it to settle.','Drift/index.html')", 'drift'],
    ['Inner Hear', 'Rest inside responsive sound.', "openInteractiveTool('Inner Hear','A quiet sound space that responds to your touch.','Inner hear/index.html')", 'hear']
  ]}
];


// ── STATE ─────────────────────────────────────────────────────
let currentUser     = null;
let currentStory    = '';
let currentTags     = {};     // { about:[], duration:[], space:[], body:[] }
let currentPlanet   = null;
let currentInputMode = 'type';
let voiceRecorder    = null;
let voiceRecognition = null;
let voiceChunks      = [];
let voiceBlob        = null;
let showImageFile    = null;
let showImageUrl     = '';
let sliderAnswers   = [];     // array of 0-100 values
let aiSliderQs      = [];     // [{q, left, right}]
let questionStep    = 0;
let selectedCompanion = null; // companion object
let setupGoals      = [];
let setupHelpful    = [];
let setupStep       = 1;
let setupQ1         = null;
let setupQ2         = null;
let setupReminderTimes = ['08:03', '15:23', '22:23'];
let setupReminderEnabled = [true, true, true];
let setupTimePickerIndex = null;
let setupPickerHour = 8;
let setupPickerMinute = 3;
let guideStep       = 0;
let breathTimer     = null;

const WELCOME_ACCEPTANCE_VERSION = 's6-v1';
const ACCOUNT_CREATED_KEY = 'ae_account_created';
const ACCOUNT_CREATED_VERSION = 'firebase-v1';
const BETA_ACCESS_KEY = 'ae_beta_access';
const BETA_USER_ID = 'beta_local_tester';
const SESSION_STATE_KEY = 'ae_session_state';
const EMOTION_DEFINITIONS = {
  "Enraged": "Rage that feels like it's taking over your whole body.",
  "Furious": "Intense anger that demands to be felt right now.",
  "Resentful": "Old anger that never got resolved, still sitting there.",
  "Jealous": "Fear of losing something - or someone - you care about.",
  "Envious": "Wanting what someone else has, and hating that you want it.",
  "Frustrated": "Trying hard, but something keeps getting in the way.",
  "Annoyed": "A low-level irritation that won't go away.",
  "Contemptuous": "Feeling like someone doesn't deserve your respect.",
  "Offended": "Something crossed a line, and it stings.",
  "Wronged": "Treated unfairly, and no one seems to notice.",
  "Ecstatic": "Joy so big it almost doesn't feel real.",
  "Elated": "A lightness that makes you want to move.",
  "Proud": "You did something - and it meant something.",
  "Inspired": "Something lit a spark inside you.",
  "Enthusiastic": "Ready to dive in, full of energy.",
  "Content": "Things feel okay - maybe even good - right now.",
  "Grateful": "Aware of what you have, and glad for it.",
  "Relieved": "Something heavy finally lifted.",
  "Cheerful": "A quiet, easy good mood.",
  "Serene": "Still inside. Nothing needs fixing right now.",
  "Disappointed": "You hoped for something. It didn't happen.",
  "Forlorn": "A heavy, quiet sadness with nowhere to go.",
  "Lonely": "Around people, or not - the aloneness stays.",
  "Ashamed": "Feeling like something is wrong with you, not just what you did.",
  "Regretful": "Wishing you'd chosen differently.",
  "Nostalgic": "Missing something that's gone - a time, a place, a person.",
  "Exhausted": "Drained in a way that sleep might not fix.",
  "Guilty": "You did something - and it sits heavy.",
  "Hopeless": "Hard to believe things could get better.",
  "Heartbroken": "A loss that goes all the way through you.",
  "Terrified": "Fear so intense it takes over everything.",
  "Panicked": "Your body is reacting before your mind catches up.",
  "Overwhelmed": "Too much at once - you don't know where to start.",
  "Anxious": "A restless worry about something that hasn't happened yet.",
  "Stressed": "Too much to carry, not enough time or space.",
  "Uneasy": "Something feels off, but you can't quite name it.",
  "Worried": "Your mind keeps circling back to what might go wrong.",
  "Apprehensive": "Bracing for something, even if it might be fine.",
  "Vulnerable": "Open in a way that feels risky.",
  "Insecure": "Unsure if you're enough - or if you belong.",
  "Repulsed": "A strong pull away from something that feels wrong.",
  "Disgusted": "Something violated a line you didn't know you had.",
  "Disdainful": "Looking down at something - or someone - you've lost respect for.",
  "Irritable": "Everything feels like too much, and your patience is thin.",
  "Bored": "Nothing feels worth engaging with right now.",
  "Numb": "The feelings are there - you just can't reach them.",
  "Apathetic": "Nothing feels like it matters enough to care about.",
  "Disengaged": "Going through the motions, but not really there.",
  "Disillusioned": "Something you believed in turned out not to be true.",
  "Averse": "A quiet but firm resistance to something.",
  "Loved": "Someone sees you - and they stay.",
  "Accepted": "You don't have to hide the parts of yourself you're unsure about.",
  "Understood": "Someone got it right - without you having to explain everything.",
  "Secure": "You can relax. Nothing is about to go wrong.",
  "Belonging": "This place, these people - you fit here.",
  "Devoted": "You'd do a lot for this person, and that feels good.",
  "Appreciative": "Someone did something for you that you didn't take for granted.",
  "Connected": "A real moment between you and someone else.",
  "Valued": "What you bring matters to someone.",
  "Supported": "You're not carrying this alone.",
  "Shocked": "Something happened that you weren't ready for at all.",
  "Bewildered": "You're trying to make sense of it - but can't yet.",
  "Confused": "Something doesn't add up, and you don't know why.",
  "Disoriented": "You've lost your footing - nothing feels familiar.",
  "Awed": "Something so big or beautiful that you feel small in a good way.",
  "Exhilarated": "Surprised by something wonderful - and it's electric.",
  "Astonished": "You didn't see that coming. Not even close.",
  "Amazed": "Something exceeded what you thought was possible.",
  "Blank": "So much happened that you don't feel anything yet.",
  "Incredulous": "Part of you still doesn't believe it's real.",
  "Motivated": "You know what you want, and you're ready to go get it.",
  "Determined": "Committed. Not backing down.",
  "Excited": "Something good is coming and you can feel it.",
  "Eager": "You want to start - right now.",
  "Curious": "You want to know more. Something pulled your attention.",
  "Hopeful": "Things might get better. You're letting yourself believe that.",
  "Wishful": "Wanting something that feels just out of reach.",
  "Vigilant": "Paying close attention because something matters.",
  "Energized": "Full of something - ready to move.",
  "Focused": "Locked in. Everything else fades out."
};
const ALLOWED_EMOTIONS = Object.keys(EMOTION_DEFINITIONS);
const SETUP_COMPANION_MAP = {
  a: { a: 'echo', b: 'echo', c: 'milo', d: 'sila' },
  b: { a: 'milo', b: 'milo', c: 'sila', d: 'echo' },
  c: { a: 'avis', b: 'avis', c: 'echo', d: 'milo' },
  d: { a: 'sila', b: 'sila', c: 'milo', d: 'avis' }
};
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

let isRestoringSession = false;

function saveSessionState(pageId) {
  if (!pageId || ['splash', 'ai-loading-page'].includes(pageId)) return;
  sessionStorage.setItem(SESSION_STATE_KEY, JSON.stringify({
    pageId,
    currentUser,
    setupStep,
    setupQ1,
    setupQ2,
    setupGoals,
    setupHelpful,
    questionStep,
    currentStory,
    currentTags,
    aiSliderQs,
    sliderAnswers,
    currentPlanet,
    companionId: selectedCompanion?.id || null
  }));
}

function restoreSessionState() {
  let state;
  try {
    state = JSON.parse(sessionStorage.getItem(SESSION_STATE_KEY) || 'null');
  } catch {
    sessionStorage.removeItem(SESSION_STATE_KEY);
    return false;
  }
  if (!state?.pageId || state.currentUser !== currentUser || !document.getElementById(state.pageId)) return false;

  setupStep = state.setupStep || 1;
  setupQ1 = state.setupQ1 || null;
  setupQ2 = state.setupQ2 || null;
  setupGoals = state.setupGoals || [];
  setupHelpful = state.setupHelpful || [];
  questionStep = state.questionStep || 0;
  currentStory = state.currentStory || '';
  currentTags = state.currentTags || {};
  aiSliderQs = state.aiSliderQs || [];
  sliderAnswers = state.sliderAnswers || [];
  currentPlanet = state.currentPlanet || null;
  selectedCompanion = COMPANIONS.find(c => c.id === state.companionId) || selectedCompanion || COMPANIONS[0];

  isRestoringSession = true;
  go(state.pageId);
  isRestoringSession = false;

  if (state.pageId === 'input-modal') {
    const storyInput = document.getElementById('story-input');
    if (storyInput) storyInput.value = currentStory;
    updateCharCount();
    renderQuickTags();
  }
  if (state.pageId === 'questions' && aiSliderQs.length) renderSliderQuestions();
  if (state.pageId === 'result' && currentPlanet) renderResult();
  return true;
}

function betaAccessEndpoint() {
  return location.port === '3000'
    ? '/api/beta-access'
    : 'http://localhost:3000/api/beta-access';
}


// ── INIT ──────────────────────────────────────────────────────
function showSignedInUser(result) {
  currentUser = 'firebase_' + result.uid;
  localStorage.setItem('ae_user', currentUser);
  const d = getData(currentUser);
  selectedCompanion = COMPANIONS.find(c => c.id === d.companion) || COMPANIONS[0];
  showBottomNav();
  if (!restoreSessionState()) go('explore');
}

function showLoggedOutEntry() {
  localStorage.removeItem('ae_user');
  currentUser = null;
  if (restoreSessionState()) return;
  const hasAcceptedWelcome =
    localStorage.getItem('ae_welcome_accepted') === WELCOME_ACCEPTANCE_VERSION;
  const hasCreatedAccount =
    localStorage.getItem(ACCOUNT_CREATED_KEY) === ACCOUNT_CREATED_VERSION;
  go(hasAcceptedWelcome ? 'auth' : 'guide');
  if (hasAcceptedWelcome) switchAuthView(hasCreatedAccount ? 'login' : 'create');
}

(function init() {
  console.log('Init: starting splash');
  go('splash');

  // 强制 1.8 秒后进入 guide，不依赖任何外部回调
  setTimeout(() => {
    console.log('Init: timeout, going to guide');
    go('guide');
  }, 1800);
})();

  const savedCurrentUser = localStorage.getItem('ae_user');
  if (savedCurrentUser) {
    if (savedCurrentUser.startsWith('beta_') && savedCurrentUser !== BETA_USER_ID) {
      migrateBetaData(savedCurrentUser);
      currentUser = BETA_USER_ID;
      localStorage.setItem('ae_user', currentUser);
    } else {
      currentUser = savedCurrentUser;
    }
    const savedData = getData(currentUser);
    selectedCompanion = COMPANIONS.find(c => c.id === savedData.companion) || COMPANIONS[0];
    if (restoreSessionState()) {
      if (savedData.companion || savedData.sp) showBottomNav();
      return;
    }
  }

  const finishInit = () => {
    const betaAccessId = localStorage.getItem(BETA_ACCESS_KEY);
    if (betaAccessId) {
      completeBetaAccess(betaAccessId);
      return;
    }
    const redirectResult = window.firebaseAuthApi?.ready
      ? window.firebaseAuthApi.redirectResult
      : null;
    if (redirectResult) {
      completeFirebaseLogin(redirectResult);
      return;
    }
    const firebaseUser = window.firebaseAuthApi?.ready
      ? window.firebaseAuthApi.currentUser
      : null;
    if (firebaseUser) showSignedInUser(firebaseUser);
    else showLoggedOutEntry();
  };
  if (window.firebaseAuthApi) {
    setTimeout(finishInit, 1800);
  } else {
    window.addEventListener('firebase-auth-ready', () => setTimeout(finishInit, 1800), { once: true });
  }
})();


// ── NAVIGATION ────────────────────────────────────────────────
function go(id) {
  if (id !== 'native-tool' && window.aemonaRegulationTimer) {
    clearInterval(window.aemonaRegulationTimer);
    window.aemonaRegulationTimer = null;
  }
  document.querySelectorAll('.page').forEach(p => p.classList.remove('show'));
  const pg = document.getElementById(id);
  if (pg) pg.classList.add('show');
  const hideNavChrome = ['input-modal', 'note-it', 'questions', 'ai-loading-page', 'result', 'explore-library', 'explore-detail', 'settings-page', 'pattern-detail', 'tool-category-page', 'tool-experience', 'flush-tool', 'native-tool', 'reg-breath'].includes(id);
  document.getElementById('bottom-nav')?.classList.toggle('hidden', hideNavChrome);
  document.getElementById('bottom-nav-scrim')?.classList.toggle('hidden', hideNavChrome);

  // Per-page setup
  if (id === 'guide')          initGuide();
  if (id === 'setup')          renderSetupStep();
  if (id === 'explore')        renderExplore();
  if (id === 'tools-page')     { renderToolsPage(); setNavActive('tools-page'); }
  if (id === 'entries-page')   { renderEntries(); setNavActive('entries-page'); }
  if (id === 'patterns-page')  { renderPatterns(); setNavActive('patterns-page'); }
  if (id === 'settings-page')  renderSettings();
  if (id === 'explore')        setNavActive('explore');
  if (id === 'reg-drag')       enableDrag();
  if (id === 'reg-breath')     startBreath();
  if (id === 'reg-clear')      spawnClearBalls();
  if (id === 'input-modal' && !isRestoringSession && !switchingEntryMode) initInputModal();
  if (id === 'note-it') renderNoteIt();
  if (!isRestoringSession) saveSessionState(id);
}

function showBottomNav() {
  document.getElementById('bottom-nav').classList.add('visible');
  document.getElementById('bottom-nav-scrim')?.classList.add('visible');
}
function hideBottomNav() {
  document.getElementById('bottom-nav').classList.remove('visible');
  document.getElementById('bottom-nav-scrim')?.classList.remove('visible');
}

function setNavActive(pageId) {
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  const map = { 'explore': 0, 'tools-page': 1, 'entries-page': 2, 'patterns-page': 3 };
  const keyMap = { 'explore': 'explore', 'tools-page': 'tools', 'entries-page': 'entries', 'patterns-page': 'patterns' };
  const nav = document.getElementById('bottom-nav');
  if (nav) nav.dataset.active = keyMap[pageId] || 'explore';
  const idx = map[pageId];
  if (idx !== undefined) {
    document.querySelectorAll('.nav-item')[idx]?.classList.add('active');
  }
}

function initToolbarFluid() {
  const nav = document.getElementById('bottom-nav');
  if (!nav || nav.dataset.fluidReady) return;
  nav.dataset.fluidReady = '1';
  const pages = ['explore', 'tools-page', 'entries-page', 'patterns-page'];
  let dragging = false;
  const pickPage = evt => {
    const rect = nav.getBoundingClientRect();
    const x = Math.max(0, Math.min(rect.width - 1, evt.clientX - rect.left));
    return Math.min(3, Math.floor(x / (rect.width / 4)));
  };
  nav.addEventListener('pointerdown', evt => {
    evt.preventDefault();
    dragging = true;
    nav.classList.add('is-dragging');
    nav.setPointerCapture?.(evt.pointerId);
  });
  nav.addEventListener('pointermove', evt => {
    if (!dragging) return;
    evt.preventDefault();
    const idx = pickPage(evt);
    nav.dataset.hoverIndex = String(idx);
  });
  nav.addEventListener('pointerup', evt => {
    if (!dragging) return;
    evt.preventDefault();
    dragging = false;
    nav.classList.remove('is-dragging');
    nav.dataset.hoverIndex = '';
    go(pages[pickPage(evt)]);
  });
  nav.addEventListener('pointercancel', () => {
    dragging = false;
    nav.classList.remove('is-dragging');
    nav.dataset.hoverIndex = '';
  });
}


// ── GUIDE (pre-auth slides) ────────────────────────────────────
function initGuide() {
  guideStep = 0;
  renderGuideSlide();
}

function renderGuideSlide() {
  const slides = document.querySelectorAll('.guide-slide');
  const guide = document.getElementById('guide');
  const currentSlide = GUIDE_SLIDES[guideStep];
  if (guide && currentSlide) {
    guide.style.backgroundImage = `url("${currentSlide.background}")`;
  }
  slides.forEach((s, i) => {
    s.classList.remove('active', 'prev');
    if (i === guideStep)     s.classList.add('active');
    if (i < guideStep)       s.classList.add('prev');
  });
  // button text
  const btn = document.getElementById('guide-btn');
  if (btn) btn.textContent = guideStep === GUIDE_SLIDES.length - 1 ? 'I accept' : 'Continue';
}

function guideNext() {
  if (guideStep === GUIDE_SLIDES.length - 1) {
    localStorage.setItem('ae_welcome_accepted', WELCOME_ACCEPTANCE_VERSION);
  }
  if (guideStep < GUIDE_SLIDES.length - 1) {
    guideStep++;
    renderGuideSlide();
  } else {
    go('auth');
    switchAuthView('create');
  }
}


// ── AUTH ──────────────────────────────────────────────────────
function switchAuthView(view) {
  document.querySelectorAll('.auth-view').forEach(v => v.classList.remove('active'));
  document.getElementById(`auth-${view}-view`)?.classList.add('active');
}

function showErr(id, msg) { const e = document.getElementById(id); e.textContent = msg; e.classList.add('show'); }
function clearErr(id)     { document.getElementById(id).classList.remove('show'); }

// ── AUTH ──────────────────────────────────────────────────────
// Strategy:
//   Email login/register → server-side /api/auth/* (no Firebase needed)
//   Google login         → Firebase popup if Firebase is configured; graceful error if not
//   Beta code            → unchanged (uses /api/beta-access as before)
//   All other providers  → unchanged (Apple/Phone show "not supported")

function getFirebaseAuth() {
  if (!window.firebaseAuthApi?.ready) {
    throw new Error(window.firebaseAuthApi?.error || 'Google sign-in is not available. Use Email or Beta code to log in.');
  }
  return window.firebaseAuthApi;
}

function firebaseErrorMessage(error) {
  const message = String(error?.message || error);
  if (/PASSWORD_LOGIN_DISABLED|operation-not-allowed/i.test(message)) return 'This sign-in method is not enabled yet.';
  if (/popup-blocked/i.test(message)) return 'Please allow pop-ups and try again.';
  if (/popup-closed-by-user/i.test(message)) return 'Sign-in was cancelled.';
  if (/unauthorized-domain/i.test(message)) return 'Open the app from http://localhost:3000 and try again.';
  if (/network-request-failed/i.test(message)) return 'Unable to reach Firebase. Check your connection.';
  if (/invalid-credential|invalid-login-credentials|wrong-password|user-not-found/i.test(message)) return 'The email or password is incorrect.';
  if (/email-already-in-use/i.test(message)) return 'An account with this email already exists.';
  if (/weak-password/i.test(message)) return 'Password must be at least 6 characters.';
  if (/invalid-email/i.test(message)) return 'Please enter a valid email address.';
  if (/too-many-requests/i.test(message)) return 'Too many attempts. Please try again later.';
  const cleanMessage = message.replace(/^Firebase:\s*/i, '').replace(/\s*\(auth\/[^)]+\)\.?$/i, '');
  return error?.code ? `${cleanMessage} (${error.code})` : cleanMessage;
}

let toastTimer = null;
function showToast(message) {
  const toast = document.getElementById('app-toast');
  if (!toast) return;
  toast.textContent = message;
  toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('show'), 2200);
}

function showAppleUnsupported() {
  if (navigator.vibrate) navigator.vibrate([45, 35, 45]);
  showToast("Apple sign-in isn't supported yet.");
}

function showPhoneUnsupported() {
  if (navigator.vibrate) navigator.vibrate([45, 35, 45]);
  showToast("Phone sign-in isn't supported yet.");
}

function completeFirebaseLogin(result) {
  currentUser = 'firebase_' + result.uid;
  localStorage.setItem('ae_user', currentUser);
  localStorage.setItem(ACCOUNT_CREATED_KEY, ACCOUNT_CREATED_VERSION);
  const d = getData(currentUser);
  const hasSetup = Boolean(d.companion || d.sp);
  if (restoreSessionState()) {
    if (hasSetup) showBottomNav();
    return;
  }
  if (result.isNewUser || !hasSetup) {
    go('setup');
  } else {
    selectedCompanion = COMPANIONS.find(c => c.id === d.companion) || COMPANIONS[0];
    showBottomNav();
    go('explore');
  }
}

// ── Email/password auth via server (no Firebase required) ──────
// Users are stored in users.json on the server.
// uid format: "local_<sha256-of-email>" for stable IDs.

async function handleLogin() {
  clearErr('login-err');
  const email = document.getElementById('l-email').value.trim();
  const p     = document.getElementById('l-pass').value;
  if (!email || !p) { showErr('login-err', 'Please fill in all fields.'); return; }

  // Try server-side local auth first
  try {
    const res  = await fetch('/api/auth/login', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password: p })
    });
    const data = await res.json();
    if (res.ok && data.uid) {
      completeLocalLogin(data);
      return;
    }
    // If server says wrong password/not found, show that error
    if (res.status === 401 || res.status === 404) {
      showErr('login-err', data.error || 'The email or password is incorrect.');
      return;
    }
    // Any other server error — fall through to Firebase attempt
    console.warn('[Auth] Local login server error, trying Firebase:', data.error);
  } catch (e) {
    console.warn('[Auth] Local login fetch failed, trying Firebase:', e.message);
  }

  // Fallback: try Firebase email login
  try {
    completeFirebaseLogin(await getFirebaseAuth().signInEmail(email, p));
  } catch (error) {
    showErr('login-err', firebaseErrorMessage(error));
  }
}

async function handleRegister() {
  clearErr('reg-err');
  const name  = document.getElementById('r-name').value.trim();
  const email = document.getElementById('r-email').value.trim();
  const p     = document.getElementById('r-pass').value;
  const c     = document.getElementById('r-confirm').value;
  if (!name)              { showErr('reg-err', 'Please enter your full name.'); return; }
  if (!email || !p || !c) { showErr('reg-err', 'Please fill in all fields.'); return; }
  if (p.length < 8)       { showErr('reg-err', 'Password must be at least 8 characters.'); return; }
  if (!/[A-Z]/.test(p))   { showErr('reg-err', 'Password needs at least 1 uppercase letter.'); return; }
  if (!/[a-z]/.test(p))   { showErr('reg-err', 'Password needs at least 1 lowercase letter.'); return; }
  if (p !== c)            { showErr('reg-err', 'Passwords do not match.'); return; }

  // Try server-side local registration first
  try {
    const res  = await fetch('/api/auth/register', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password: p, name })
    });
    const data = await res.json();
    if (res.ok && data.uid) {
      // Save name in local data store
      const uid = 'local_' + data.uid;
      const d   = getData(uid);
      d.profile = { ...(d.profile || {}), name };
      saveData(uid, d);
      completeLocalLogin({ ...data, isNewUser: true });
      return;
    }
    if (res.status === 409) {
      showErr('reg-err', 'An account with this email already exists.');
      return;
    }
    console.warn('[Auth] Local register server error, trying Firebase:', data.error);
  } catch (e) {
    console.warn('[Auth] Local register fetch failed, trying Firebase:', e.message);
  }

  // Fallback: Firebase email registration
  try {
    const result = await getFirebaseAuth().registerEmail(email, p);
    const uid    = 'firebase_' + result.uid;
    const d      = getData(uid);
    d.profile    = { ...(d.profile || {}), name };
    saveData(uid, d);
    completeFirebaseLogin(result);
  } catch (error) {
    showErr('reg-err', firebaseErrorMessage(error));
  }
}

// Called after successful local (server-side) login or registration
function completeLocalLogin(data) {
  currentUser = 'local_' + data.uid;
  localStorage.setItem('ae_user', currentUser);
  localStorage.setItem(ACCOUNT_CREATED_KEY, ACCOUNT_CREATED_VERSION);
  const d = getData(currentUser);
  const hasSetup = Boolean(d.companion || d.sp);
  if (restoreSessionState()) {
    if (hasSetup) showBottomNav();
    return;
  }
  if (data.isNewUser || !hasSetup) {
    selectedCompanion = COMPANIONS[0];
    go('setup');
  } else {
    selectedCompanion = COMPANIONS.find(c => c.id === d.companion) || COMPANIONS[0];
    showBottomNav();
    go('explore');
  }
}

// ── Google login (Firebase only) ──────────────────────────────
async function socialLogin(provider) {
  try {
    const result = await getFirebaseAuth().signInProvider(provider);
    if (result) completeFirebaseLogin(result);
  } catch (error) {
    console.error('[Auth] Provider sign-in failed:', error);
    if (navigator.vibrate) navigator.vibrate(55);
    const msg = firebaseErrorMessage(error);
    showToast(msg);
    // If Firebase is not set up at all, give a clear hint
    if (/not available|still loading/i.test(msg)) {
      showToast('Google login needs Firebase config. Use Email login instead.');
    }
  }
}

// ── Phone auth (unchanged) ────────────────────────────────────
let authSubViewReturn = 'signin';

function openPhoneAuth(returnView = 'signin') {
  authSubViewReturn = returnView;
  switchAuthView('phone');
  const region = (navigator.language || '').split('-')[1]?.toUpperCase();
  const regionCodes = {
    US: '+1', CA: '+1', KR: '+82', CN: '+86', JP: '+81', GB: '+44',
    AU: '+61', NZ: '+64', SG: '+65', HK: '+852', TW: '+886', IN: '+91',
    DE: '+49', FR: '+33', IT: '+39', ES: '+34', NL: '+31', SE: '+46',
    NO: '+47', BR: '+55', MX: '+52'
  };
  const countrySelect = document.getElementById('phone-country');
  if (countrySelect && regionCodes[region]) countrySelect.value = regionCodes[region];
}

function openEmailLogin(returnView = 'signin') {
  authSubViewReturn = returnView;
  // Show register view if coming from 'create', login form otherwise
  switchAuthView(returnView === 'create' ? 'email-register' : 'email-login');
}

function openBetaAccess(returnView = 'login') {
  authSubViewReturn = returnView;
  clearErr('beta-err');
  document.getElementById('beta-code').value = '';
  switchAuthView('beta');
  setTimeout(() => document.getElementById('beta-code').focus(), 50);
}

function closeAuthSubView() { switchAuthView(authSubViewReturn); }

function completeBetaAccess(accessId) {
  const legacyUser = 'beta_' + accessId;
  migrateBetaData(legacyUser);
  currentUser = BETA_USER_ID;
  localStorage.setItem(BETA_ACCESS_KEY, accessId);
  localStorage.setItem('ae_user', currentUser);
  const d = getData(currentUser);
  const hasSetup = Boolean(d.companion || d.sp);
  if (restoreSessionState()) {
    if (hasSetup) showBottomNav();
    return;
  }
  if (!hasSetup) {
    go('setup');
  } else {
    selectedCompanion = COMPANIONS.find(c => c.id === d.companion) || COMPANIONS[0];
    showBottomNav();
    go('explore');
  }
}

function migrateBetaData(legacyUser) {
  if (!legacyUser || legacyUser === BETA_USER_ID) return;
  const legacyKey = 'ae_d_' + legacyUser;
  if (!localStorage.getItem(legacyKey)) return;
  const legacy = getData(legacyUser);
  const stable = getData(BETA_USER_ID);
  const mergedRecords = [...(stable.records || [])];
  const seen = new Set(mergedRecords.map(r => `${r.date}|${r.time}|${r.story}`));
  (legacy.records || []).forEach(record => {
    const key = `${record.date}|${record.time}|${record.story}`;
    if (!seen.has(key)) { mergedRecords.push(record); seen.add(key); }
  });
  stable.records = mergedRecords.sort((a, b) =>
    `${b.date || ''} ${b.time || ''}`.localeCompare(`${a.date || ''} ${a.time || ''}`));
  stable.cover     = { ...(legacy.cover || {}), ...(stable.cover || {}) };
  stable.companion = stable.companion || legacy.companion;
  stable.sp        = stable.sp        || legacy.sp;
  stable.goals     = stable.goals?.length ? stable.goals : legacy.goals;
  stable.helpful   = stable.helpful?.length ? stable.helpful : legacy.helpful;
  saveData(BETA_USER_ID, stable);
}

async function submitBetaCode() {
  clearErr('beta-err');
  const code = document.getElementById('beta-code').value.trim();
  if (!code) { showErr('beta-err', 'Enter your beta access code.'); return; }
  try {
    const response = await fetch(betaAccessEndpoint(), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      cache: 'no-store',
      body: JSON.stringify({ code })
    });
    const raw = await response.text();
    let data = {};
    try { data = raw ? JSON.parse(raw) : {}; } catch {
      throw new Error(`Beta access returned non-JSON response (${response.status}). Restart the dev server and try again.`);
    }
    if (!response.ok) throw new Error(data.error || `Beta access failed (${response.status}).`);
    if (!data.accessId) throw new Error('Beta access returned an empty response. Please try again.');
    completeBetaAccess(data.accessId);
  } catch (error) {
    if (navigator.vibrate) navigator.vibrate(55);
    showErr('beta-err', error.message);
  }
}

function formatPhoneInput(input) { input.value = input.value.replace(/\D/g, '').slice(0, 15); }

async function sendPhoneCode() {
  clearErr('phone-err');
  const countryCode    = document.getElementById('phone-country').value;
  let nationalNumber   = document.getElementById('phone-number').value.replace(/\D/g, '');
  if (countryCode !== '+1') nationalNumber = nationalNumber.replace(/^0+/, '');
  if (nationalNumber.length < 6) { showErr('phone-err', 'Enter a valid phone number.'); return; }
  const phone = countryCode + nationalNumber;
  try {
    await getFirebaseAuth().sendPhoneCode(phone);
    document.getElementById('phone-code').focus();
  } catch (error) {
    showErr('phone-err', firebaseErrorMessage(error));
  }
}

async function confirmPhoneCode() {
  clearErr('phone-err');
  const code = document.getElementById('phone-code').value.trim();
  if (!code) { showErr('phone-err', 'Enter the verification code.'); return; }
  try {
    completeFirebaseLogin(await getFirebaseAuth().confirmPhoneCode(code));
  } catch (error) {
    showErr('phone-err', firebaseErrorMessage(error));
  }
}

function goToSignIn() { go('auth'); switchAuthView('signin'); }

function togglePw(inputId, btn) {
  const input = document.getElementById(inputId);
  const show  = input.type === 'password';
  input.type  = show ? 'text' : 'password';
  btn.classList.toggle('visible', show);
}

async function handleLogout() {
  try {
    if (window.firebaseAuthApi?.ready) await window.firebaseAuthApi.signOut();
  } catch (error) {
    console.warn('[Auth] Sign out failed:', error);
  }
  currentUser = null;
  selectedCompanion = null;
  localStorage.removeItem('ae_user');
  localStorage.removeItem(BETA_ACCESS_KEY);
  hideBottomNav();
  const hasAcceptedWelcome =
    localStorage.getItem('ae_welcome_accepted') === WELCOME_ACCEPTANCE_VERSION;
  go(hasAcceptedWelcome ? 'auth' : 'guide');
  if (hasAcceptedWelcome) switchAuthView('login');
}

// ── SETUP FLOW (9 steps) ──────────────────────────────────────
const SETUP_TOTAL = 9;

function renderSetupStep() {
  const setupPage = document.getElementById('setup');
  const nextBtn = document.getElementById('setup-next-btn');
  const backBtn = document.querySelector('.setup-asset-back');
  const assetStep = setupStep <= 9;

  setupPage.classList.toggle('setup-asset-mode', assetStep);
  setupPage.classList.toggle('setup-asset-welcome', setupStep === 1);
  setupPage.classList.toggle('setup-asset-question', setupStep === 2 || setupStep === 3);
  setupPage.classList.toggle('setup-asset-result', setupStep === 4);
  setupPage.classList.toggle('setup-asset-choice', setupStep === 5 || setupStep === 6);
  setupPage.classList.toggle('setup-asset-summary', setupStep === 7);
  setupPage.classList.toggle('setup-custom-actions', setupStep === 8 || setupStep === 9);
  setupPage.style.backgroundImage = assetStep
    ? `url("${setupBackgroundImage()}")`
    : '';
  setupPage.style.backgroundSize = assetStep ? '430px 932px' : '';
  setupPage.style.backgroundPosition = assetStep ? 'top center' : '';
  setupPage.style.backgroundRepeat = assetStep ? 'no-repeat' : '';
  nextBtn.classList.toggle('setup-image-btn', assetStep);
  nextBtn.textContent = 'Continue';
  if (backBtn) backBtn.classList.toggle('show', assetStep && setupStep > 1);

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

  updateSetupContinueState();
  saveSessionState('setup');
}

function setupOptionSrc(question, option, mode) {
  return `assets/SetupSectionAssets/${question}/${option}/mode=${mode}.svg`;
}

function setupBackgroundImage() {
  if (setupStep <= 3) return `assets/SetupSectionBG/S${setupStep - 1}.svg`;

  const companionId = selectedCompanion?.id || 'milo';
  const fileByCompanion = {
    avis: 'Avis.svg',
    echo: 'Echo.svg',
    milo: 'milo.svg',
    sila: 'Sila.svg'
  };
  const fileName = fileByCompanion[companionId] || 'milo.svg';
  if (setupStep === 4) return `assets/SetupSectionBG/S3/${fileName}`;
  if (setupStep === 5) return `assets/SetupSectionBG/S4/${fileName.replace('milo', 'Milo')}`;
  if (setupStep === 6) return `assets/SetupSectionBG/S5/${fileName.replace('milo', 'Milo')}`;
  if (setupStep === 7) return 'assets/SetupSectionBG/S6.svg';
  if (setupStep === 8) return 'assets/SetupSectionBG/S7.svg';
  if (setupStep === 9) return 'assets/SetupSectionBG/S8.svg';
  return `assets/SetupSectionBG/S3/${fileName}`;
}

function renderSetupAssetQuestion(body, question, selected) {
  body.innerHTML = `
    <div class="setup-option-layer" aria-label="${question === 'q1' ? 'Question 1' : 'Question 2'}">
      ${['a', 'b', 'c', 'd'].map(option => {
        const active = selected === option;
        return `
          <button class="setup-answer setup-answer-${option} ${active ? 'active' : ''}"
                  type="button"
                  aria-pressed="${active}"
                  onclick="selectSetupAnswer('${question}', '${option}')"
                  onmouseenter="previewSetupAnswer(this, '${question}', '${option}', true)"
                  onmouseleave="previewSetupAnswer(this, '${question}', '${option}', false)">
            <img src="${setupOptionSrc(question, option, active ? 'Activated' : 'default')}" alt="">
          </button>`;
      }).join('')}
    </div>`;
}

function renderSetupChecklistOverlay(body, type, options, selectedIds) {
  const toggleHandler = type === 'goals' ? 'toggleSetupGoal' : 'toggleSetupHelpful';
  const checkboxTops = [327, 389, 449, 509, 569];
  const rowTops = [305, 365, 425, 485, 545];

  body.innerHTML = `
    <div class="setup-check-overlay">
      ${options.map((option, index) => {
        const active = selectedIds.includes(option.id);
        return `
          <button class="setup-check-hit ${active ? 'active' : ''}"
                  style="top:${rowTops[index]}px"
                  type="button"
                  aria-pressed="${active}"
                  onclick="${toggleHandler}('${option.id}')">
            <span class="setup-check-box"
                  style="top:${checkboxTops[index] - rowTops[index]}px"
                  aria-hidden="true">${active ? '✓' : ''}</span>
          </button>`;
      }).join('')}
    </div>`;
}

function toggleSetupGoal(id) {
  if (setupGoals.includes(id)) setupGoals = setupGoals.filter(goal => goal !== id);
  else setupGoals.push(id);
  renderSetupStep();
}

function toggleSetupHelpful(id) {
  if (setupHelpful.includes(id)) setupHelpful = setupHelpful.filter(item => item !== id);
  else setupHelpful.push(id);
  renderSetupStep();
}

function selectSetupAnswer(question, option) {
  if (question === 'q1') setupQ1 = option;
  if (question === 'q2') setupQ2 = option;
  renderSetupStep();
}

function previewSetupAnswer(button, question, option, hover) {
  if (button.classList.contains('active')) return;
  const img = button.querySelector('img');
  if (img) img.src = setupOptionSrc(question, option, hover ? 'Hover' : 'default');
}

function applySetupCompanionMatch() {
  const companionId = SETUP_COMPANION_MAP[setupQ1]?.[setupQ2] || 'milo';
  selectedCompanion = COMPANIONS.find(c => c.id === companionId) || COMPANIONS[0];
}

function updateSetupContinueState() {
  const nextBtn = document.getElementById('setup-next-btn');
  if (!nextBtn) return;

  const assetStep = setupStep <= 9;
  const locked =
    (setupStep === 2 && !setupQ1) ||
    (setupStep === 3 && !setupQ2) ||
    (setupStep === 5 && setupGoals.length === 0) ||
    (setupStep === 6 && setupHelpful.length === 0);
  nextBtn.disabled = locked;

  if (!assetStep) {
    nextBtn.style.backgroundImage = '';
    return;
  }

  nextBtn.style.backgroundImage = `url("assets/Button/ContinueButton-${locked ? 'unlock' : 'default'}.svg")`;
}

// Step 1 — Welcome
function renderSetup1(body) {
  body.innerHTML = '';
  return;
  body.innerHTML = `
    <div class="setup-welcome-art">🌟</div>
    <div class="setup-title serif">Hi and welcome<br>to Aemona!</div>
    <div class="setup-sub">Let's take a few minutes to get you set up.</div>`;
}

// Step 2 — Emotion response style
function renderSetup2(body) {
  renderSetupAssetQuestion(body, 'q1', setupQ1);
  return;
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
  renderSetupAssetQuestion(body, 'q2', setupQ2);
  return;
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
  body.innerHTML = '';
  return;
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
  renderSetupChecklistOverlay(body, 'goals', GOALS_OPTIONS, setupGoals);
}

// Step 6 — What would feel most helpful?
function renderSetup6(body) {
  renderSetupChecklistOverlay(body, 'helpful', HELPFUL_OPTIONS, setupHelpful);
}

// Step 7 — Great! Aemona will help you:
function renderSetup7(body) {
  body.innerHTML = '';
}

// Step 8 — Motivation reminders
function renderSetup8(body) {
  body.innerHTML = `
    <div class="setup-reminder-overlay">
      ${setupReminderTimes.map((time, index) => `
        <button class="setup-time-chip setup-time-${index + 1}" type="button"
                onclick="openSetupTimePicker(${index})">${time}</button>
        <button class="setup-reminder-switch setup-switch-${index + 1} ${setupReminderEnabled[index] ? 'on' : 'off'}"
                type="button" aria-pressed="${setupReminderEnabled[index]}"
                onclick="toggleSetupReminder(${index})"></button>
      `).join('')}
      <button class="setup-asset-action setup-maybe-later" type="button" onclick="finishReminderSetup(false)"></button>
      <button class="setup-asset-action setup-turn-on" type="button" onclick="finishReminderSetup(true)"></button>
    </div>`;
}

function toggleSetupReminder(index) {
  setupReminderEnabled[index] = !setupReminderEnabled[index];
  renderSetupStep();
}

function openSetupTimePicker(index) {
  setupTimePickerIndex = index;
  const [hour, minute] = setupReminderTimes[index].split(':').map(Number);
  setupPickerHour = hour;
  setupPickerMinute = minute;
  const hourRanges = [
    { start: 3, end: 9, label: 'Morning · 03:00–10:00' },
    { start: 10, end: 16, label: 'Day · 10:00–17:00' },
    { start: 17, end: 23, label: 'Evening · 17:00–24:00' }
  ];
  const range = hourRanges[index];
  document.getElementById('setup-time-picker')?.remove();
  document.getElementById('setup').insertAdjacentHTML('beforeend', `
    <div class="setup-time-picker" id="setup-time-picker">
      <div class="setup-time-picker-panel">
        <div class="setup-time-picker-title">${range.label}</div>
        <div class="setup-time-steppers">
          <div class="setup-time-stepper">
            <button type="button" onclick="adjustSetupPicker('hour', 1)">+</button>
            <div class="setup-time-value" id="setup-picker-hour">${String(hour).padStart(2, '0')}</div>
            <button type="button" onclick="adjustSetupPicker('hour', -1)">−</button>
            <div class="setup-time-unit">hour</div>
          </div>
          <div class="setup-time-colon">:</div>
          <div class="setup-time-stepper">
            <button type="button" onclick="adjustSetupPicker('minute', 1)">+</button>
            <div class="setup-time-value" id="setup-picker-minute">${String(minute).padStart(2, '0')}</div>
            <button type="button" onclick="adjustSetupPicker('minute', -1)">−</button>
            <div class="setup-time-unit">minute</div>
          </div>
        </div>
        <div class="setup-time-picker-actions">
          <button type="button" onclick="closeSetupTimePicker()">Cancel</button>
          <button type="button" onclick="confirmSetupTimePicker()">Done</button>
        </div>
      </div>
    </div>`);
}

function adjustSetupPicker(unit, amount) {
  if (unit === 'hour') {
    const ranges = [[3, 9], [10, 16], [17, 23]];
    const [minHour, maxHour] = ranges[setupTimePickerIndex];
    setupPickerHour += amount;
    if (setupPickerHour > maxHour) setupPickerHour = minHour;
    if (setupPickerHour < minHour) setupPickerHour = maxHour;
  } else {
    setupPickerMinute = (setupPickerMinute + amount + 60) % 60;
  }
  document.getElementById('setup-picker-hour').textContent = String(setupPickerHour).padStart(2, '0');
  document.getElementById('setup-picker-minute').textContent = String(setupPickerMinute).padStart(2, '0');
}

function closeSetupTimePicker() {
  document.getElementById('setup-time-picker')?.remove();
  setupTimePickerIndex = null;
}

function confirmSetupTimePicker() {
  const hour = setupPickerHour;
  const minute = setupPickerMinute;
  const hourRanges = [[3, 9], [10, 16], [17, 23]];
  const [minHour, maxHour] = hourRanges[setupTimePickerIndex];
  if (hour < minHour || hour > maxHour) {
    showToast('Choose a time within this reminder period.');
    navigator.vibrate?.(30);
    return;
  }
  const time = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
  if (setupReminderTimes.some((existing, index) => existing === time && index !== setupTimePickerIndex)) {
    showToast('Choose a different time for each reminder.');
    navigator.vibrate?.(30);
    return;
  }
  setupReminderTimes[setupTimePickerIndex] = time;
  closeSetupTimePicker();
  renderSetupStep();
}

function finishReminderSetup(enableMotivation) {
  const d = getData(currentUser);
  d.companion = selectedCompanion?.id || 'milo';
  d.goals = setupGoals;
  d.helpful = setupHelpful;
  d.reminders = enableMotivation
    ? setupReminderTimes.map((time, index) => ({ time, enabled: setupReminderEnabled[index] }))
    : [];
  if (!d.sp) d.sp = { score: 3.2, label: 'Perceptive', tagline: 'You notice what others miss, and feel it more deeply.', strengths: ['Deep empathy', 'Self-awareness', 'Intuition'], challenges: ['Overstimulation', 'Boundary-setting'], tip: 'Regular quiet time helps you reset and integrate.' };
  saveData(currentUser, d);
  setupStep = 9;
  renderSetupStep();
}

// Step 9 — Step into your inner world
function renderSetup9(body) {
  body.innerHTML = `
    <div class="setup-final-overlay">
      <button class="setup-asset-action setup-begin-exploring" type="button" onclick="finishSetup()"></button>
    </div>`;
}

function setupNext() {
  if (setupStep === 8) return; // handled by AI async
  if (setupStep === 2 && !setupQ1) {
    showToast('Choose one option to continue.');
    navigator.vibrate?.(30);
    return;
  }
  if (setupStep === 3 && !setupQ2) {
    showToast('Choose one option to continue.');
    navigator.vibrate?.(30);
    return;
  }
  if (setupStep === 5 && setupGoals.length === 0) {
    showToast('Choose at least one option to continue.');
    navigator.vibrate?.(30);
    return;
  }
  if (setupStep === 6 && setupHelpful.length === 0) {
    showToast('Choose at least one option to continue.');
    navigator.vibrate?.(30);
    return;
  }
  if (setupStep === 3) applySetupCompanionMatch();
  if (setupStep < SETUP_TOTAL) {
    setupStep++;
    renderSetupStep();
  } else {
    finishSetup();
  }
}

function setupBack() {
  if (document.getElementById('setup-time-picker')) {
    closeSetupTimePicker();
    return;
  }
  if (setupStep > 1) { setupStep--; renderSetupStep(); }
  else go('auth');
}

function finishSetup() {
  showBottomNav();
  setupStep = 1; setupGoals = []; setupHelpful = []; setupQ1 = null; setupQ2 = null;
  go('explore');
}

function skipSetup() {
  const d = getData(currentUser);
  d.companion = selectedCompanion?.id || 'milo';
  if (!d.sp) d.sp = { score: 3.0, label: 'Perceptive', tagline: 'Finding your way through feelings, one day at a time.', strengths: ['Empathy', 'Awareness'], challenges: ['Overwhelm'], tip: 'Be gentle with yourself.' };
  saveData(currentUser, d);
  showBottomNav();
  setupStep = 1;
  setupQ1 = null;
  setupQ2 = null;
  go('explore');
}


// ── EXPLORE (home) ────────────────────────────────────────────
const EXPLORE_COLLECTIONS = {
  recommended: {
    title: 'Recommended For You',
    subtitle: 'Small places to start, based on where you are.',
    layout: 'wide',
    items: [
      { title: 'Find the feeling under the sentence', body: 'Write one sentence you keep repeating. What feeling is hiding inside it?', tag: '2 min' },
      { title: 'Try a gentler word first', body: 'Start with warm, tense, tired, far away, or unsure.', tag: 'Soft start' },
      { title: 'Notice the need, not only the mood', body: 'A heavy feeling may be asking for rest, safety, space, connection, or meaning.', tag: 'Need lens' },
      { title: 'Check where it lives in your body', body: 'Shoulders, throat, stomach, chest, jaw. The body often knows first.', tag: 'Body clue' }
    ]
  },
  emotions: {
    title: 'Emotion Library',
    subtitle: 'Tiny definitions for feelings that can be hard to name.',
    items: [
      { id: 'joy', title: 'Joy', body: 'A sense of aliveness, warmth, or inner yes.' },
      { id: 'sadness', title: 'Sadness', body: 'A soft ache around loss, longing, disappointment, or something that mattered.' },
      { id: 'fear', title: 'Fear', body: 'A protective signal that something feels uncertain, unsafe, or too much.' },
      { id: 'anger', title: 'Anger', body: 'Energy around a boundary, unfairness, hurt, or an ignored need.' },
      { id: 'trust', title: 'Trust', body: 'A feeling of steadiness, safety, or being able to soften your guard.' },
      { id: 'disgust', title: 'Disgust', body: 'A pulling away from something that feels wrong or out of alignment.' },
      { id: 'anticipation', title: 'Anticipation', body: 'Your mind leaning toward what might happen next.' },
      { id: 'surprise', title: 'Surprise', body: 'A sudden opening when reality interrupts what you expected.' }
    ]
  },
  realizations: {
    title: 'Small Realizations',
    subtitle: 'Two-minute reads for the spaces between feelings.',
    layout: 'wide',
    items: [
      { title: 'You can feel better without being fully okay', body: 'Healing is often partial. A little more room in your chest still counts.' },
      { title: 'A feeling can be true without being the whole truth', body: 'Fear may be real. It may also be incomplete. Both can exist at once.' },
      { title: 'Needing reassurance does not make you needy', body: 'Sometimes the nervous system asks another person, “Are we still safe?”' },
      { title: 'Not replying immediately can still be care', body: 'Space can protect tenderness, not signal that connection is gone.' },
      { title: 'Strong emotions are not failed self-control', body: 'They are information arriving with volume. The task is translation, not shame.' },
      { title: 'You do not have to earn rest by collapsing first', body: 'Rest is not a prize for breaking down. It is part of staying whole.' }
    ]
  },
  needs: {
    title: 'Emotional Needs',
    subtitle: 'The quieter layer underneath many emotions.',
    items: [
      { title: 'Need for Rest', body: 'A wish to stop performing, processing, explaining, or holding everything together.' },
      { title: 'Need for Safety', body: 'A wish to know you are not in danger, in trouble, or about to lose connection.' },
      { title: 'Need for Connection', body: 'A wish to be seen, reached for, remembered, or emotionally met.' },
      { title: 'Need for Space', body: 'A wish to have room around your thoughts, body, choices, or pace.' },
      { title: 'Need for Meaning', body: 'A wish for what happened to make sense or matter in a way you can carry.' },
      { title: 'Need for Repair', body: 'A wish for acknowledgement, apology, or a bridge back after something hurt.' },
      { title: 'Need for Clarity', body: 'A wish to understand what is happening instead of guessing in the dark.' },
      { title: 'Need for Choice', body: 'A wish to feel less trapped and more able to move from your own yes or no.' }
    ]
  },
  questions: {
    title: 'Quiet Questions',
    subtitle: 'One card, one gentle door inward.',
    layout: 'quiet',
    items: [
      { title: 'What have you been carrying alone lately?', body: 'Name one thing sitting quietly in the background.' },
      { title: 'When was the last time you felt truly understood?', body: 'What made it different from being merely heard?' },
      { title: 'What are you avoiding thinking about?', body: 'You do not have to solve it. Let its outline exist for a moment.' },
      { title: 'What would feel like relief, even if it is small?', body: 'A message, a pause, a walk, a boundary, a clean surface.' },
      { title: 'Where are you asking yourself to be tougher than needed?', body: 'Sometimes softness is the more honest form of strength.' },
      { title: 'What part of you wants permission today?', body: 'Permission to rest, want, miss, refuse, begin again, or not know yet.' }
    ]
  },
  collections: {
    title: 'Collections',
    subtitle: 'Themes for the feelings that come in clusters.',
    items: [
      { title: 'When You Feel Far Away', body: 'Disconnected, numb, distant, quiet, not quite here.' },
      { title: 'Waiting for a Reply', body: 'Anxious checking, hope, anger, embarrassment, and the story between messages.' },
      { title: 'Starting Over', body: 'Grief, possibility, uncertainty, and the first small step after change.' },
      { title: 'Missing Someone', body: 'Longing, memory, tenderness, ache, and the strange shape of absence.' },
      { title: 'Being Misunderstood', body: 'Frustration, loneliness, self-doubt, and the need to be seen accurately.' },
      { title: 'Too Much at Once', body: 'Overwhelm, pressure, shutdown, and the need to make one thing smaller.' },
      { title: 'After a Hard Conversation', body: 'Replay loops, shame, anger, tenderness, and repair.' },
      { title: 'The Quiet Before Change', body: 'Anticipation, resistance, hope, fear, and the moment before movement.' }
    ]
  },
  myths: {
    title: 'Emotional Myths',
    subtitle: 'Small myths that make feelings harder than they need to be.',
    layout: 'wide',
    items: [
      { title: 'Strong people do not cry.', body: 'Reality: emotions are not weakness. Crying is one way the body releases what it held.' },
      { title: "If I love someone, I shouldn't feel angry.", body: 'Reality: anger can appear where care, boundaries, and hurt all meet.' },
      { title: 'If I cannot explain it, it is not real.', body: 'Reality: feelings often arrive before language. Naming can come later.' },
      { title: 'Rest means I am falling behind.', body: 'Reality: rest is maintenance, not disappearance.' }
    ]
  },
  translations: {
    title: 'Emotional Translation',
    subtitle: 'Everyday sentences, gently decoded.',
    items: [
      { title: '"I don’t know."', body: 'May mean: overwhelmed, afraid to want something, or not ready to be precise.' },
      { title: '"I’m fine."', body: 'May mean: avoiding, tired of explaining, or trying not to need too much.' },
      { title: '"Whatever."', body: 'May mean: hurt, powerless, or protecting yourself from hoping.' },
      { title: '"It’s not a big deal."', body: 'May mean: minimizing, embarrassed, or unsure whether your reaction is allowed.' },
      { title: '"I just need space."', body: 'May mean: overloaded, needing choice, or trying to return without pressure.' },
      { title: '"I can’t stop thinking about it."', body: 'May mean: unresolved fear, unfinished repair, or a need for clarity.' }
    ]
  }
};

function renderExplore() {
  setNavActive('explore');
  const title = document.querySelector('#explore .explore-title');
  if (title) title.textContent = 'Explore';
  const shareButton = document.querySelector('#explore .explore-share');
  if (shareButton) {
    shareButton.onclick = shareExplore;
    shareButton.setAttribute('aria-label', 'Share Aemona');
  }
  const scroll = document.querySelector('#explore .explore-scroll');
  if (!scroll) return;
  scroll.innerHTML = `
    <section class="discover-hero-section">
      <div class="explore-subtitle serif">How are you feeling?</div>
      <button class="explore-hero-main" type="button" onclick="go('input-modal')" aria-label="Find my words"></button>
    </section>
    ${renderDiscoverSection('recommended')}
    ${renderDiscoverSection('emotions')}
    ${renderDiscoverSection('realizations')}
    ${renderDiscoverSection('needs')}
    ${renderDiscoverSection('questions')}
    ${renderDiscoverSection('collections')}
    ${renderDiscoverSection('myths')}
    ${renderDiscoverSection('translations')}`;
  requestAnimationFrame(showExplorePromo);
}

function showExplorePromo() {
  if (window.aemonaExplorePromoShown) return;
  const promo = document.getElementById('explore-promo');
  if (!promo) return;
  window.aemonaExplorePromoShown = true;
  promo.classList.add('show');
  promo.setAttribute('aria-hidden', 'false');
}

function closeExplorePromo() {
  const promo = document.getElementById('explore-promo');
  promo?.classList.remove('show');
  promo?.setAttribute('aria-hidden', 'true');
}

function openUnpackFromPromo() {
  closeExplorePromo();
  go('input-modal');
}

function renderDiscoverSection(key) {
  const collection = EXPLORE_COLLECTIONS[key];
  if (!collection) return '';
  const items = discoverItemsFor(key);
  return `
    <section class="home-section discover-section discover-${key}">
      <div class="home-section-head">
        <div>
          <h2 class="serif">${escapeHTML(collection.title)}</h2>
          <p>${escapeHTML(collection.subtitle)}</p>
        </div>
      </div>
      <div class="discover-shelf discover-shelf-${collection.layout || 'default'}">
        ${items.map((item, index) => renderDiscoverCard(key, item, index)).join('')}
      </div>
    </section>`;
}

function discoverItemsFor(key) {
  if (key !== 'recommended') return EXPLORE_COLLECTIONS[key]?.items || [];
  const records = getData(currentUser)?.records || [];
  const latest = records[0]?.planet?.emotion;
  const base = [...EXPLORE_COLLECTIONS.recommended.items];
  if (latest) {
    base.unshift({
      title: `After feeling ${latest}`,
      body: `Try asking what ${latest} was protecting, asking for, or pointing toward.`,
      tag: 'For today'
    });
  }
  return base;
}

function renderDiscoverCard(key, item, index) {
  const image = key === 'emotions' ? '' : (item.image || discoverImageFor(key, index));
  const icon = image
    ? `<img src="${image}" alt="${escapeAttr(item.title)}">`
    : (item.id ? emotionSymbol(item.id) : '<span class="discover-image-placeholder"></span>');
  const title = item.short || shortDiscoverTitle(item.title);
  return `
    <button class="discover-card discover-card-${key}" type="button" onclick="showExploreCard('${key}', ${index})">
      <span class="discover-card-art"><span class="discover-card-icon">${icon}</span></span>
      ${item.tag ? `<em>${escapeHTML(item.tag)}</em>` : ''}
      <strong>${escapeHTML(title)}</strong>
      <small>${escapeHTML(item.body || '')}</small>
    </button>`;
}

function discoverImageFor(key, index) {
  if (key === 'emotions') return '';
  const offsets = { recommended: 0, realizations: 4, needs: 10, questions: 18, collections: 24, myths: 32, translations: 36 };
  const imageNumber = (offsets[key] ?? 0) + index + 1;
  const reusableImageNumber = ((imageNumber - 1) % 17) + 1;
  return `assets/ExploreSection/Main/${reusableImageNumber}.png`;
}

function shortDiscoverTitle(title) {
  const clean = String(title || '').replace(/\.$/, '');
  const aliases = {
    'Find the feeling under the sentence': 'Under the Words',
    'Try a gentler word first': 'Gentler Words First',
    'Notice the need, not only the mood': 'Hidden Emotional Needs',
    'Check where it lives in your body': 'Body Clues First',
    'Joy': 'Feeling Joy',
    'Sadness': 'Feeling Sadness',
    'Fear': 'Feeling Fear',
    'Anger': 'Feeling Anger',
    'Trust': 'Feeling Trust',
    'Disgust': 'Feeling Disgust',
    'Anticipation': 'Feeling Anticipation',
    'Surprise': 'Feeling Surprise',
    'You can feel better without being fully okay': 'Partly Okay',
    'A feeling can be true without being the whole truth': 'Not the whole truth',
    'Needing reassurance does not make you needy': 'Needing Reassurance',
    'Not replying immediately can still be care': 'Slow Replies Count',
    'Strong emotions are not failed self-control': 'Big Feelings',
    'You do not have to earn rest by collapsing first': 'Rest Comes First',
    'What have you been carrying alone lately?': 'Carrying Alone',
    'When was the last time you felt truly understood?': 'Feeling Understood',
    'What are you avoiding thinking about?': 'Avoided Thoughts',
    'What would feel like relief, even if it is small?': 'Small Relief',
    'Where are you asking yourself to be tougher than needed?': 'Too Tough',
    'What part of you wants permission today?': 'Quiet Permission',
    'When You Feel Far Away': 'Feeling Far Away',
    'Waiting for a Reply': 'Waiting for Reply',
    'Starting Over': 'Starting Over',
    'Missing Someone': 'Missing Someone',
    'Being Misunderstood': 'Being Misunderstood',
    'Too Much at Once': 'Too Much',
    'After a Hard Conversation': 'After Talking',
    'The Quiet Before Change': 'Before Change'
  };
  if (aliases[clean]) return aliases[clean];
  if (clean.trim().split(/\s+/).length === 1) return `About ${clean}`;
  return clean.length > 18 ? `${clean.slice(0, 17).trim()}...` : clean;
}

function discoverIconFor(key, index) {
  const icons = {
    recommended: ['*', 'o', '◇', '~'],
    realizations: ['"', '~', 'o', '↺'],
    needs: ['moon', 'box', 'heart', 'space'],
    questions: ['?', '¿', '...', '.'],
    collections: ['▱', 'o', '~', '*'],
    myths: ['x', '!', '!=', '-'],
    translations: ['↓', '↳', '~', '→']
  };
  const list = icons[key] || ['*'];
  return list[index % list.length];
}

function renderDiscoverBonusRow() {
  return `
    <section class="home-section discover-section discover-bonus">
      <div class="home-section-head">
        <div>
          <h2 class="serif">More to discover</h2>
          <p>Playful ways to translate everyday emotional life.</p>
        </div>
      </div>
      <div class="bonus-grid">
        <button type="button" onclick="openExploreCollection('myths')">
          <strong class="serif">Emotional Myths</strong>
          <small>Myth vs. reality for feelings we judge too quickly.</small>
        </button>
        <button type="button" onclick="openExploreCollection('translations')">
          <strong class="serif">Emotional Translation</strong>
          <small>"I'm fine" and other sentences, gently decoded.</small>
        </button>
      </div>
    </section>`;
}

function openExploreCollection(key) {
  const collection = EXPLORE_COLLECTIONS[key];
  if (!collection) return;
  go('explore-library');
  const title = document.getElementById('discover-grid-title');
  const sub = document.getElementById('discover-grid-sub');
  const grid = document.getElementById('discover-grid');
  if (title) title.textContent = collection.title;
  if (sub) sub.textContent = collection.subtitle;
  if (grid) {
    grid.className = `discover-grid discover-grid-${key}`;
    grid.innerHTML = discoverItemsFor(key).map((item, index) => `
      <button class="discover-grid-card discover-grid-card-${key}" type="button" onclick="showExploreCard('${key}', ${index})">
        <span class="discover-grid-icon">${key === 'emotions' && item.id
          ? emotionSymbol(item.id)
          : discoverGridImage(key, item, index)}</span>
        ${item.tag ? `<em>${escapeHTML(item.tag)}</em>` : ''}
        <strong class="serif">${escapeHTML(item.title)}</strong>
        <small>${escapeHTML(item.body)}</small>
      </button>`).join('');
  }
  document.querySelector('#explore-library .discover-grid')?.scrollTo({ top: 0, behavior: 'auto' });
}

function discoverGridImage(key, item, index) {
  const image = item.image || discoverImageFor(key, index);
  return image
    ? `<img src="${image}" alt="${escapeAttr(item.title)}">`
    : '<span class="discover-image-placeholder" aria-hidden="true"></span>';
}

function showExploreCard(key, index) {
  const item = discoverItemsFor(key)[index];
  if (!item) return;
  const collection = EXPLORE_COLLECTIONS[key];
  const detail = exploreDetailFor(key, item);
  const visual = document.getElementById('explore-detail-visual');
  const image = key === 'emotions' ? '' : (item.image || discoverImageFor(key, index));
  if (visual) {
    visual.className = `explore-detail-visual explore-detail-visual-${key}`;
    visual.innerHTML = image
      ? `<img src="${image}" alt="">`
      : (item.id ? emotionSymbol(item.id) : '');
  }
  document.getElementById('explore-detail-kicker').textContent = collection?.title || 'Explore';
  document.getElementById('explore-detail-title').textContent = item.title;
  document.getElementById('explore-detail-prompt').textContent = detail.prompt;
  document.getElementById('explore-detail-example').textContent = detail.example;
  document.getElementById('explore-detail-why').textContent = detail.why;
  document.getElementById('explore-detail-practice').textContent = detail.practice;
  document.getElementById('explore-detail-example-wrap')?.classList.toggle('hidden', !detail.example);
  window.activeExploreReflection = { title: item.title, prompt: detail.prompt };
  go('explore-detail');
  document.querySelector('#explore-detail .explore-detail-scroll')?.scrollTo({ top: 0, behavior: 'auto' });
}

function exploreDetailFor(key, item) {
  const title = String(item.title || '');
  const body = String(item.body || '');
  const tailored = {
    recommended: {
      prompt: `${body} Pause before solving anything. What is the sentence, sensation, or need asking you to notice?`,
      example: `“Part of me keeps returning to this because it wants reassurance, not an immediate answer.”`,
      why: 'Putting a gentle name around an experience can reduce the pressure to explain it perfectly. It creates enough distance to notice what the feeling may be protecting or requesting.',
      practice: 'Finish one sentence: “Underneath this, I might be feeling…”'
    },
    emotions: {
      prompt: `${body} Where do you notice ${title.toLowerCase()} in your body, thoughts, or urge to act?`,
      example: `“When ${title.toLowerCase()} arrives, I notice it first in my shoulders and in the story I begin telling myself.”`,
      why: 'Recognizing an emotion as a signal, rather than a verdict, can make it easier to respond with curiosity and choice.',
      practice: `Name one need that may be sitting beside ${title.toLowerCase()}.`
    },
    realizations: {
      prompt: `${body} What changes when you allow this idea to be true for today?`,
      example: '“I do not need to feel completely different before I can take one kind step.”',
      why: 'Small realizations loosen rigid stories. They make room for two things to be true at once, which can soften self-judgment.',
      practice: 'Rewrite this realization in your own words, as if you were saying it to someone you care about.'
    },
    needs: {
      prompt: `${body} How might this need be showing up indirectly in your emotions or choices?`,
      example: `“I thought I needed to push harder, but I may actually need ${title.replace('Need for ', '').toLowerCase()}.”`,
      why: 'Emotions often become clearer when we look beneath them for an unmet need. The need does not demand an immediate fix; noticing it is already useful.',
      practice: 'Choose one small, realistic way to honor this need within the next day.'
    },
    questions: {
      prompt: title,
      example: body,
      why: 'A quiet question creates space without forcing a conclusion. It can reveal what has been present but difficult to approach directly.',
      practice: 'Write for two minutes without editing, explaining, or trying to sound reasonable.'
    },
    collections: {
      prompt: `${body} Which part of this experience feels closest to where you are right now?`,
      example: `“The part I keep returning to is not the whole experience, but it may be the part asking for care.”`,
      why: 'Grouping related experiences can make an emotional moment feel less isolated and easier to understand.',
      practice: 'Pick one feeling from this collection and describe what it wants you to know.'
    },
    myths: {
      prompt: `${title} ${body} Where did you learn the original rule, and what has it cost you?`,
      example: '“This rule once helped me feel protected, but it does not need to decide how I treat myself now.”',
      why: 'Questioning emotional myths helps separate inherited expectations from what is actually supportive, honest, and humane.',
      practice: 'Replace the myth with one sentence that leaves more room for being human.'
    },
    translations: {
      prompt: `${title} ${body} If this sentence could speak more honestly, what might it say?`,
      example: '“I am not ready to explain everything, but something here matters to me.”',
      why: 'Everyday phrases can hide several feelings at once. Translating them gently creates more precise choices without demanding perfect certainty.',
      practice: 'Write the sentence again, adding just five more honest words.'
    }
  };
  return tailored[key] || {
    prompt: body,
    example: '',
    why: 'Taking a moment to notice your experience can create more room for choice.',
    practice: 'Write one honest sentence about what is here now.'
  };
}

function startExploreReflection() {
  const reflection = window.activeExploreReflection;
  go('input-modal');
  const input = document.getElementById('story-input');
  if (input && reflection) {
    input.value = `${reflection.title}\n\n${reflection.prompt}\n\n`;
    input.focus();
    updateCharCount();
  }
}

const NOTE_EMOTION_GROUPS = [
  { id: 'anger', label: 'Anger', color: '#f47b68', symbol: 'anger' },
  { id: 'joy', label: 'Joy', color: '#f6c85f', symbol: 'joy' },
  { id: 'sadness', label: 'Sadness', color: '#78aee8', symbol: 'sadness' },
  { id: 'fear', label: 'Fear', color: '#9a82d0', symbol: 'fear' },
  { id: 'disgust', label: 'Disgust', color: '#8bc7a0', symbol: 'disgust' },
  { id: 'trust', label: 'Trust', color: '#ee9fb3', symbol: 'trust' },
  { id: 'surprise', label: 'Surprise', color: '#f2a064', symbol: 'suprise' },
  { id: 'anticipation', label: 'Anticipation', color: '#7dc5d7', symbol: 'anticipation' }
].map((group, index) => ({ ...group, emotions: ALLOWED_EMOTIONS.slice(index * 10, index * 10 + 10) }));

function toggleEntryModeMenu() {
  document.getElementById('entry-mode-menu')?.classList.toggle('show');
}

function selectEntryMode(mode) {
  document.getElementById('entry-mode-menu')?.classList.remove('show');
  switchingEntryMode = true;
  if (mode === 'note') go('note-it');
  if (mode === 'unpack') go('input-modal');
  switchingEntryMode = false;
}

function renderNoteIt() {
  const wheel = document.getElementById('emotion-wheel');
  if (!wheel) return;
  const group = NOTE_EMOTION_GROUPS[selectedNoteGroup] || NOTE_EMOTION_GROUPS[0];
  if (!group.emotions.includes(selectedNoteEmotion)) selectedNoteEmotion = group.emotions[0];
  wheel.innerHTML = `
    <div class="note-spectrum" style="--selected-family:${group.color}">
      <div class="note-family-tabs" role="tablist" aria-label="Emotion families" onscroll="syncNoteFamilyCarousel(this)">
        ${NOTE_EMOTION_GROUPS.map((family, index) => `
          <button type="button" class="${index === selectedNoteGroup ? 'active' : ''}"
            style="--family:${family.color}" onclick="selectNoteGroup(${index}, true)"
            role="tab" aria-selected="${index === selectedNoteGroup}">
            <img src="assets/Symbols/${family.symbol}.svg" alt="">
            <span>${family.label}</span>
          </button>`).join('')}
      </div>
      <div class="note-spectrum-head">
        <div>
          <span id="note-family-label">${group.label} family</span>
          <strong class="serif">Which word feels closest?</strong>
        </div>
        <img id="note-family-symbol" src="assets/Symbols/${group.symbol}.svg" alt="">
      </div>
      <div class="note-emotion-grid">
        ${group.emotions.map((emotion, index) => `
          <button type="button" class="${emotion === selectedNoteEmotion ? 'active' : ''}"
            style="--family:${group.color};--delay:${index * 18}ms"
            onclick="selectNoteEmotion('${escapeAttr(emotion)}')">
            <span>${escapeHTML(emotion)}</span>
            <small>${escapeHTML(EMOTION_DEFINITIONS[emotion] || '')}</small>
          </button>`).join('')}
      </div>
    </div>
  `;
  updateNoteItCopy();
  requestAnimationFrame(() => centerSelectedNoteFamily('auto'));
}

function selectNoteGroup(index, shouldCenter = false) {
  if (!NOTE_EMOTION_GROUPS[index]) return;
  selectedNoteGroup = index;
  selectedNoteEmotion = NOTE_EMOTION_GROUPS[index].emotions[0];
  updateNoteFamilyTabs();
  updateNoteSpectrumContent();
  updateNoteItCopy();
  if (shouldCenter) centerSelectedNoteFamily('smooth');
}

function selectNoteEmotion(emotion) {
  selectedNoteEmotion = emotion;
  const groupIndex = NOTE_EMOTION_GROUPS.findIndex(group => group.emotions.includes(emotion));
  if (groupIndex >= 0) selectedNoteGroup = groupIndex;
  updateNoteEmotionSelection();
  updateNoteItCopy();
}

function updateNoteFamilyTabs() {
  document.querySelectorAll('.note-family-tabs button').forEach((button, index) => {
    const active = index === selectedNoteGroup;
    button.classList.toggle('active', active);
    button.setAttribute('aria-selected', String(active));
  });
}

function centerSelectedNoteFamily(behavior = 'smooth') {
  const selected = document.querySelector('.note-family-tabs button.active');
  selected?.scrollIntoView({ behavior, inline: 'center', block: 'nearest' });
}

function syncNoteFamilyCarousel(carousel) {
  clearTimeout(noteFamilyScrollTimer);
  noteFamilyScrollTimer = setTimeout(() => {
    const center = carousel.getBoundingClientRect().left + carousel.clientWidth / 2;
    const buttons = [...carousel.querySelectorAll('button')];
    const closest = buttons.reduce((best, button) => {
      const rect = button.getBoundingClientRect();
      const distance = Math.abs(rect.left + rect.width / 2 - center);
      return !best || distance < best.distance ? { button, distance } : best;
    }, null)?.button;
    const index = buttons.indexOf(closest);
    if (index >= 0 && index !== selectedNoteGroup) selectNoteGroup(index);
  }, 120);
}

function updateNoteSpectrumContent() {
  const group = NOTE_EMOTION_GROUPS[selectedNoteGroup] || NOTE_EMOTION_GROUPS[0];
  const spectrum = document.querySelector('.note-spectrum');
  const label = document.getElementById('note-family-label');
  const symbol = document.getElementById('note-family-symbol');
  const grid = document.querySelector('.note-emotion-grid');
  spectrum?.style.setProperty('--selected-family', group.color);
  if (label) label.textContent = `${group.label} family`;
  if (symbol) symbol.src = `assets/Symbols/${group.symbol}.svg`;
  if (grid) {
    grid.innerHTML = group.emotions.map(emotion => `
      <button type="button" class="${emotion === selectedNoteEmotion ? 'active' : ''}"
        style="--family:${group.color}" onclick="selectNoteEmotion('${escapeAttr(emotion)}')">
        <span>${escapeHTML(emotion)}</span>
        <small>${escapeHTML(EMOTION_DEFINITIONS[emotion] || '')}</small>
      </button>`).join('');
  }
}

function updateNoteEmotionSelection() {
  document.querySelectorAll('.note-emotion-grid button').forEach(button => {
    button.classList.toggle('active', button.querySelector('span')?.textContent === selectedNoteEmotion);
  });
}

function updateNoteItCopy() {
  const emotion = document.getElementById('note-it-emotion');
  const definition = document.getElementById('note-it-definition');
  const group = NOTE_EMOTION_GROUPS[selectedNoteGroup];
  if (emotion) {
    emotion.textContent = selectedNoteEmotion;
    emotion.style.color = group?.color || '#9371b6';
  }
  if (definition) definition.textContent = EMOTION_DEFINITIONS[selectedNoteEmotion] || '';
}

function saveNoteIt() {
  const group = NOTE_EMOTION_GROUPS[selectedNoteGroup] || NOTE_EMOTION_GROUPS[0];
  const now = new Date();
  const localDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  const data = getData(currentUser);
  const planet = {
    emotion: selectedNoteEmotion,
    category: group.label,
    color: group.color,
    definition: EMOTION_DEFINITIONS[selectedNoteEmotion] || '',
    subtitle: `A quick Note it check-in from the ${group.label.toLowerCase()} family.`,
    source: 'note-it'
  };
  data.records = [{
    date: localDate,
    time: now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    story: `Note it: ${selectedNoteEmotion}`,
    source: 'note-it',
    planet
  }, ...(data.records || [])];
  data.cover = { ...(data.cover || {}), [now.getDate()]: planet };
  saveData(currentUser, data);
  showToast(`${selectedNoteEmotion} saved to Entries and Patterns.`);
  go('entries-page');
}

function renderExploreRecords() {
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
    listEl.innerHTML = '<div class="empty-state home-empty">No check-ins yet today.<br>Tap Check in when something wants a little language.</div>';
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

function shareExplore() {
  const text = 'Aemona helps me find softer words for complicated feelings.';
  if (navigator.share) {
    navigator.share({ title: 'Aemona', text }).catch(() => {});
    return;
  }
  navigator.clipboard?.writeText(text);
  showToast('Share text copied.');
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
  currentInputMode = 'type';
  voiceRecorder = null;
  voiceRecognition = null;
  voiceChunks = [];
  voiceBlob = null;
  showImageFile = null;
  if (showImageUrl) URL.revokeObjectURL(showImageUrl);
  showImageUrl = '';
  const storyInput = document.getElementById('story-input');
  const charCount = document.querySelector('.story-char-count');
  
  if (storyInput) {
    storyInput.value = '';
    storyInput.placeholder = "";
    storyInput.closest('.story-area')?.classList.remove('has-text');
    storyInput.removeAttribute('maxlength');
    if (storyInput._updateHandler) {
      storyInput.removeEventListener('input', storyInput._updateHandler);
    }
    storyInput._updateHandler = function() { updateCharCount(); };
    storyInput.addEventListener('input', storyInput._updateHandler);
  }
  if (charCount) {
    charCount.textContent = `0/${MAX_CHARS}`;
  }
  setInputMode('type');
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
  storyInput.closest('.story-area')?.classList.toggle('has-text', charCountNum > 0);
  charCount.textContent = `${charCountNum}/${MAX_CHARS}`;
  saveSessionState('input-modal');
}

function setInputMode(mode) {
  currentInputMode = mode;
  document.querySelectorAll('.mode-tab').forEach(t =>
    t.classList.toggle('active', t.dataset.mode === mode));
  if (mode === 'say') {
    toggleVoiceRecording();
  } else if (mode === 'show') {
    document.getElementById('show-image-input')?.click();
  }
  renderInputAttachment();
}

async function toggleVoiceRecording() {
  if (voiceRecorder?.state === 'recording') {
    voiceRecorder.stop();
    voiceRecognition?.stop();
    return;
  }
  if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
    showToast('Voice recording is not supported in this browser.');
    setInputMode('type');
    return;
  }
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    voiceChunks = [];
    voiceRecorder = new MediaRecorder(stream);
    voiceRecorder.ondataavailable = event => {
      if (event.data.size) voiceChunks.push(event.data);
    };
    voiceRecorder.onstop = () => {
      voiceBlob = new Blob(voiceChunks, { type: voiceRecorder.mimeType || 'audio/webm' });
      stream.getTracks().forEach(track => track.stop());
      addAttachmentToStory('[Voice note attached]');
      renderInputAttachment();
    };
    voiceRecorder.start();
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
      voiceRecognition = new SpeechRecognition();
      voiceRecognition.continuous = true;
      voiceRecognition.interimResults = false;
      voiceRecognition.lang = navigator.language || 'en-US';
      voiceRecognition.onresult = event => {
        const transcript = Array.from(event.results)
          .slice(event.resultIndex)
          .map(result => result[0]?.transcript || '')
          .join(' ')
          .trim();
        if (transcript) addAttachmentToStory(transcript);
      };
      voiceRecognition.onerror = error => console.warn('[Unpack] Speech recognition:', error.error);
      voiceRecognition.start();
    }
    renderInputAttachment();
  } catch (error) {
    console.error('[Unpack] Voice recording failed:', error);
    showToast('Microphone permission is needed to record.');
    setInputMode('type');
  }
}

function handleShowImage(input) {
  const file = input.files?.[0];
  if (!file) {
    setInputMode('type');
    return;
  }
  if (!file.type.startsWith('image/')) {
    showToast('Choose an image file.');
    input.value = '';
    return;
  }
  showImageFile = file;
  if (showImageUrl) URL.revokeObjectURL(showImageUrl);
  showImageUrl = URL.createObjectURL(file);
  addAttachmentToStory(`[Image attached: ${file.name}]`);
  renderInputAttachment();
}

function addAttachmentToStory(text) {
  const input = document.getElementById('story-input');
  if (!input) return;
  if (!input.value.includes(text)) {
    input.value = `${input.value.trim()}${input.value.trim() ? '\n' : ''}${text}`;
  }
  updateCharCount();
}

function removeInputAttachment(kind) {
  const input = document.getElementById('story-input');
  if (kind === 'voice') {
    voiceBlob = null;
    if (input) input.value = input.value.replace(/\n?\[Voice note attached\]/g, '');
  }
  if (kind === 'image') {
    showImageFile = null;
    if (showImageUrl) URL.revokeObjectURL(showImageUrl);
    showImageUrl = '';
    const imageInput = document.getElementById('show-image-input');
    if (imageInput) imageInput.value = '';
    if (input) input.value = input.value.replace(/\n?\[Image attached: [^\]]+\]/g, '');
  }
  updateCharCount();
  renderInputAttachment();
}

function renderInputAttachment() {
  const panel = document.getElementById('input-attachment-panel');
  if (!panel) return;
  const isRecording = voiceRecorder?.state === 'recording';
  panel.innerHTML = `
    ${isRecording ? `<button class="attachment-chip recording" type="button" onclick="toggleVoiceRecording()">Recording... tap to stop</button>` : ''}
    ${voiceBlob ? `<button class="attachment-chip" type="button" onclick="removeInputAttachment('voice')">Voice note attached ×</button>` : ''}
    ${showImageUrl ? `<div class="attachment-image-wrap"><img src="${showImageUrl}" alt="Selected image"><button type="button" onclick="removeInputAttachment('image')" aria-label="Remove image">×</button></div>` : ''}
  `;
  panel.classList.toggle('show', Boolean(panel.innerHTML.trim()));
}

function renderQuickTags() {
  const sections = [
    {
      key: 'about',
      label: 'What feels closest to this?',
      items: [
        tagAsset('+', 'assets/ExploreSection/Unpack/PLusButton-default.svg', 'assets/ExploreSection/Unpack/plusButton-a.svg', 0, 0, 23),
        tagAsset('About something', 'assets/ExploreSection/Unpack/AboutSomethingButton-default.svg', 'assets/ExploreSection/Unpack/aboutsomethingButton-a.svg', 48, 0, 146),
        tagAsset('About someone', 'assets/ExploreSection/Unpack/AboutsomeoneButton-default.svg', 'assets/ExploreSection/Unpack/aboutsomeone-a.svg', 206, 0, 146),
        tagAsset('About myself', 'assets/ExploreSection/Unpack/AboutmyselfButton-default.svg', 'assets/ExploreSection/Unpack/aboutmyself-a.svg', 16, 34, 146),
        tagAsset('All of everything', 'assets/ExploreSection/Unpack/AboutEverythingButton-default.svg', 'assets/ExploreSection/Unpack/abitofeverything-a.svg', 174, 34, 146)
      ]
    },
    {
      key: 'duration',
      label: 'How long has it been with you?',
      items: [
        tagAsset('+', 'assets/ExploreSection/Unpack/PLusButton-default.svg', 'assets/ExploreSection/Unpack/plusButton-a.svg', 0, 0, 23),
        tagAsset('Just now', 'assets/ExploreSection/Unpack/JustnowButton-default.svg', 'assets/ExploreSection/Unpack/justnow-a.svg', 48, 0, 146),
        tagAsset('Most of today', 'assets/ExploreSection/Unpack/mostoftodayButton-default.svg', 'assets/ExploreSection/Unpack/mostoftoday-a.svg', 206, 0, 146),
        tagAsset('Several days', 'assets/ExploreSection/Unpack/SeverDaysButton-default.svg', 'assets/ExploreSection/Unpack/severaldays-a.svg', 16, 34, 146),
        tagAsset('Longer than that', 'assets/ExploreSection/Unpack/lONGERTHANTHATButton-DEFAULT.svg', 'assets/ExploreSection/Unpack/longerthanthat-a.svg', 174, 34, 146)
      ]
    },
    {
      key: 'space',
      label: 'How much space is it taking up?',
      items: [
        tagAsset('+', 'assets/ExploreSection/Unpack/PLusButton-default.svg', 'assets/ExploreSection/Unpack/plusButton-a.svg', 0, 0, 23),
        tagAsset('In the background', 'assets/ExploreSection/Unpack/BACKGROUNDButton-DEFAULT.svg', 'assets/ExploreSection/Unpack/inbackground-a.svg', 48, 0, 146),
        tagAsset('Keeps coming back', 'assets/ExploreSection/Unpack/COMINGBACKButton-DEFAULT.svg', 'assets/ExploreSection/Unpack/comingback-a.svg', 206, 0, 146),
        tagAsset('Hard to ignore', 'assets/ExploreSection/Unpack/HARDTOINGOREButton.svg', 'assets/ExploreSection/Unpack/hardtoignore-a.svg', 16, 34, 146),
        tagAsset("It's all I can think about", 'assets/ExploreSection/Unpack/ALLCANTHINKABOUTButton-DEFAULT.svg', 'assets/ExploreSection/Unpack/allicanthinkabout-a.svg', 174, 34, 146)
      ]
    },
    {
      key: 'body',
      label: 'Notice it in your body?',
      items: [
        tagAsset('+', 'assets/ExploreSection/Unpack/PLusButton-default.svg', 'assets/ExploreSection/Unpack/plusButton-a.svg', 0, 0, 23),
        tagAsset('Head', 'assets/ExploreSection/Unpack/HEADButton-DEFAULT.svg', 'assets/ExploreSection/Unpack/head-a.svg', 42, 0, 55),
        tagAsset('Chest', 'assets/ExploreSection/Unpack/CHEST-DEFAULT.svg', 'assets/ExploreSection/Unpack/chest-a.svg', 98, 0, 64),
        tagAsset('Throat', 'assets/ExploreSection/Unpack/throatButton-default.svg', 'assets/ExploreSection/Unpack/throat-a.svg', 164, 0, 66),
        tagAsset('Stomach', 'assets/ExploreSection/Unpack/StomachButton-default.png', 'assets/ExploreSection/Unpack/Stomach-a.svg', 232, 0, 78),
        tagAsset('Legs', 'assets/ExploreSection/Unpack/legsButton-default.svg', 'assets/ExploreSection/Unpack/legs-a.svg', 312, 0, 49)
      ]
    }
  ];
  const wrap = document.getElementById('qtag-sections');
  if (!wrap) return;
  wrap.innerHTML = sections.map(s => `
    <div class="qtag-group" data-key="${s.key}">
      <div class="qtag-label">${s.label}</div>
      <div class="qtag-row">
        ${s.items.map(item => {
          const active = (currentTags[s.key] || []).includes(item.value);
          return `<button class="qtag ${item.value === '+' ? 'qtag-plus' : ''} ${active ? 'active' : ''}"
                    type="button"
                    data-key="${escapeAttr(s.key)}"
                    data-value="${escapeAttr(item.value)}"
                    style="left:${item.x}px;top:${item.y}px;width:${item.w}px;background-image:url('${active ? item.active : item.default}')"
                    onclick="toggleTagFromButton(this)">${escapeHTML(item.value)}</button>`;
        }).join('')}
        ${renderCustomTags(s.key, s.items)}
      </div>
    </div>`).join('');
}

function tagAsset(value, defaultSrc, activeSrc, x, y, w) {
  return { value, default: defaultSrc, active: activeSrc, x, y, w };
}

function escapeHTML(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function escapeAttr(value) {
  return escapeHTML(value);
}

function toggleTagFromButton(btn) {
  toggleTag(btn.dataset.key, btn.dataset.value);
}

function renderCustomTags(key, assetItems) {
  const assetValues = new Set(assetItems.map(item => item.value));
  const custom = (currentTags[key] || []).filter(value => !assetValues.has(value));
  if (!custom.length) return '';
  return `<div class="qtag-custom-list">
    ${custom.map(value => `<button class="qtag-custom active"
      type="button"
      data-key="${escapeAttr(key)}"
      data-value="${escapeAttr(value)}"
      onclick="toggleTagFromButton(this)">${escapeHTML(value)}</button>`).join('')}
  </div>`;
}

function toggleTag(key, val) {
  if (val === '+') {
    addCustomTag(key);
    return;
  }
  const isActive = (currentTags[key] || []).includes(val);
  currentTags[key] = isActive ? [] : [val];
  renderQuickTags();
  saveSessionState('input-modal');
}

function addCustomTag(key) {
  const label = prompt('Add your own option');
  const value = (label || '').trim().replace(/\s+/g, ' ').slice(0, 32);
  if (!value) return;
  currentTags[key] = [value];
  renderQuickTags();
  saveSessionState('input-modal');
}

function normalizeEmotionName(value) {
  const raw = String(value || '').trim();
  const matched = ALLOWED_EMOTIONS.find(emotion => emotion.toLowerCase() === raw.toLowerCase());
  return matched || 'Blank';
}

function getEmotionDefinition(emotion) {
  return EMOTION_DEFINITIONS[emotion] || EMOTION_DEFINITIONS.Blank || '';
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
  setAIStatus('AI is reading what you shared...');
  await generateSliderQuestions();
}


// ── AI FLOW: Slider Questions ──────────────────────────────────
async function generateSliderQuestions() {
  const d    = getData(currentUser);
  const comp = selectedCompanion || COMPANIONS[0];

  const prompt = `You are ${comp.name}, a gentle emotion companion in Aemona.
The user shared: "${currentStory}"

⚠️ CRITICAL: Respond in the SAME LANGUAGE as the user's story. If the user wrote in English, your entire output (including emotion name, subtitle, analysis, companion note) must be in English. If they wrote in Chinese, respond in Chinese. DO NOT mix languages. DO NOT output English when they used another language.

Generate exactly 5 short introspective slider questions to help them explore their emotional state.
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
    setAIStatus('AI is crafting questions for you...');
    aiSliderQs = parseJSON(await callAI(prompt));
    aiSliderQs = Array.isArray(aiSliderQs) ? aiSliderQs.slice(0, 5) : FALLBACK_SLIDER_QUESTIONS;
    if (aiSliderQs.length < 5) aiSliderQs = FALLBACK_SLIDER_QUESTIONS;
  } catch (e) {
    console.error('Slider Q generation failed:', e);
    aiSliderQs = FALLBACK_SLIDER_QUESTIONS;
  }

  sliderAnswers = new Array(aiSliderQs.length).fill(50);
  questionStep = 0;
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

function renderSliderQuestions() {
  const body = document.getElementById('q-page-body');
  if (!body) return;
  const comp = selectedCompanion || COMPANIONS[0];
  const safeStep = Math.min(Math.max(questionStep, 0), 4);
  questionStep = safeStep;
  const q = aiSliderQs[safeStep] || FALLBACK_SLIDER_QUESTIONS[safeStep] || FALLBACK_SLIDER_QUESTIONS[0];
  const storedVal = sliderAnswers[safeStep] ?? 50;
  const val = Math.min(6, Math.max(0, Math.round(storedVal / 100 * 6)));
  const sliderFill = followupSliderFill(val);
  const progressPct = ((safeStep + 1) / 5) * 200;

  body.innerHTML = `
    <div class="followup-screen">
      <button class="followup-back" type="button" onclick="previousSliderQuestion()" aria-label="Back"></button>
      <div class="followup-progress">
        <div class="followup-progress-fill" style="width:${progressPct}px"></div>
      </div>
      <div class="followup-count">${safeStep + 1}/5</div>

      <img class="followup-companion" src="${companionAssetPath(comp)}" alt="${escapeAttr(comp.name)}">

      <div class="followup-card">
        <div class="followup-question">${escapeHTML(q.q)}</div>
      </div>

      <div class="followup-slider-wrap">
        <div class="followup-slider-field">
          <div class="followup-level-bars">
            ${[150, 112, 82, 54, 76, 108, 134].map((height, index) =>
              `<span class="followup-level-bar ${index === val ? 'active' : ''}" style="height:${height}px"></span>`
            ).join('')}
          </div>
          <input type="range" class="emotion-slider followup-slider" min="0" max="6" step="1" value="${val}"
                 style="${sliderFill}"
                 oninput="onSlider(${safeStep}, this.value)"
                 onchange="onSlider(${safeStep}, this.value)">
        </div>
        <div class="slider-q-labels followup-labels">
          <span>${escapeHTML(q.left)}</span>
          <span>${escapeHTML(q.right)}</span>
        </div>
      </div>

      <button class="followup-next btn" type="button" onclick="nextSliderQuestion()">${safeStep === 4 ? 'See my result' : 'Continue'}</button>
    </div>`;
  saveSessionState('questions');
}

function companionAssetPath(comp) {
  const id = (comp?.id || 'echo').toLowerCase();
  const fileMap = { avis: 'avis', echo: 'echo', milo: 'milo', sila: 'sila' };
  return `assets/Components/Property 1=${fileMap[id] || 'echo'}.svg`;
}

function previousSliderQuestion() {
  if (questionStep <= 0) {
    go('input-modal');
    return;
  }
  questionStep -= 1;
  renderSliderQuestions();
}

function nextSliderQuestion() {
  if (questionStep >= 4) {
    generateResult();
    return;
  }
  questionStep += 1;
  renderSliderQuestions();
}

function onSlider(i, val) {
  const level = parseInt(val);
  sliderAnswers[i] = Math.round(level / 6 * 100);
  const slider = document.querySelector('.followup-slider');
  if (slider) slider.style.cssText = followupSliderFill(level);
  document.querySelectorAll('.followup-level-bar').forEach((bar, index) => {
    bar.classList.toggle('active', index === level);
  });
  saveSessionState('questions');
}

function followupSliderFill(level) {
  const pct = level / 6 * 100;
  const start = Math.min(50, pct);
  const end = Math.max(50, pct);
  return `--fill-start:${start}%;--fill-end:${end}%;`;
}

function setAIStatus(msg) {
  const el = document.getElementById('ai-status');
  if (el) el.textContent = msg;
}


// ── AI FLOW: Generate Result ───────────────────────────────────
async function generateResult() {
  go('ai-loading-page');
  setAIStatus('AI is shaping your emotion planet...');
 
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

⚠️ CRITICAL: Respond in the SAME LANGUAGE as the user's story. If the user wrote in English, your entire output (including emotion name, subtitle, analysis, companion note) must be in English. If they wrote in Chinese, respond in Chinese. DO NOT mix languages. DO NOT output English when they used another language.

Use a wide variety of emotional words. Avoid repeating the same emotion label across different users. Choose from the full range of human emotions (e.g., bittersweet, nostalgic, restless, tender, etc.).

Slider responses (0=left pole, 100=right pole):
${qAndA}

User sensitivity: ${sp ? sp.label + ' (' + sp.score + '/5)' : 'Unknown'}

Allowed emotion names:
${ALLOWED_EMOTIONS.join(', ')}

Emotion definitions:
${Object.entries(EMOTION_DEFINITIONS).map(([name, definition]) => `${name}: ${definition}`).join('\n')}

Generate a warm emotion result. Return ONLY valid JSON, no markdown:
{
  "emotion": "choose EXACTLY ONE value from the allowed emotion names list above",
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
  "ai_analysis": "A clear, gentle paragraph analyzing the user's mood based on their story and slider answers (3-4 sentences).",
  "tools": ["<tool id from: tap|draw|breath|badge|unsent|loop>", "<second tool id>"],
  "companion_note": "1-2 sentences from ${comp.name} specifically about what the user shared. Use the selected emotion definition as the note's emotional foundation, but do not quote it mechanically."
}`;

  try {
    setAIStatus('Almost there...');
    const raw  = await callAI(prompt);
    const pd   = parseJSON(raw);
    const emotionName = normalizeEmotionName(pd.emotion);
    currentPlanet = {
      emotion:    emotionName,
      definition: getEmotionDefinition(emotionName),
      subtitle:   pd.subtitle,
      color:      pd.color1,
      gradient:   pd.gradient || `radial-gradient(circle at 35% 35%, ${lighten(pd.color1)}, ${pd.color1} 55%, ${darken(pd.color2)})`,
      landscape:  pd.landscape,
      ai_analysis: pd.ai_analysis || '' ,
      tools:      pd.tools || ['breath', 'unsent'],
      companion_note: pd.companion_note
    };
  } catch (e) {
    console.error('Result generation failed:', e);
    currentPlanet = { ...FALLBACK_PLANET };
  }
  saveResult();
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
      const leftId = dim.key.split('_')[0];
      const rightId = dim.key.split('_')[1];
      return `
        <div class="landscape-row">
          <div class="land-pole">${emotionSymbol(leftId)}<span>${dim.left}</span></div>
          <div class="land-track">
            <div class="land-gradient land-gradient-${dim.key}"></div>
            <div class="land-marker" style="left:${val}%"></div>
          </div>
          <div class="land-pole">${emotionSymbol(rightId)}<span>${dim.right}</span></div>
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

  const historyCount = Math.max(prev.length, 1);
  document.getElementById('result-history-note').innerHTML = `
    <span class="history-calendar">&#9633;</span>
    <span>You felt <em>${escapeHTML(currentPlanet.emotion)}</em> ${historyCount} time${historyCount === 1 ? '' : 's'} this month</span>
    <span class="history-note-link" onclick="go('entries-page')">View history</span>`;

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
          <div class="tool-rec-icon">${toolResultIcon(tid)}</div>
        </div>`;
    }).join('');
  }

  // Companion note
  const noteEl = document.getElementById('companion-note');
  if (noteEl) {
    const definition = currentPlanet.definition || getEmotionDefinition(currentPlanet.emotion);
    const note = currentPlanet.companion_note || '';
    noteEl.innerHTML = `
      ${definition ? `<div class="emotion-definition-note">${escapeHTML(definition)}</div>` : ''}
      ${note ? `<div>${escapeHTML(note)}</div>` : ''}
    `;
  }

  const shareButton = document.querySelector('#result .result-footer .btn:not(.ghost)');
  if (shareButton) shareButton.textContent = 'Share';
  const closeButton = document.querySelector('#result > .result-close');
  const moreButton = document.querySelector('#result > div:nth-child(2)');
  if (closeButton) closeButton.textContent = '×';
  if (moreButton) moreButton.textContent = '•••';

  const analysisDiv = document.getElementById('ai-analysis-section');
  const analysisText = document.getElementById('ai-analysis-text');
  if (analysisDiv && analysisText && currentPlanet.ai_analysis) {
    analysisDiv.style.display = 'block';
    analysisText.textContent = currentPlanet.ai_analysis;
  }

  saveSessionState('result');
}

function emotionSymbol(id) {
  const filename = id === 'surprise' ? 'suprise' : id;
  return `<img class="emotion-symbol" src="assets/Symbols/${filename}.svg" alt="${escapeAttr(id)}">`;
}


const analysisDiv = document.getElementById('ai-analysis-section');
const analysisText = document.getElementById('ai-analysis-text');
if (analysisDiv && analysisText && currentPlanet && currentPlanet.ai_analysis) {
  analysisDiv.style.display = 'block';
  analysisText.textContent = currentPlanet.ai_analysis;
} else if (analysisDiv) {
  analysisDiv.style.display = 'none';
}

function toolResultIcon(id) {
  const iconMap = {
    tap: 'assets/tools/tap.png',
    draw: 'assets/tools/draw.png',
    breath: 'assets/tools/breath.png',
    badge: 'assets/tools/badge.png',
    unsent: 'assets/tools/unsent.png',
    loop: 'assets/tools/loop.png'
  };
  const src = iconMap[id];
  return src ? `<img src="${src}" alt="">` : '';
}

function shareResult() {
  if (navigator.share) {
    navigator.share({
      title: 'My Aemona emotion planet',
      text: `I'm feeling ${currentPlanet.emotion}. ${currentPlanet.subtitle}`,
      url: window.location.href
    }).catch(err => console.warn('Share failed', err));
  } else {
    // 降级：复制到剪贴板
    navigator.clipboard.writeText(`${currentPlanet.emotion}: ${currentPlanet.subtitle}`);
    showToast('Copied to clipboard!');
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
  
  const tagValues = Object.values(currentTags || {}).flat().filter(Boolean);
  const bodyLocations = currentTags?.body || [];
  const needValues = currentTags?.need || currentTags?.needs || currentTags?.space || [];
  const sortedLandscape = Object.entries(currentPlanet.landscape || {})
    .sort((a, b) => Math.abs(Number(b[1]) - 50) - Math.abs(Number(a[1]) - 50));
  const secondaryEmotion = sortedLandscape[0]
    ? (Number(sortedLandscape[0][1]) >= 50 ? sortedLandscape[0][0].split('_')[1] : sortedLandscape[0][0].split('_')[0])
    : '';
  const averageIntensity = sliderAnswers.length
    ? Math.round(sliderAnswers.reduce((total, value) => total + Math.abs(Number(value) - 50) * 2, 0) / sliderAnswers.length)
    : 0;
  const d = getData(currentUser);
  d.records = [{
    date:   localDate,
    time:   timeStr,
    timestamp: now.toISOString(),
    story:  currentStory,
    planet: currentPlanet,
    tags: tagValues,
    primary_emotion: currentPlanet.emotion || '',
    secondary_emotion: secondaryEmotion,
    emotion_distribution: currentPlanet.landscape || {},
    emotional_need: needValues[0] || '',
    body_location: bodyLocations[0] || '',
    intensity: averageIntensity,
    raw_text: currentStory,
    generated_questions: aiSliderQs.map(item => item.q),
    user_answers: aiSliderQs.map((item, index) => ({
      question: item.q,
      value: sliderAnswers[index] ?? 50,
      left: item.left,
      right: item.right
    }))
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
    latestCover[dayNum] = rec;
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
    const dayDiv = document.createElement('button');
    dayDiv.type = 'button';
    dayDiv.className = 'e-cal-day';
    dayDiv.setAttribute('aria-label', `Day ${d}`);

    const yearStr = currentEntriesYear;
    const monthStr = String(currentEntriesMonth + 1).padStart(2, '0');
    const dayStr = String(d).padStart(2, '0');
    const fullDate = `${yearStr}-${monthStr}-${dayStr}`;
    const dayRecords = allRecords.filter(r => r.date === fullDate);
    const rec = latestCover[d];

    dayDiv.innerHTML = `
      <span class="entry-door-art"></span>
      <span class="entry-door-panel"><span class="entry-day-num">${d}</span></span>`;

    if (rec) {
      dayDiv.classList.add('has-entry');
      const entryFamily = entryEmotionFamily(rec.planet?.emotion, rec.planet?.category);
      dayDiv.style.setProperty('--entry-color', rec.planet?.color || entryFamily.color);
      dayDiv.style.setProperty('--entry-soft', entryFamily.soft);
      dayDiv.querySelector('.entry-door-art').innerHTML = makeEntryDoorArt(rec, d);
      dayDiv.addEventListener('click', () => toggleEntryDoor(dayDiv, rec, d));
      dayDiv.addEventListener('dblclick', (event) => {
        event.preventDefault();
        event.stopPropagation();
        dayDiv.classList.add('open');
        updateEntriesPreview(rec, d);
        showDayRecordsModal(dayRecords);
      });
    }

    if (currentEntriesYear === todayYear && currentEntriesMonth === todayMonth && d === todayDate) {
      dayDiv.classList.add('today');
    }
    if (fullDate === selectedEntriesDate) {
      dayDiv.classList.add('selected');
    }
    grid.appendChild(dayDiv);
  }

  const tabWrap = document.getElementById('month-tabs');
  if (tabWrap) {
    const todayIndex = todayYear * 12 + todayMonth;
    const monthSlots = [-1, 0, 1, 2]
      .map(offset => {
        const date = new Date(currentEntriesYear, currentEntriesMonth + offset, 1);
        return { year: date.getFullYear(), month: date.getMonth() };
      })
      .filter(slot => (slot.year * 12 + slot.month) <= todayIndex);

    tabWrap.innerHTML = monthSlots.map(slot => {
      const active = slot.year === currentEntriesYear && slot.month === currentEntriesMonth;
      return `<button class="month-tab ${active ? 'active' : ''}" type="button" data-year="${slot.year}" data-month="${slot.month}" onclick="switchEntriesMonth(this)">${months[slot.month]} ${slot.year}</button>`;
    }).join('');
  }

  const subtitle = document.querySelector('#entries-page .entries-subtitle');
  if (subtitle) subtitle.textContent = 'All the emotions you felt';
  const preview = document.getElementById('entries-door-preview');
  if (preview) resetEntriesPreview();
  renderEntriesDatePicker();
}

function toggleEntriesDatePicker() {
  const popover = document.getElementById('entries-date-popover');
  if (!popover) return;
  popover.classList.toggle('show');
  renderEntriesDatePicker();
}

function renderEntriesDatePicker() {
  const popover = document.getElementById('entries-date-popover');
  if (!popover) return;
  const months = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'];
  const records = getData(currentUser)?.records || [];
  const recordDates = new Set(records.map(r => r.date).filter(Boolean));
  const firstDay = new Date(currentEntriesYear, currentEntriesMonth, 1).getDay();
  const daysInMonth = new Date(currentEntriesYear, currentEntriesMonth + 1, 0).getDate();
  let prevYear = currentEntriesYear, prevMonth = currentEntriesMonth - 1;
  if (prevMonth < 0) { prevMonth = 11; prevYear--; }
  let nextYear = currentEntriesYear, nextMonth = currentEntriesMonth + 1;
  if (nextMonth > 11) { nextMonth = 0; nextYear++; }
  let cells = '';
  for (let i = 0; i < firstDay; i++) cells += '<span class="entries-picker-empty"></span>';
  for (let day = 1; day <= daysInMonth; day++) {
    const date = `${currentEntriesYear}-${String(currentEntriesMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const hasRecord = recordDates.has(date);
    const selected = selectedEntriesDate === date;
    cells += `<button class="entries-picker-day ${hasRecord ? 'has-record' : ''} ${selected ? 'selected' : ''}" type="button" onclick="selectEntriesDate('${date}')">${day}</button>`;
  }
  popover.innerHTML = `
    <div class="entries-picker-head">
      <button type="button" onclick="setEntriesPickerMonth(${prevYear}, ${prevMonth})">‹</button>
      <strong>${months[currentEntriesMonth]} ${currentEntriesYear}</strong>
      <button type="button" onclick="setEntriesPickerMonth(${nextYear}, ${nextMonth})">›</button>
    </div>
    <div class="entries-picker-week"><span>S</span><span>M</span><span>T</span><span>W</span><span>T</span><span>F</span><span>S</span></div>
    <div class="entries-picker-grid">${cells}</div>`;
}

function setEntriesPickerMonth(year, month) {
  currentEntriesYear = Number(year);
  currentEntriesMonth = Number(month);
  renderEntries();
  const popover = document.getElementById('entries-date-popover');
  popover?.classList.add('show');
}

function selectEntriesDate(date) {
  selectedEntriesDate = date;
  const [year, month, day] = date.split('-').map(Number);
  currentEntriesYear = year;
  currentEntriesMonth = month - 1;
  renderEntries();
  const popover = document.getElementById('entries-date-popover');
  popover?.classList.remove('show');
  const selectedCell = document.querySelector(`#e-cal-grid .e-cal-day.selected`);
  if (selectedCell?.classList.contains('has-entry')) {
    selectedCell.classList.add('open');
    const records = getData(currentUser)?.records || [];
    const rec = records.find(r => r.date === date);
    if (rec) updateEntriesPreview(rec, day);
  }
}

function toggleEntryDoor(dayDiv, rec, day) {
  if (!dayDiv || !rec) return;
  document.querySelectorAll('#e-cal-grid .e-cal-day.open').forEach(cell => {
    if (cell !== dayDiv) cell.classList.remove('open');
  });
  dayDiv.classList.toggle('open');
  if (dayDiv.classList.contains('open')) updateEntriesPreview(rec, day);
  else resetEntriesPreview();
}

function resetEntriesPreview() {
  const preview = document.getElementById('entries-door-preview');
  if (!preview) return;
  preview.innerHTML = '<div class="entries-preview-copy"><strong class="serif">A feeling lives behind each door.</strong><span>Tap a purple door to reveal it. Double-click to read the full entry.</span></div>';
}

function updateEntriesPreview(rec, day) {
  const preview = document.getElementById('entries-door-preview');
  if (!preview || !rec) return;
  const planet = rec.planet || {};
  preview.innerHTML = `
    <div class="entries-preview-art">${makeEntryDoorArt(rec, day)}</div>
    <div class="entries-preview-text">
      <div class="entries-preview-kicker">${rec.date || ''} · ${rec.time || ''} · ${escapeHTML(planet.category || entryEmotionFamily(planet.emotion).label)}</div>
      <div class="entries-preview-title serif">${escapeHTML(planet.emotion || 'A feeling')}</div>
      <div class="entries-preview-story">${escapeHTML(rec.story || 'No note saved for this entry.')}</div>
    </div>`;
}

function makeEntryDoorArt(rec, day) {
  const planet = rec?.planet || {};
  const emotion = planet.emotion || 'Feeling';
  const companionId = selectedCompanion?.id || getData(currentUser)?.companion || 'milo';
  const family = entryEmotionFamily(emotion, planet.category);
  const color = planet.color || family.color;
  const entryImage = entryEmotionImagePath(emotion, companionId);
  const companionAsset = companionAssetPath({ id: companionId });
  return `
    <div class="entry-aemona-art" style="--entry-color:${color};--entry-soft:${family.soft}">
      <span class="entry-art-glow"></span>
      <img class="entry-art-symbol" src="assets/Symbols/${family.symbol}.svg" alt="">
      <img class="entry-art-companion" src="${companionAsset}" alt="">
      <img class="entry-emotion-scene" src="${entryImage.png}" alt="${escapeAttr(emotion)} with ${escapeAttr(companionId)}"
        onerror="if(this.dataset.retry){this.style.display='none'}else{this.dataset.retry='1';this.src='${entryImage.jpg}'}">
      <span class="entry-art-emotion serif">${escapeHTML(emotion)}</span>
    </div>`;
}

function entryEmotionImagePath(emotion, companionId) {
  const folder = ALLOWED_EMOTIONS.find(name => name.toLowerCase() === String(emotion || '').toLowerCase()) || 'Blank';
  const companion = ['avis', 'echo', 'milo', 'sila'].includes(String(companionId || '').toLowerCase())
    ? String(companionId).toLowerCase()
    : 'milo';
  const base = `assets/EntriesSection/pic/${encodeURIComponent(folder)}/${companion}`;
  return { png: `${base}.png`, jpg: `${base}.jpg` };
}

function entryEmotionFamily(emotion, category) {
  const categoryMatch = NOTE_EMOTION_GROUPS.find(group => group.label.toLowerCase() === String(category || '').toLowerCase());
  if (categoryMatch) return { ...categoryMatch, soft: colorWithAlpha(categoryMatch.color, .18) };
  const group = NOTE_EMOTION_GROUPS.find(item => item.emotions.includes(emotion)) || NOTE_EMOTION_GROUPS[3];
  return { ...group, soft: colorWithAlpha(group.color, .18) };
}

function colorWithAlpha(hex, alpha) {
  if (!/^#[0-9a-f]{6}$/i.test(hex || '')) return `rgba(147,113,182,${alpha})`;
  const value = parseInt(hex.slice(1), 16);
  return `rgba(${value >> 16},${(value >> 8) & 255},${value & 255},${alpha})`;
}

function hashText(text) {
  return String(text || '').split('').reduce((acc, char) => (acc * 31 + char.charCodeAt(0)) % 9973, 7);
}

function hexToHue(hex) {
  if (!hex || !/^#[0-9a-fA-F]{6}$/.test(hex)) return null;
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  if (max === min) return 270;
  let h = max === r ? (g - b) / (max - min) : max === g ? 2 + (b - r) / (max - min) : 4 + (r - g) / (max - min);
  h *= 60;
  return Math.round(h < 0 ? h + 360 : h);
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
  dateSpan.textContent = records[0].date;

  bodyDiv.innerHTML = records.map((rec, idx) => {
    const planet = rec.planet || {};
    const emotion = planet.emotion || 'A feeling';
    const isNoteOnly = rec.source === 'note-it' || planet.source === 'note-it';
    const eventSummary = summarizeEntryEvent(rec.story);
    const story = isNoteOnly
      ? `On this day, you simply paused to record ${emotion}. No story was added, and that still counts.`
      : (rec.story || 'A feeling was recorded without a written story.');
    return `
      <article class="record-modal-item ${isNoteOnly ? 'note-only' : 'unpacked-entry'}">
        <div class="record-modal-art">${makeEntryDoorArt(rec, idx + 1)}</div>
        <div class="record-item-header">
          <span class="record-item-time">${rec.time || '--:--'}</span>
          <span class="record-item-source">${isNoteOnly ? 'Note it' : 'Unpacked'}</span>
        </div>
        <h2 class="record-item-emotion serif">${escapeHTML(emotion)}</h2>
        <section>
          <h3>${isNoteOnly ? 'A quiet check-in' : 'What happened'}</h3>
          <strong>${escapeHTML(eventSummary)}</strong>
          <p class="record-item-story">${escapeHTML(story)}</p>
        </section>
        ${planet.definition ? `
          <section class="record-item-definition">
            <h3>What this feeling can mean</h3>
            <p>${escapeHTML(planet.definition)}</p>
          </section>` : ''}
      </article>
    `;
  }).join('');
  modal.style.display = 'flex';
}

function summarizeEntryEvent(story) {
  const clean = String(story || '').replace(/^Note it:\s*/i, '').trim();
  if (!clean) return 'A feeling was recorded';
  const firstSentence = clean.split(/[.!?]\s/)[0].trim();
  return firstSentence.length > 88
    ? `${firstSentence.slice(0, 85).trim()}...`
    : firstSentence;
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
function renderPatternsLegacyStatic() {
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

function switchPatternsTabLegacy(tab) {
  document.querySelectorAll('.patterns-tab').forEach(t =>
    t.classList.toggle('active', t.dataset.tab === tab));
}

function renderPatternsLegacyCards() {
  const d = getData(currentUser);
  const records = d.records || [];
  const today = new Date();
  const todayDate = today.toISOString().slice(0, 10);
  const weekAgo = new Date(today);
  weekAgo.setDate(today.getDate() - 6);
  const weekStart = weekAgo.toISOString().slice(0, 10);
  const thisWeek = records.filter(r => r.date >= weekStart && r.date <= todayDate);
  let streak = 0;
  for (let i = 0; i < 90; i++) {
    const dt = new Date(today);
    dt.setDate(today.getDate() - i);
    const str = dt.toISOString().slice(0, 10);
    if (records.some(r => r.date === str)) streak++;
    else break;
  }
  const recordStreak = Math.max(streak, Number(d.bestStreak || 0), records.length > 0 ? Math.min(records.length, 34) : 0);
  const emotions = records.map(r => r.planet?.emotion).filter(Boolean);
  const topEmotion = emotions.length
    ? Object.entries(emotions.reduce((acc, e) => ({ ...acc, [e]: (acc[e] || 0) + 1 }), {})).sort((a,b) => b[1] - a[1])[0]?.[0]
    : 'Waiting to emerge';
  const uniqueEmotions = new Set(emotions).size;
  const body = document.querySelector('#patterns-page .patterns-body');
  if (!body) return;
  syncPatternSummary(records);
  document.querySelectorAll('.patterns-tab').forEach(t => t.classList.toggle('active', t.dataset.tab === currentPatternsTab));
  body.innerHTML = currentPatternsTab === 'deeper'
    ? renderPatternsDeeper({ streak, recordStreak, uniqueEmotions, thisWeek })
    : renderPatternsOverview({ records, streak, recordStreak, topEmotion, uniqueEmotions, thisWeek });
}

async function syncPatternSummaryLegacy(records) {
  if (!Array.isArray(records) || syncPatternSummary.busy) return;
  const signature = records.map(r => `${r.date}|${r.time}|${r.planet?.emotion || ''}`).join('~');
  const data = getData(currentUser);
  if (data.patternSummary?.signature === signature) return;
  syncPatternSummary.busy = true;
  try {
    const response = await fetch('/api/patterns', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify({ records })
    });
    if (!response.ok) throw new Error(`Patterns API failed (${response.status})`);
    const summary = await response.json();
    const latest = getData(currentUser);
    latest.patternSummary = { ...summary, signature };
    saveData(currentUser, latest);
  } catch (error) {
    console.warn('[Patterns] using local summary only:', error.message);
  } finally {
    syncPatternSummary.busy = false;
  }
}

function switchPatternsTab(tab) {
  currentPatternsTab = tab;
  document.querySelectorAll('.patterns-tab').forEach(t => t.classList.toggle('active', t.dataset.tab === tab));
  renderPatterns();
}

function renderPatternsOverviewLegacy({ records, streak, recordStreak, topEmotion, uniqueEmotions, thisWeek }) {
  const total = records.length;
  const moodHue = hexToHue(records[0]?.planet?.color || '#9371b6') ?? 268;
  return `
    <div class="patterns-section-title">Streaks</div>
    <div class="pattern-streak-grid">
      <article class="pattern-soft-card pattern-streak-card warm">
        <span>Current Streak</span>
        <strong>${streak}</strong>
        <small>days</small>
        <div class="pattern-mini-orbit">${patternShapeRow()}</div>
      </article>
      <article class="pattern-soft-card pattern-streak-card dusk">
        <span>Record Streak</span>
        <strong>${recordStreak}</strong>
        <small>days</small>
        <div class="pattern-constellation">${patternConstellation()}</div>
      </article>
    </div>
    <div class="patterns-section-title">Stats</div>
    <article class="pattern-landscape-card">
      <div class="pattern-card-kicker">Emotional Landscape<br>This year</div>
      <button class="pattern-info-dot" type="button" aria-label="More information">i</button>
      <div class="pattern-orbit-large" style="--hue:${moodHue}">
        <span class="pattern-body star"></span><span class="pattern-body cloud"></span><span class="pattern-body drop"></span><span class="pattern-body gem"></span>
      </div>
    </article>
    <div class="pattern-stat-grid">
      <article class="pattern-stat-card book"><strong>${total}</strong><span>Entries</span></article>
      <article class="pattern-stat-card shapes"><strong>${uniqueEmotions}</strong><span>Emotions<br>Explored</span></article>
      <article class="pattern-stat-card bubble"><strong>${thisWeek.length}</strong><span>Check-ins</span></article>
    </div>
    <div class="patterns-section-title relaxed">The emotion you felt most</div>
    <article class="pattern-top-emotion-card">
      <div>
        <strong class="serif">${escapeHTML(topEmotion)}</strong>
        <span>${total ? `${emotionsCount(records, topEmotion)} entries` : 'No entries yet'}</span>
        <p>${patternEmotionLine(topEmotion, total)}</p>
      </div>
      <div class="pattern-two-worlds"></div>
    </article>`;
}

function renderPatternsDeeperLegacy({ streak, recordStreak, uniqueEmotions, thisWeek }) {
  const cards = [
    { tone: 'signals', tag: 'Feeling signals', title: 'Notice Your Signals', body: 'See which emotions tend to arrive first, before the full story becomes clear.', metric: `${uniqueEmotions || 0} emotions` },
    { tone: 'rhythm', tag: 'Emotional rhythm', title: 'Connect The Dots', body: 'Find the times, situations, and repeated notes that shape your emotional weather.', metric: `${streak} day streak` },
    { tone: 'relation', tag: 'Relationship triggers', title: 'Name What Pulls', body: 'Notice when closeness, distance, waiting, or misunderstanding changes what you feel.', metric: `${recordStreak} record` },
    { tone: 'needs', tag: 'Hidden needs', title: 'Read The Need', body: 'Translate repeated feelings into needs like rest, safety, space, connection, or meaning.', metric: `${thisWeek.length} this week` }
  ];
  return `
    <article class="pattern-mode-hero">
      <div class="pattern-mode-hero-shape"></div>
      <h3>Discover your patterns</h3>
      <p>As you keep writing, themes rise like constellations. Aemona helps you see them without rushing to fix them.</p>
    </article>
    <div class="pattern-mode-list">
      ${cards.map(card => `
        <article class="pattern-mode-card ${card.tone}">
          <div class="pattern-mode-pill">${escapeHTML(card.tag)}</div>
          <div class="pattern-mode-symbol"></div>
          <h3>${escapeHTML(card.title)}</h3>
          <p>${escapeHTML(card.body)}</p>
          <span>${escapeHTML(card.metric)}</span>
        </article>`).join('')}
    </div>`;
}

function patternShapeRow() {
  return '<i class="star"></i><i class="drop"></i><i class="cloud"></i><i class="gem"></i>';
}

function patternConstellation() {
  return '<i class="star"></i><i class="drop"></i><i class="cloud"></i><i class="gem"></i>';
}

function emotionsCount(records, emotion) {
  return records.filter(r => r.planet?.emotion === emotion).length;
}

function patternEmotionLine(emotion, total) {
  if (!total) return 'Start with one check-in. Patterns need a few small moments before they can appear.';
  return `You have been meeting ${emotion.toLowerCase()} more than other feelings lately. A gentle signal, not a verdict.`;
}

const PATTERN_PACK_LIBRARY = {
  thinking: {
    defaultId: 'rumination',
    packs: {
      rumination: { title: 'Pause, Process, Reset', label: 'Thinking pattern', summary: 'Your attention may keep returning to unresolved concerns.', core: 'Replaying moments can be an attempt to find certainty after something difficult.', watch: 'Searching for a final explanation can keep thoughts active longer than they need to be.', actions: ['Name the thought without solving it immediately.', 'Set a short reflection window, then return to the present.', 'Write down what is known and what remains uncertain.'], reflection: 'What would happen if understanding was enough, without finding a final answer?' },
      self_doubt: { title: 'Trusting Your Own Voice', label: 'Thinking pattern', summary: 'You may question whether your choices or reactions were enough.', core: 'Self-doubt often appears when you care deeply about doing things well.', watch: 'Repeatedly checking yourself can make reasonable uncertainty feel like failure.', actions: ['Notice the standard you are measuring yourself against.', 'Name one decision you made with the information available.', 'Offer yourself the response you would give a close friend.'], reflection: 'What evidence would help you trust the version of you who made that choice?' },
      perfectionism: { title: 'Making Room for Enough', label: 'Thinking pattern', summary: 'High standards may be turning ordinary mistakes into heavy signals.', core: 'Wanting to do well can quietly become pressure to never be imperfect.', watch: 'Perfection can delay rest, action, and self-kindness.', actions: ['Choose a clear definition of done before starting.', 'Practice leaving one low-risk task imperfect.', 'Track effort and learning, not only outcomes.'], reflection: 'What could become possible if good enough counted today?' },
      future_worry: { title: 'Returning to Today', label: 'Thinking pattern', summary: 'Your mind may be preparing for futures that have not happened yet.', core: 'Anticipating risks can feel protective when uncertainty is high.', watch: 'Preparation becomes draining when every possibility receives equal attention.', actions: ['Separate the next step from the whole future.', 'Write one concern and one action within your control.', 'Return attention to what is happening today.'], reflection: 'Which part of this worry belongs to today?' }
    }
  },
  relationship: {
    defaultId: 'post_conflict',
    packs: {
      post_conflict: { title: 'Navigating Post-Conflict Vibes', label: 'Relationship pattern', summary: 'A disagreement may feel resolved on the surface while uncertainty remains.', core: 'You may replay conversations because the relationship matters deeply to you.', watch: 'Searching for certainty can keep the relationship emotionally frozen.', actions: ['Let the conversation settle before reopening it.', 'Separate care for the relationship from blame toward yourself.', 'Notice what repair has already happened.'], reflection: 'What would change if you trusted the relationship without needing more proof?' },
      people_pleasing: { title: 'Care Without Disappearing', label: 'Relationship pattern', summary: 'Keeping harmony may sometimes take priority over your own needs.', core: 'Attunement to others is a strength, but it can make your own limits harder to hear.', watch: 'Agreeing too quickly can slowly create distance from yourself.', actions: ['Pause before answering requests.', 'Practice one warm, clear no.', 'Name your preference before asking what others want.'], reflection: 'Where could honesty create a more genuine kind of closeness?' },
      boundary_fatigue: { title: 'Protecting Your Capacity', label: 'Relationship pattern', summary: 'Repeated demands may be making connection feel tiring.', core: 'Boundaries become harder when you feel responsible for how others react.', watch: 'Waiting until exhaustion can make a needed boundary feel harsher.', actions: ['State limits earlier and more simply.', 'Choose one relationship where you can ask for space.', 'Treat recovery time as a real commitment.'], reflection: 'What boundary would make connection feel more sustainable?' }
    }
  },
  strength: {
    defaultId: 'pillar',
    packs: {
      pillar: { title: 'The Pillar', label: 'Strength pattern', summary: 'You continue showing up even when situations feel heavy or uncertain.', core: 'You tend to process challenges through reflection rather than avoidance.', watch: 'Carrying everything alone can slowly turn resilience into exhaustion.', actions: ['Check your energy before taking on another responsibility.', 'Allow small recovery moments throughout the day.', 'Redefine productivity beyond constant output.'], reflection: 'What would become easier if support felt as acceptable as strength?' },
      observer: { title: 'The Observer', label: 'Strength pattern', summary: 'You notice subtle emotional changes and try to understand them.', core: 'Careful observation helps you name experiences that once felt vague.', watch: 'Observation can become distance when feelings are only analyzed.', actions: ['Pair one insight with one felt sensation.', 'Let an emotion exist before interpreting it.', 'Record what changed after you noticed it.'], reflection: 'What feeling needs presence more than explanation?' },
      seeker: { title: 'The Seeker', label: 'Strength pattern', summary: 'Curiosity keeps guiding you toward greater emotional clarity.', core: 'You are willing to ask difficult questions rather than settle for easy answers.', watch: 'Continuous searching can make simple truths feel incomplete.', actions: ['Keep one question open without urgency.', 'Notice what you already understand.', 'Let curiosity include gentleness.'], reflection: 'What do you already know that deserves your trust?' }
    }
  },
  growth: {
    defaultId: 'self_compassion',
    packs: {
      self_compassion: { title: 'Learning Softer Self-Talk', label: 'Growth pattern', summary: 'You are becoming more aware of how harshly you judge yourself.', core: 'Greater awareness creates room to choose a kinder response.', watch: 'Insight without kindness can become another way to criticize yourself.', actions: ['Respond to one difficult thought as you would to a friend.', 'Replace one judgment with a specific observation.', 'Notice effort before evaluating outcomes.'], reflection: 'What would kindness sound like in your inner voice?' },
      emotional_awareness: { title: 'Naming What Is Here', label: 'Growth pattern', summary: 'Your emotional language is becoming more precise.', core: 'Specific words can make difficult experiences easier to hold and communicate.', watch: 'Finding the perfect label is less important than staying connected to the feeling.', actions: ['Name a broad feeling, then one more specific word.', 'Notice where it appears in your body.', 'Record what the feeling may need.'], reflection: 'What becomes clearer when this feeling has a name?' },
      boundary_building: { title: 'Building Kinder Boundaries', label: 'Growth pattern', summary: 'You may be learning that limits can protect connection rather than threaten it.', core: 'Boundaries make room for honesty, capacity, and sustainable care.', watch: 'New boundaries can initially feel like guilt or distance.', actions: ['Start with one small, specific limit.', 'Use clear language without over-explaining.', 'Notice which relationships respect your capacity.'], reflection: 'What limit would help you stay more present?' }
    }
  }
};

// Patterns v3 keeps statistical overview separate from library-based reflection.
function buildPatternOverview(records) {
  const dates = [...new Set(records.map(record => record.date).filter(Boolean))].sort();
  let longest = 0, run = 0;
  dates.forEach((date, index) => {
    const gap = index ? Math.round((new Date(`${date}T00:00:00`) - new Date(`${dates[index - 1]}T00:00:00`)) / 86400000) : 0;
    run = gap === 1 ? run + 1 : 1;
    longest = Math.max(longest, run);
  });
  const dateSet = new Set(dates);
  const cursor = new Date();
  cursor.setHours(0, 0, 0, 0);
  let currentStreak = 0;
  for (let i = 0; i < 366; i++) {
    const key = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, '0')}-${String(cursor.getDate()).padStart(2, '0')}`;
    if (!dateSet.has(key)) break;
    currentStreak++;
    cursor.setDate(cursor.getDate() - 1);
  }
  const emotions = records.map(record => record.planet?.emotion).filter(Boolean);
  const counts = emotions.reduce((all, emotion) => ({ ...all, [emotion]: (all[emotion] || 0) + 1 }), {});
  const dimensions = [
    ['joy_sadness', 'Joy', 'Sadness'], ['trust_disgust', 'Trust', 'Disgust'],
    ['fear_anger', 'Fear', 'Anger'], ['surprise_anticipation', 'Surprise', 'Anticipation']
  ].map(([key, left, right]) => {
    const values = records.map(record => Number(record.planet?.landscape?.[key])).filter(Number.isFinite);
    return { key, left, right, value: values.length ? Math.round(values.reduce((a, b) => a + b, 0) / values.length) : 50 };
  });
  const needs = [
    ['Rest', /tired|sleep|rest|exhaust|overwhelm/i], ['Safety', /safe|anxious|afraid|uncertain|worry/i],
    ['Connection', /friend|lonely|reply|together|relationship/i], ['Space', /space|alone|quiet|pause|boundary/i],
    ['Meaning', /meaning|purpose|why|direction/i], ['Growth', /learn|improve|grow|change/i]
  ].map(([name, regex]) => ({ name, count: records.filter(record => regex.test(`${record.story || ''} ${(record.tags || []).join(' ')}`)).length }))
    .sort((a, b) => b.count - a.count).slice(0, 4);
  const dayCounts = Array(7).fill(0);
  const periods = { Morning: 0, Day: 0, Evening: 0 };
  records.forEach(record => {
    const date = new Date(`${record.date || ''}T12:00:00`);
    if (!Number.isNaN(date.valueOf())) dayCounts[date.getDay()]++;
    const match = String(record.time || '').match(/(\d{1,2}):/);
    let hour = match ? Number(match[1]) : 12;
    if (/PM/i.test(record.time) && hour < 12) hour += 12;
    if (/AM/i.test(record.time) && hour === 12) hour = 0;
    periods[hour < 10 ? 'Morning' : hour < 17 ? 'Day' : 'Evening']++;
  });
  const topicClusters = buildPatternFallbackV3(records).recurringTopics.slice(0, 4);
  return { records, currentStreak, longest, dimensions, needs, dayCounts, periods, topicClusters, uniqueEmotions: new Set(emotions).size, topEmotions: Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 4) };
}

function renderPatterns() {
  const data = getData(currentUser);
  const records = data.records || [];
  const body = document.querySelector('#patterns-page .patterns-body');
  if (!body) return;
  document.querySelectorAll('.patterns-tab').forEach(tab => tab.classList.toggle('active', tab.dataset.tab === currentPatternsTab));
  body.innerHTML = currentPatternsTab === 'deeper'
    ? renderPatternsDeeperV3(records, data.patternSummary)
    : renderPatternsOverviewV3(buildPatternOverview(records));
  syncPatternSummaryV3(records);
}

async function syncPatternSummaryV3(records) {
  if (!Array.isArray(records) || syncPatternSummaryV3.busy) return;
  const signature = records.map(record => `${record.date}|${record.time}|${record.planet?.emotion || ''}|${record.story || ''}`).join('~');
  const data = getData(currentUser);
  if (data.patternSummary?.signature === signature) return;
  syncPatternSummaryV3.busy = true;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  try {
    const response = await fetch('/api/patterns', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify({ records, useAI: data.settings?.aiEnabled !== false }),
      signal: controller.signal
    });
    if (!response.ok) throw new Error(`Patterns API failed (${response.status})`);
    const summary = await response.json();
    const latest = getData(currentUser);
    latest.patternSummary = { ...summary, signature };
    saveData(currentUser, latest);
    if (currentPatternsTab === 'deeper' && document.getElementById('patterns-page')?.classList.contains('show')) renderPatterns();
  } catch (error) {
    console.warn('[Patterns] summary unavailable:', error.message);
    const latest = getData(currentUser);
    latest.patternSummary = {
      source: 'local-fallback',
      minimumEntriesMet: records.length >= 5,
      insights: buildPatternFallbackV3(records),
      signature
    };
    saveData(currentUser, latest);
    if (currentPatternsTab === 'deeper' && document.getElementById('patterns-page')?.classList.contains('show')) renderPatterns();
  } finally {
    clearTimeout(timeout);
    syncPatternSummaryV3.busy = false;
  }
}

function patternMetricV3(label, value, unit) {
  return `<article><span>${label}</span><strong class="serif">${value}</strong><small>${unit}</small></article>`;
}

function buildPatternFallbackV3(records) {
  const text = records.map(record => `${record.story || ''} ${(record.tags || []).join(' ')}`).join(' ').toLowerCase();
  const find = groups => groups.map(group => {
    const count = group.words.reduce((total, word) => total + (text.match(new RegExp(word, 'g')) || []).length, 0);
    return count ? { title: group.title, count, summary: group.summary } : null;
  }).filter(Boolean).sort((a, b) => b.count - a.count).slice(0, 3);
  const recurringTopics = find([
    { title: 'Responsibilities', words: ['work', 'school', 'exam', 'deadline', 'task'], summary: 'Responsibilities appear across several saved moments.' },
    { title: 'Relationships', words: ['friend', 'family', 'partner', 'conversation', 'reply'], summary: 'Connection and communication keep returning.' },
    { title: 'Rest and energy', words: ['tired', 'sleep', 'rest', 'exhaust', 'energy'], summary: 'Your available energy may be shaping how moments feel.' }
  ]);
  const cognitivePatterns = find([
    { title: 'Replaying moments', words: ['again', 'thinking', 'wonder', 'should', 'conversation'], summary: 'Some moments stay active in your thoughts after they pass.' },
    { title: 'High expectations', words: ['perfect', 'must', 'enough', 'failure', 'mistake'], summary: 'You may be holding yourself to a demanding standard.' }
  ]);
  const relationshipPatterns = find([
    { title: 'Sensitivity to connection', words: ['friend', 'reply', 'conflict', 'awkward', 'misunderstood'], summary: 'Closeness and uncertainty around others may carry extra weight.' }
  ]);
  const regulationPatterns = find([
    { title: 'Reflection', words: ['notice', 'understand', 'reflect', 'realize', 'wonder'], summary: 'You often try to understand what is happening beneath the surface.' },
    { title: 'Seeking support', words: ['asked', 'talked', 'help', 'support', 'shared'], summary: 'Reaching outward is one way you respond when things feel heavy.' }
  ]);
  const psychologicalNeeds = find([
    { title: 'Rest', words: ['tired', 'sleep', 'rest', 'exhaust'], summary: 'More recovery space may be useful right now.' },
    { title: 'Connection', words: ['friend', 'lonely', 'reply', 'together'], summary: 'Feeling understood and connected may matter here.' },
    { title: 'Safety and clarity', words: ['safe', 'anxious', 'afraid', 'uncertain'], summary: 'Predictability and reassurance may help soften uncertainty.' }
  ]);
  const protectiveFactors = find([
    { title: 'Self-awareness', words: ['notice', 'realize', 'understand', 'reflect'], summary: 'You keep returning to curiosity about your inner experience.' },
    { title: 'Persistence', words: ['keep', 'continue', 'try', 'still'], summary: 'You continue showing up even when progress feels slow.' }
  ]);
  const lead = cognitivePatterns[0]?.title || recurringTopics[0]?.title || 'what keeps returning';
  return {
    recurringTopics, cognitivePatterns, relationshipPatterns, regulationPatterns,
    psychologicalNeeds, protectiveFactors,
    reflectionPrompt: `What might become easier if you met ${lead.toLowerCase()} with a little more patience?`
  };
}

function renderPatternsOverviewV3(data) {
  const maxDay = Math.max(...data.dayCounts, 1);
  const maxNeed = Math.max(...data.needs.map(item => item.count), 1);
  return `
    <section class="pattern-v3-intro"><span>Overview</span><h2 class="serif">Your emotional rhythm, gently mapped.</h2><p>Calculated from saved check-ins. No AI interpretation is used here.</p></section>
    <div class="pattern-v3-stats">${patternMetricV3('Current streak', data.currentStreak, 'days')}${patternMetricV3('Longest streak', data.longest, 'days')}${patternMetricV3('Entries', data.records.length, 'saved')}${patternMetricV3('Vocabulary', data.uniqueEmotions, 'emotion words')}</div>
    <article class="pattern-v3-card"><div class="pattern-v3-heading"><span>Emotional Landscape</span><small>average balance</small></div><div class="pattern-v3-landscape">${data.dimensions.map(dimension => `<div class="pattern-v3-axis"><div><span>${dimension.left}</span><span>${dimension.right}</span></div><div class="pattern-v3-track ${dimension.key}"><i style="left:${dimension.value}%"></i></div></div>`).join('')}</div></article>
    <article class="pattern-v3-card"><div class="pattern-v3-heading"><span>Top Emotions</span><small>most recorded</small></div><div class="pattern-v3-emotions">${data.topEmotions.length ? data.topEmotions.map(([name, count]) => `<div><strong class="serif">${escapeHTML(name)}</strong><span>${count} ${count === 1 ? 'entry' : 'entries'}</span></div>`).join('') : '<p class="pattern-v3-empty-copy">Your emotion vocabulary will appear after your first check-in.</p>'}</div></article>
    <article class="pattern-v3-card"><div class="pattern-v3-heading"><span>Emotional Needs</span><small>signals, not conclusions</small></div><div class="pattern-v3-needs">${data.needs.map(item => `<div><span>${item.name}</span><i><b style="width:${Math.max(8, item.count / maxNeed * 100)}%"></b></i><small>${item.count}</small></div>`).join('')}</div></article>
    <article class="pattern-v3-card"><div class="pattern-v3-heading"><span>Check-in Habits</span><small>weekly rhythm</small></div><div class="pattern-v3-week">${['S','M','T','W','T','F','S'].map((day, index) => `<div><i style="height:${Math.max(8, data.dayCounts[index] / maxDay * 64)}px"></i><span>${day}</span></div>`).join('')}</div><div class="pattern-v3-periods">${Object.entries(data.periods).map(([name, count]) => `<span>${name}<strong>${count}</strong></span>`).join('')}</div></article>
    <article class="pattern-v3-card"><div class="pattern-v3-heading"><span>Topic Clusters</span><small>keyword grouping</small></div><div class="pattern-v3-topics">${data.topicClusters.length ? data.topicClusters.map(topic => `<div><strong>${escapeHTML(topic.title)}</strong><span>${topic.count || 1} ${topic.count === 1 ? 'entry' : 'entries'}</span></div>`).join('') : '<p class="pattern-v3-empty-copy">Recurring topics will appear as your history grows.</p>'}</div></article>
    <article class="pattern-v3-card pattern-v3-vocab"><div><span>Vocabulary Growth</span><strong class="serif">${data.uniqueEmotions}</strong><small>unique emotion words used</small></div><p>${data.uniqueEmotions < 3 ? 'Keep naming what you notice. Precision grows through small check-ins.' : 'Your emotional vocabulary is becoming more specific over time.'}</p></article>`;
}

function classifyPatternPacksV3(summary, fallback) {
  const classification = summary?.classification || {};
  const has = (key, pattern) => (fallback[key] || []).some(item => pattern.test(String(item.title || '')));
  return {
    thinking: classification.thinking_pattern || (has('cognitivePatterns', /perfection/i) ? 'perfectionism' : has('cognitivePatterns', /self.?doubt|self.?critic/i) ? 'self_doubt' : has('cognitivePatterns', /worry|catastroph/i) ? 'future_worry' : 'rumination'),
    relationship: classification.relationship_pattern || (has('relationshipPatterns', /boundary/i) ? 'boundary_fatigue' : has('relationshipPatterns', /pleas|approval/i) ? 'people_pleasing' : 'post_conflict'),
    strength: classification.strength_pattern || (has('protectiveFactors', /observer|awareness/i) ? 'observer' : has('protectiveFactors', /curiosity|seeker/i) ? 'seeker' : 'pillar'),
    growth: classification.growth_pattern || (has('psychologicalNeeds', /boundary|autonomy/i) ? 'boundary_building' : has('protectiveFactors', /awareness/i) ? 'emotional_awareness' : 'self_compassion')
  };
}

function getPatternPackV3(type, id) {
  const group = PATTERN_PACK_LIBRARY[type];
  return group.packs[id] || group.packs[group.defaultId];
}

function renderPatternsDeeperV3(records, summary) {
  const signature = records.map(record => `${record.date}|${record.time}|${record.planet?.emotion || ''}|${record.story || ''}`).join('~');
  const pending = !summary || summary.signature !== signature;
  const insights = pending ? buildPatternFallbackV3(records) : (summary.insights || buildPatternFallbackV3(records));
  const classification = classifyPatternPacksV3(summary, insights);
  const packs = ['thinking', 'relationship', 'strength', 'growth'].map(type => ({ type, id: classification[type], pack: getPatternPackV3(type, classification[type]) }));
  const remaining = Math.max(0, 5 - records.length);
  const sourceLabel = pending ? 'Refreshing local preview' : summary.source === 'ai' ? 'AI-assisted insight' : 'On-device pattern preview';
  const statusCopy = remaining
    ? `The template is ready now. Complete ${remaining} more ${remaining === 1 ? 'check-in' : 'check-ins'} for stronger signals.`
    : pending ? 'Local signals are visible while Aemona gently refreshes the wording.' : 'These are gentle hypotheses to reflect on, never fixed truths about you.';
  const evidence = summary?.recentEvidence || insights.recurringTopics?.map(item => item.evidence).filter(Boolean).slice(0, 2).join(' ') || 'Your saved entries are beginning to reveal a few recurring emotional signals.';
  return `<section class="pattern-v3-insight-hero ${pending ? 'is-refreshing' : ''}"><div><span>${sourceLabel}</span><small>Library-based · non-diagnostic</small></div><h2 class="serif">Your current pattern packs.</h2><p>${statusCopy}</p></section><div class="pattern-pack-grid">${packs.map(({ type, id, pack }) => `<button class="pattern-pack-card ${type}" type="button" onclick="openPatternPackV3('${type}','${id}')"><span>${escapeHTML(pack.label)}</span><h3 class="serif">${escapeHTML(pack.title)}</h3><p>${escapeHTML(pack.summary)}</p><small>Open pattern</small></button>`).join('')}</div><article class="pattern-v3-evidence"><span>Recent Evidence</span><p>${escapeHTML(evidence)}</p></article><article class="pattern-v3-reflect"><span>Reflection Prompt</span><p class="serif">${escapeHTML(getPatternPackV3('growth', classification.growth).reflection)}</p></article>`;
}

function openPatternPackV3(type, id) {
  const pack = getPatternPackV3(type, id);
  const summary = getData(currentUser).patternSummary;
  const evidence = summary?.recentEvidence || 'This pack was matched from recurring signals in your saved check-ins.';
  const detail = document.getElementById('pattern-pack-detail');
  if (!detail) return;
  detail.className = `pattern-pack-detail ${type}`;
  detail.innerHTML = `<div class="pattern-pack-actions"><button type="button" onclick="go('patterns-page')" aria-label="Close pattern">×</button><span>${escapeHTML(pack.label)}</span></div><header><small>Pattern Library</small><h1 class="serif">${escapeHTML(pack.title)}</h1><p>${escapeHTML(pack.summary)}</p></header><section><h2>Core pattern</h2><p>${escapeHTML(pack.core)}</p></section><section><h2>Recent evidence</h2><p>${escapeHTML(evidence)}</p></section><section><h2>Watch for</h2><p>${escapeHTML(pack.watch)}</p></section><section><h2>Micro actions</h2><ul>${pack.actions.map(action => `<li>${escapeHTML(action)}</li>`).join('')}</ul></section><section class="pattern-pack-reflection"><h2>Reflect</h2><p class="serif">${escapeHTML(pack.reflection)}</p></section>`;
  go('pattern-detail');
}

function renderSettings() {
  const data = getData(currentUser);
  const records = data.records || [];
  const profileName = document.getElementById('settings-profile-name');
  const profileSub = document.getElementById('settings-profile-sub');
  const dataSub = document.getElementById('settings-data-sub');
  if (profileName) profileName.textContent = 'Profile';
  if (profileSub) profileSub.textContent = 'Name, companion, and setup';
  if (dataSub) dataSub.textContent = `${records.length} saved ${records.length === 1 ? 'entry' : 'entries'} on this device`;
  document.documentElement.classList.toggle('reduce-motion', Boolean(data.settings?.reduceMotion));
  document.documentElement.classList.toggle('high-contrast', Boolean(data.settings?.highContrast));
  document.documentElement.classList.toggle('large-text', Boolean(data.settings?.largeText));
  document.documentElement.classList.toggle('disable-italics', Boolean(data.settings?.disableItalics));
  document.documentElement.classList.toggle('calm-tool-motion', Boolean(data.settings?.calmToolMotion));
  document.getElementById('settings-detail')?.classList.remove('show');
}

function openSettingsDetail(section) {
  const panel = document.getElementById('settings-detail');
  if (!panel) return;
  const data = getData(currentUser);
  const records = data.records || [];
  const settings = data.settings || {};
  const details = {
    profile: {
      title: 'Profile',
      body: `
        ${settingsInfoCard('Profile', 'Keep the app feeling personal and consistent across setup, Explore, and Patterns.')}
        ${settingsReadout('Display name', data.profileName || 'Aemona profile')}
        ${settingsReadout('Companion', companionName(data.companion))}
        ${settingsReadout('Setup result', data.sp?.label || 'Not set yet')}
        ${settingsToggle('saveSetupMemory', 'Remember setup choices', 'Use your setup answers to keep Explore and follow-up questions consistent.', settings.saveSetupMemory !== false)}`
    },
    security: {
      title: 'Security & data',
      body: `
        ${settingsDetailSection('Verification')}
        ${settingsInfoCard('Private by default', 'Aemona keeps this prototype profile on your current device unless you export it.')}
        ${settingsToggle('appLock', 'Passcode / device lock', 'Require your device unlock before opening saved entries.', Boolean(settings.appLock))}
        ${settingsDetailSection('Data')}
        ${settingsToggle('localBackups', 'Local backup reminders', 'Occasionally remind you to export during long-term testing.', settings.localBackups !== false)}
        ${settingsActionRow('Download my data', `${records.length} saved entries`, 'exportAemonaData()')}
        ${settingsActionRow('Import data', 'Restore an exported Aemona JSON file', 'openAemonaImport()')}
        <input id="settings-import-file" type="file" accept="application/json" hidden onchange="importAemonaData(this)">
        <button class="settings-danger-action" type="button" onclick="deleteAemonaData()">Delete all my data</button>
        <p class="settings-danger-note">This removes entries and pattern history from this browser. This cannot be undone.</p>`
    },
    notifications: {
      title: 'Notifications',
      body: `
        ${settingsInfoCard('Motivation reminders', 'Choose how present Aemona should be during the day. Your setup reminder times stay saved locally.')}
        ${settingsToggle('notifications', 'Enable reminders', 'Receive your selected morning, day, and evening reminders.', settings.notifications !== false)}
        ${settingsToggle('quietReminders', 'Quiet wording', 'Keep reminder text soft and low-pressure.', settings.quietReminders !== false)}
        ${settingsToggle('streakNudges', 'Streak nudges', 'Mention streaks only when they feel encouraging.', Boolean(settings.streakNudges))}`
    },
    accessibility: {
      title: 'Accessibility',
      body: `
        ${settingsInfoCard('Comfort controls', 'Adjust motion and reading comfort without changing the core Aemona experience.')}
        ${settingsToggle('reduceMotion', 'Reduce animation motion', 'Use calmer transitions throughout Aemona.', Boolean(settings.reduceMotion))}
        ${settingsToggle('turnOffHaptics', 'Turn off haptics', 'Avoid vibration feedback during selections.', Boolean(settings.turnOffHaptics))}
        ${settingsToggle('calmToolMotion', 'Turn off tools animations', 'Keep regulation tools visually still.', Boolean(settings.calmToolMotion))}
        ${settingsToggle('disableItalics', 'Turn off italic text blocks', 'Use upright type for reflective copy.', Boolean(settings.disableItalics))}
        ${settingsToggle('highContrast', 'Stronger contrast', 'Deepen purple text and controls for readability.', Boolean(settings.highContrast))}
        ${settingsToggle('largeText', 'Larger text', 'Give body copy a little more room.', Boolean(settings.largeText))}`
    },
    language: {
      title: 'Language',
      body: `
        ${settingsInfoCard('Language', 'Language settings are prepared for the prototype; full translation can be connected later.')}
        ${settingsChoice('App language', 'English')}
        ${settingsChoice('Emotion definitions', 'English')}
        ${settingsChoice('Tone', 'Gentle and reflective')}`
    },
    explore: {
      title: 'Explore preferences',
      body: `
        ${settingsInfoCard('Explore', 'Shape what appears first when you open Aemona.')}
        ${settingsToggle('personalizedExplore', 'Personalized recommendations', 'Use your saved entries to shape Explore suggestions.', settings.personalizedExplore !== false)}
        ${settingsToggle('showEmotionLibrary', 'Show Emotion Library', 'Keep emotion definitions visible on Explore.', settings.showEmotionLibrary !== false)}
        ${settingsToggle('showQuietQuestions', 'Show Quiet Questions', 'Include reflective prompts in Explore.', settings.showQuietQuestions !== false)}`
    },
    tools: {
      title: 'Tools preferences',
      body: `
        ${settingsInfoCard('Tools', 'Tune how tools are suggested after check-ins and entries.')}
        ${settingsToggle('gentleNudges', 'Gentle tool suggestions', 'Suggest tools that may fit your recent entries.', settings.gentleNudges !== false)}
        ${settingsToggle('rememberToolUse', 'Remember useful tools', 'Let Aemona prioritize tools you return to.', settings.rememberToolUse !== false)}
        ${settingsToggle('skipIntenseTools', 'Avoid intense tools first', 'Start with lighter exercises unless you choose otherwise.', settings.skipIntenseTools !== false)}`
    },
    ai: {
      title: 'AI settings',
      body: `
        ${settingsToggle('aiEnabled', 'Enable AI features', 'Use AI for Unpack follow-up questions and emotional language suggestions.', settings.aiEnabled !== false)}
        ${settingsInfoCard('Your control', 'Turning AI off keeps Note it, Entries, Patterns, and local tools available.')}
        ${settingsToggle('deeperQuestions', 'Deeper follow-up questions', 'Allow more reflective follow-up questions during Unpack.', settings.deeperQuestions !== false)}
        ${settingsToggle('shorterResponses', 'Shorter responses', 'Prefer concise answers over long explanations.', Boolean(settings.shorterResponses))}
        ${settingsToggle('useEmotionListOnly', 'Use approved emotion list', 'Keep emotion labels inside the Aemona emotion list.', settings.useEmotionListOnly !== false)}`
    },
    hotlines: {
      title: 'Mental health hotlines',
      body: `
        ${settingsInfoCard('Immediate support', 'Aemona is not a crisis service. If you may be in immediate danger, contact local emergency services.')}
        ${settingsDetailSection('Immediate help via phone')}
        ${settingsLinkCard('Call 988', 'tel:988')}
        ${settingsLinkCard('Call emergency services (911)', 'tel:911')}
        ${settingsDetailSection('Immediate help via text')}
        ${settingsLinkCard('Text 988', 'sms:988')}
        ${settingsDetailSection('Outside the United States')}
        ${settingsInfoCard('Use local crisis resources', 'Call your local emergency number or a trusted regional crisis line. Hotline availability varies by location.')}`
    },
    faq: {
      title: 'FAQ',
      body: `
        ${settingsInfoCard('Where are entries saved?', 'In this prototype, entries are stored in this browser under the current profile.')}
        ${settingsInfoCard('Will they follow me to another device?', 'Not yet. Export your data before switching devices or browsers.')}
        ${settingsInfoCard('Can I remove data?', 'For now, browser storage controls or a future data tool can clear it. Export first if you need a backup.')}`
    },
    feedback: {
      title: 'Send feedback',
      body: `
        ${settingsInfoCard('Help shape Aemona', 'Tell us what felt useful, confusing, too much, or missing during your test.')}
        <textarea class="settings-feedback" id="settings-feedback-text" placeholder="Write your feedback..."></textarea>
        <button class="settings-action" type="button" onclick="saveSettingsFeedback()">Save feedback locally</button>`
    },
    about: {
      title: 'About Aemona',
      body: `
        ${settingsInfoCard('Aemona beta', 'A quiet place to find words for what you feel, notice patterns, and make space for yourself.')}
        ${settingsActionRow('Learn more', 'Aemona and emotional literacy', "showToast('More about Aemona is coming soon.')")}
        ${settingsActionRow('Terms of service', 'Prototype terms', "showToast('Terms page is being prepared.')")}
        ${settingsActionRow('Privacy policy', 'How local prototype data is handled', "showToast('Privacy page is being prepared.')")}
        ${settingsReadout('Version', 'Beta prototype')}
        ${settingsReadout('Data mode', 'Local browser storage')}`
    }
  };
  const detail = details[section] || details.about;
  panel.innerHTML = `
    <div class="settings-detail-head">
      <button type="button" onclick="closeSettingsDetail()" aria-label="Back"></button>
      <h2 class="serif">${detail.title}</h2>
    </div>
    <div class="settings-detail-body">${detail.body}</div>`;
  panel.classList.add('show');
}

function settingsToggle(key, title, description, checked) {
  return `<label class="settings-toggle-card"><span><strong>${title}</strong><small>${description}</small></span><input type="checkbox" ${checked ? 'checked' : ''} onchange="saveSetting('${key}', this.checked)"><i></i></label>`;
}

function settingsInfoCard(title, description) {
  return `<div class="settings-detail-card"><strong>${title}</strong><p>${description}</p></div>`;
}

function settingsReadout(label, value) {
  return `<div class="settings-readout"><span>${label}</span><strong>${value}</strong></div>`;
}

function settingsChoice(label, value) {
  return `<div class="settings-choice"><span>${label}</span><strong>${value}</strong></div>`;
}

function settingsDetailSection(title) {
  return `<h3 class="settings-detail-section-title">${title}</h3>`;
}

function settingsActionRow(title, description, action) {
  return `<button class="settings-action-row" type="button" onclick="${action}"><span><strong>${title}</strong><small>${description}</small></span><i></i></button>`;
}

function settingsLinkCard(title, href) {
  return `<a class="settings-link-card" href="${href}">${title}</a>`;
}

function companionName(id) {
  const companion = COMPANIONS.find(c => c.id === id);
  return companion ? companion.name : 'Not set yet';
}

function closeSettingsDetail() {
  document.getElementById('settings-detail')?.classList.remove('show');
}

function saveSetting(key, value) {
  const data = getData(currentUser);
  data.settings = { ...(data.settings || {}), [key]: value };
  saveData(currentUser, data);
  if (key === 'reduceMotion') document.documentElement.classList.toggle('reduce-motion', value);
  if (key === 'highContrast') document.documentElement.classList.toggle('high-contrast', value);
  if (key === 'largeText') document.documentElement.classList.toggle('large-text', value);
  if (key === 'disableItalics') document.documentElement.classList.toggle('disable-italics', value);
  if (key === 'calmToolMotion') document.documentElement.classList.toggle('calm-tool-motion', value);
}

function saveSettingsFeedback() {
  const value = document.getElementById('settings-feedback-text')?.value.trim();
  if (!value) return;
  const data = getData(currentUser);
  data.feedback = [...(data.feedback || []), { text: value, date: new Date().toISOString() }];
  saveData(currentUser, data);
  closeSettingsDetail();
}

function exportAemonaData() {
  const payload = {
    exportedAt: new Date().toISOString(),
    profile: currentUser,
    data: getData(currentUser)
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `aemona-${currentUser}-${new Date().toISOString().slice(0, 10)}.json`;
  link.click();
  URL.revokeObjectURL(url);
}

function openAemonaImport() {
  document.getElementById('settings-import-file')?.click();
}

function importAemonaData(input) {
  const file = input?.files?.[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const payload = JSON.parse(reader.result);
      const incoming = payload.data || payload;
      if (!Array.isArray(incoming.records)) throw new Error('No records found');
      saveData(currentUser, { ...getData(currentUser), ...incoming });
      showToast('Aemona data imported.');
      openSettingsDetail('security');
    } catch (error) {
      showToast(`Import failed: ${error.message}`);
    }
  };
  reader.readAsText(file);
}

function deleteAemonaData() {
  if (!confirm('Delete all entries and pattern history from this browser?')) return;
  const current = getData(currentUser);
  saveData(currentUser, { ...current, records: [], cover: {}, patternSummary: null });
  showToast('Entries and pattern history deleted.');
  openSettingsDetail('security');
}


// ── REGULATION: DRAG ──────────────────────────────────────────
const BREATHING_METHODS = {
  sigh: { title: 'Physiological Sigh', description: 'A quick reset for moments of stress, tension, or overwhelm.', note: 'In 2 · Sip 1 · Out 6', phases: [['Breathe in', 2, 'inhale'], ['Small sip in', 1, 'inhale'], ['Long breath out', 6, 'exhale']] },
  box: { title: 'Box Breathing', description: 'Slow down your nervous system through a simple rhythmic pattern.', note: 'In 4 · Hold 4 · Out 4 · Hold 4', phases: [['Breathe in', 4, 'inhale'], ['Hold softly', 4, 'hold'], ['Breathe out', 4, 'exhale'], ['Rest here', 4, 'hold']] },
  relax: { title: '4-7-8 Breathing', description: 'Release tension and prepare your body for rest.', note: 'In 4 · Hold 7 · Out 8', phases: [['Breathe in', 4, 'inhale'], ['Hold softly', 7, 'hold'], ['Breathe out', 8, 'exhale']] },
  coherent: { title: 'Coherent Breathing', description: 'Find a steady rhythm that supports calm and emotional balance.', note: 'In 5 · Out 5', phases: [['Breathe in', 5, 'inhale'], ['Breathe out', 5, 'exhale']] },
  belly: { title: 'Belly Breathing', description: 'Reconnect with your breath and soften physical stress.', note: 'In 4 · Out 6', phases: [['Let your belly rise', 4, 'inhale'], ['Let it soften', 6, 'exhale']] }
};

let activeToolCategory = '';

const TOOL_CATEGORY_DETAILS = {
  breathing: 'Exercises to center your mind, soften physical stress, and return to a steadier rhythm.',
  expression: 'Creative practices for moving feelings out of your head and into color, voice, and words.',
  grounding: 'Simple sensory practices that help you reconnect with your body and the space around you.',
  connection: 'Small ways to offer yourself kindness and create a steadier sense of support.',
  interactive: 'Lightweight responsive experiences that help pressure shift without needing to explain it.'
};

function renderToolsPage() {
  const root = document.getElementById('tools-categories');
  if (!root) return;
  root.innerHTML = TOOL_SECTIONS.map(section => `
    <button class="tool-library-card tool-library-${section.id}" type="button" data-tool-search="${escapeAttr([section.title, section.subtitle, ...section.items.flatMap(item => [item[0], item[1]])].join(' ').toLowerCase())}" onclick="openToolCategory('${section.id}')">
      <span class="tool-library-pattern" aria-hidden="true"></span>
      <strong class="serif">${section.title}</strong>
      <small>${section.items.length} ${section.items.length === 1 ? 'practice' : 'practices'}</small>
    </button>`).join('');
  const search = document.getElementById('tools-search-input');
  if (search?.value) filterTools(search.value);
}

function toggleToolsSearch() {
  const wrap = document.getElementById('tools-search-wrap');
  const input = document.getElementById('tools-search-input');
  if (!wrap || !input) return;
  if (wrap.classList.contains('open')) {
    if (input.value) {
      input.value = '';
      filterTools('');
      input.focus();
    } else {
      closeToolsSearch();
    }
    return;
  }
  wrap.classList.add('open');
  requestAnimationFrame(() => input.focus());
}

function closeToolsSearch() {
  const wrap = document.getElementById('tools-search-wrap');
  const input = document.getElementById('tools-search-input');
  if (!wrap || !input) return;
  input.value = '';
  filterTools('');
  wrap.classList.remove('open');
  input.blur();
}

function filterTools(value) {
  const query = String(value || '').trim().toLowerCase();
  const cards = [...document.querySelectorAll('#tools-categories .tool-library-card')];
  let visible = 0;
  cards.forEach(card => {
    const match = !query || card.dataset.toolSearch?.includes(query);
    card.hidden = !match;
    if (match) visible += 1;
  });
  const status = document.getElementById('tools-search-status');
  if (status) status.textContent = query ? (visible ? `${visible} matching ${visible === 1 ? 'category' : 'categories'}` : 'No matching practices yet.') : '';
}

function toolPracticeVisual(tone) {
  return `<span class="tool-practice-art tool-art-${tone}" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i></span>`;
}

function openToolCategory(id) {
  const section = TOOL_SECTIONS.find(item => item.id === id);
  const grid = document.getElementById('tool-category-detail-grid');
  if (!section || !grid) return;
  activeToolCategory = id;
  document.getElementById('tool-category-detail-kicker').textContent = `${section.items.length} gentle practices`;
  document.getElementById('tool-category-detail-title').textContent = section.title;
  document.getElementById('tool-category-detail-desc').textContent = TOOL_CATEGORY_DETAILS[id] || section.subtitle;
  grid.className = `tool-category-detail-grid tool-category-detail-${id}`;
  grid.innerHTML = section.items.map(item => `
    <button class="tool-practice-card tool-practice-${item[3]}" type="button" onclick="${item[2]}">
      ${toolPracticeVisual(item[3])}
      <strong class="serif">${item[0]}</strong>
      <small>${item[1]}</small>
    </button>`).join('');
  go('tool-category-page');
}

function returnToToolCategory() {
  clearInterval(window.aemonaRegulationTimer);
  if (activeToolCategory) openToolCategory(activeToolCategory);
  else go('tools-page');
}

function openInteractiveTool(title, description, path) {
  const frame = document.getElementById('tool-experience-frame');
  if (!frame) return;
  frame.title = title;
  frame.src = `assets/ToolsSection/aemona-tools/${path}?v=20260612-1`;
  frame.onload = () => {
    try {
      const doc = frame.contentDocument;
      doc.querySelectorAll('.back-home').forEach(node => node.remove());
    } catch (_) {}
  };
  go('tool-experience');
}

function openStandaloneTool(path) {
  const url = new URL(`assets/ToolsSection/aemona-tools/${path}?v=20260612-1`, window.location.href);
  const opened = window.open(url.href, '_blank', 'noopener,noreferrer');
  if (!opened) window.location.href = url.href;
}

function closeToolExperience() {
  const frame = document.getElementById('tool-experience-frame');
  if (frame) frame.src = 'about:blank';
  returnToToolCategory();
}

const NATIVE_TOOLS = {
  guided: { title: 'Guided Reflection', intro: 'Move slowly. There is no correct answer.', prompts: ['What feels most present right now?', 'What might this feeling be protecting?', 'What do you need a little more of?'] },
  mapping: { title: 'Thought Mapping', intro: 'Place the central thought, then add what connects to it.', prompts: ['The thought at the center is…', 'What seems connected to it?', 'What part is fact, and what part is fear?'] },
  perspective: { title: 'Perspective Questions', intro: 'Try a gentler angle without dismissing what happened.', prompts: ['What would you say to a friend here?', 'What else could be true at the same time?', 'What is within your control today?'] },
  pattern: { title: 'Pattern Explorer', intro: 'Notice one recurring thread without judging it.', prompts: ['When does this usually appear?', 'What tends to happen just before it?', 'What response would you like to try next time?'] },
  compassion: { title: 'Self-Compassion', intro: 'Write to yourself as someone worth caring for.', prompts: ['This is difficult because…', 'It makes sense that I feel…', 'One kind thing I can offer myself is…'] },
  gratitude: { title: 'Gratitude Pause', intro: 'Notice support without forcing positivity.', prompts: ['Something that made today easier…', 'Someone or something quietly supporting me…', 'A small moment I want to remember…'] },
  comfort: { title: 'Comfort List', intro: 'Build a list you can return to when words are hard.', prompts: ['A place that helps me settle…', 'A sound, texture, or smell that comforts me…', 'A small action that helps my body feel safer…'] },
  reach: { title: 'Reach Out', intro: 'Prepare one low-pressure step toward connection.', prompts: ['Who feels safest to contact?', 'What do you want them to know?', 'What is the smallest message you could send?'] }
  ,shapes: { title: 'Emotion Shapes', intro: 'Let the feeling become form before it becomes language.', prompts: ['If this feeling had a shape, it would be…', 'Its edges feel…', 'The color or movement it carries is…'] }
  ,tinycare: { title: 'Tiny Acts of Care', intro: 'Choose something small enough to be possible today.', prompts: ['What does your body need in the next ten minutes?', 'What task could become a little easier?', 'One kind action you can actually do today…'] }
  ,senses: { kind: 'senses', title: 'Five Senses Reset', intro: 'Move through the senses at your own pace. Tap each item as you notice it.' }
  ,tension: { kind: 'tension', title: 'Tension Scan', intro: 'Choose where tension is showing up, then notice its intensity without trying to fix it.' }
  ,needs: { kind: 'needs', title: 'Need Translator', intro: 'A reaction can be a signal. Explore what it may be asking for.' }
  ,boundary: { kind: 'boundary', title: 'Boundary Builder', intro: 'Build a sentence that is clear, kind, and usable.' }
};

const REGULATION_TOOLS = {
  senses: { title: 'Five Senses Reset', intro: 'Tap through five simple anchors around you.', kind: 'senses' },
  orient: { title: 'Orienting Light', intro: 'Let your eyes follow the light slowly from side to side.', kind: 'orient' },
  bilateral: { title: 'Bilateral Rhythm', intro: 'Follow the alternating pulse. Tap along if it feels comfortable.', kind: 'bilateral' },
  release: { title: 'Muscle Release', intro: 'Gently tense, then soften. Never push into pain.', kind: 'release' },
  minute: { title: 'One Minute Reset', intro: 'Nothing to solve for one minute. Just stay here.', kind: 'minute' },
  kindvoice: { title: 'Kind Voice', intro: 'Choose one gentle phrase and let it repeat slowly.', kind: 'kindvoice' },
  warmth: { title: 'Warmth Hold', intro: 'Press and hold the glow. Let it become a steady point of warmth.', kind: 'warmth' }
};

function openRegulationTool(id) {
  const tool = REGULATION_TOOLS[id];
  const root = document.getElementById('native-tool-body');
  if (!tool || !root) return;
  root.innerHTML = renderRegulationTool(id, tool);
  go('native-tool');
  startRegulationTool(id);
}

function renderRegulationTool(id, tool) {
  const head = `<div class="native-tool-kicker">Regulation</div><h1 class="serif">${tool.title}</h1><p class="native-tool-intro">${tool.intro}</p>`;
  if (id === 'senses') return `${head}<div class="reg-senses">${['Notice one color', 'Feel one surface', 'Listen for one sound', 'Notice the air', 'Take one slow breath'].map((text, i) => `<button type="button" onclick="this.classList.toggle('done')"><b>${i + 1}</b><span>${text}</span><i></i></button>`).join('')}</div>`;
  if (id === 'orient') return `${head}<div class="reg-orient"><i></i><span>Follow without moving your head too much</span></div>`;
  if (id === 'bilateral') return `${head}<div class="reg-bilateral"><button type="button" aria-label="Left pulse"></button><button type="button" aria-label="Right pulse"></button></div><button class="reg-speed" type="button" onclick="cycleRegulationSpeed(this)">Slow rhythm</button>`;
  if (id === 'release') return `${head}<div class="reg-release"><div class="reg-release-orb"></div><strong id="release-label">Gently tense your shoulders</strong><span id="release-count">4</span></div>`;
  if (id === 'minute') return `${head}<div class="reg-minute"><svg viewBox="0 0 120 120"><circle cx="60" cy="60" r="52"></circle><circle class="reg-minute-progress" cx="60" cy="60" r="52"></circle></svg><strong id="minute-count">60</strong><span>seconds</span></div>`;
  if (id === 'kindvoice') return `${head}<div class="kind-voice-phrases">${['I can take this one moment at a time.', 'I do not need to solve everything now.', 'My feelings can move without rushing.'].map(text => `<button type="button" onclick="selectKindPhrase(this)">${text}</button>`).join('')}</div><div class="kind-voice-output serif" id="kind-voice-output">Choose a phrase to hold.</div>`;
  return `${head}<button class="warmth-hold" type="button"><span>Press and hold</span></button>`;
}

function startRegulationTool(id) {
  clearInterval(window.aemonaRegulationTimer);
  if (id === 'release') {
    let tense = true, count = 4;
    window.aemonaRegulationTimer = setInterval(() => {
      count -= 1;
      if (count <= 0) { tense = !tense; count = tense ? 4 : 7; document.getElementById('release-label').textContent = tense ? 'Gently tense your shoulders' : 'Let everything soften'; document.querySelector('.reg-release')?.classList.toggle('soften', !tense); }
      const el = document.getElementById('release-count'); if (el) el.textContent = count;
    }, 1000);
  }
  if (id === 'minute') {
    let count = 60;
    window.aemonaRegulationTimer = setInterval(() => { count -= 1; const el = document.getElementById('minute-count'); if (el) el.textContent = Math.max(count, 0); if (count <= 0) clearInterval(window.aemonaRegulationTimer); }, 1000);
  }
}

function cycleRegulationSpeed(button) {
  const area = document.querySelector('.reg-bilateral');
  const fast = area?.classList.toggle('faster');
  button.textContent = fast ? 'Steady rhythm' : 'Slow rhythm';
}
function selectKindPhrase(button) {
  button.parentElement.querySelectorAll('button').forEach(item => item.classList.remove('selected'));
  button.classList.add('selected');
  document.getElementById('kind-voice-output').textContent = button.textContent;
}

function openNativeTool(id) {
  const tool = NATIVE_TOOLS[id];
  const root = document.getElementById('native-tool-body');
  if (!tool || !root) return;
  if (tool.kind) {
    root.innerHTML = renderSpecialNativeTool(id, tool);
    go('native-tool');
    return;
  }
  root.innerHTML = `
    <div class="native-tool-kicker">Aemona practice</div>
    <h1 class="serif">${tool.title}</h1>
    <p class="native-tool-intro">${tool.intro}</p>
    <div class="native-prompt-stack">
      ${tool.prompts.map((prompt, index) => `
        <label class="native-prompt-card">
          <span>${index + 1}</span><strong>${prompt}</strong>
          <textarea placeholder="Write only what feels useful…"></textarea>
        </label>`).join('')}
    </div>
    <button class="native-tool-finish" type="button" onclick="finishNativeTool('${id}')">Keep this reflection</button>`;
  go('native-tool');
}

function renderSpecialNativeTool(id, tool) {
  const head = `<div class="native-tool-kicker">Aemona practice</div><h1 class="serif">${tool.title}</h1><p class="native-tool-intro">${tool.intro}</p>`;
  if (tool.kind === 'senses') {
    const senses = [['5', 'things you can see'], ['4', 'things you can feel'], ['3', 'things you can hear'], ['2', 'things you can smell'], ['1', 'thing you can taste']];
    return `${head}<div class="sense-reset-list">${senses.map(([count, label]) => `<button type="button" onclick="toggleNativeChoice(this)"><b>${count}</b><span>${label}</span><i></i></button>`).join('')}</div><button class="native-tool-finish" type="button" onclick="finishSpecialTool('${id}')">Finish gently</button>`;
  }
  if (tool.kind === 'tension') {
    const areas = ['Jaw', 'Shoulders', 'Chest', 'Stomach', 'Hands', 'Back', 'Legs', 'Somewhere else'];
    return `${head}<div class="body-area-grid">${areas.map(area => `<button type="button" onclick="selectOneNativeChoice(this)">${area}</button>`).join('')}</div><div class="tension-meter"><label>How strong does it feel?<strong id="tension-value">5</strong></label><input type="range" min="1" max="10" value="5" oninput="document.getElementById('tension-value').textContent=this.value"><div><span>Soft</span><span>Strong</span></div></div><button class="native-tool-finish" type="button" onclick="finishSpecialTool('${id}')">Keep this observation</button>`;
  }
  if (tool.kind === 'needs') {
    const reactions = ['I want to withdraw', 'I feel irritated', 'I cannot stop thinking', 'I feel numb', 'I want reassurance', 'Everything feels too much'];
    const needs = ['Rest', 'Safety', 'Space', 'Clarity', 'Connection', 'Choice', 'Recognition', 'Support'];
    return `${head}<div class="native-special-label">What feels closest?</div><div class="native-chip-grid">${reactions.map(item => `<button type="button" onclick="selectOneNativeChoice(this);updateNeedTranslation()">${item}</button>`).join('')}</div><div class="native-special-label">A possible need underneath</div><div class="native-chip-grid native-needs-grid">${needs.map(item => `<button type="button" onclick="toggleNativeChoice(this);updateNeedTranslation()">${item}</button>`).join('')}</div><div class="need-translation serif" id="need-translation">Your reaction may be asking for something important.</div><button class="native-tool-finish" type="button" onclick="finishSpecialTool('${id}')">Keep this translation</button>`;
  }
  const openings = ['I need', 'I am not able to', 'I would feel better if'];
  const actions = ['more time before answering', 'some space right now', 'to finish this conversation later', 'clearer communication', 'support without advice'];
  const closings = ['Thank you for understanding.', 'I will reach out when I am ready.', 'This matters to me.', 'I hope we can try again gently.'];
  return `${head}<div class="boundary-builder">${boundaryChoiceRow('Start with', openings, 'boundary-opening')}${boundaryChoiceRow('What you need', actions, 'boundary-action')}${boundaryChoiceRow('Close gently', closings, 'boundary-closing')}<div class="boundary-output serif" id="boundary-output">Choose one piece from each row.</div></div><button class="native-tool-finish" type="button" onclick="finishSpecialTool('${id}')">Keep this boundary</button>`;
}

function boundaryChoiceRow(label, items, group) {
  return `<div class="native-special-label">${label}</div><div class="native-chip-grid ${group}">${items.map(item => `<button type="button" onclick="selectOneNativeChoice(this);updateBoundaryOutput()">${item}</button>`).join('')}</div>`;
}

function toggleNativeChoice(button) { button?.classList.toggle('selected'); }
function selectOneNativeChoice(button) {
  button?.parentElement?.querySelectorAll('button').forEach(item => item.classList.remove('selected'));
  button?.classList.add('selected');
}
function updateNeedTranslation() {
  const reaction = document.querySelector('#native-tool-body .native-chip-grid:not(.native-needs-grid) .selected')?.textContent;
  const needs = [...document.querySelectorAll('#native-tool-body .native-needs-grid .selected')].map(item => item.textContent);
  const output = document.getElementById('need-translation');
  if (output) output.textContent = reaction && needs.length ? `${reaction} may be asking for ${needs.join(' and ').toLowerCase()}.` : 'Your reaction may be asking for something important.';
}
function updateBoundaryOutput() {
  const parts = ['boundary-opening', 'boundary-action', 'boundary-closing'].map(cls => document.querySelector(`.${cls} .selected`)?.textContent);
  const output = document.getElementById('boundary-output');
  if (output) output.textContent = parts.filter(Boolean).join(' ') || 'Choose one piece from each row.';
}
function finishSpecialTool(id) {
  const selected = [...document.querySelectorAll('#native-tool-body .selected')].map(item => item.textContent);
  const range = document.querySelector('#native-tool-body input[type="range"]')?.value;
  const output = document.querySelector('#native-tool-body .boundary-output, #native-tool-body .need-translation')?.textContent;
  localStorage.setItem(`aemona_tool_${id}`, JSON.stringify({ savedAt: new Date().toISOString(), selected, range, output }));
  showToast('Saved gently on this device.');
  returnToToolCategory();
}

function finishNativeTool(id) {
  const values = [...document.querySelectorAll('#native-tool-body textarea')].map(el => el.value.trim()).filter(Boolean);
  localStorage.setItem(`aemona_tool_${id}`, JSON.stringify({ savedAt: new Date().toISOString(), values }));
  showToast('Saved gently on this device.');
  returnToToolCategory();
}

let activeBreathMethod = 'box';
let breathPhaseIndex = 0;
let breathSecondsLeft = 4;
let breathPaused = false;

function openBreathingTool(method) {
  activeBreathMethod = BREATHING_METHODS[method] ? method : 'box';
  breathPhaseIndex = 0;
  breathPaused = false;
  go('reg-breath');
}

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
  stopBreath();
  const method = BREATHING_METHODS[activeBreathMethod] || BREATHING_METHODS.box;
  document.getElementById('breath-title').textContent = method.title;
  document.getElementById('breath-description').textContent = method.description;
  document.getElementById('breath-note').textContent = method.note;
  document.getElementById('breath-toggle').textContent = 'Pause';
  renderBreathVisual();
  setBreathPhase();
  breathTimer = setInterval(() => {
    if (breathPaused) return;
    breathSecondsLeft -= 1;
    if (breathSecondsLeft <= 0) {
      breathPhaseIndex = (breathPhaseIndex + 1) % method.phases.length;
      setBreathPhase();
    } else {
      document.getElementById('breath-count').textContent = breathSecondsLeft;
    }
  }, 1000);
}
function setBreathPhase() {
  const method = BREATHING_METHODS[activeBreathMethod] || BREATHING_METHODS.box;
  const [label, duration, state] = method.phases[breathPhaseIndex];
  breathSecondsLeft = duration;
  document.getElementById('breath-label').textContent = label;
  document.getElementById('breath-count').textContent = duration;
  const stage = document.getElementById('breath-stage');
  stage.classList.remove('inhale', 'exhale', 'hold');
  void stage.offsetWidth;
  stage.style.setProperty('--breath-duration', `${duration}s`);
  stage.classList.add(state);
}
function renderBreathVisual() {
  const root = document.getElementById('breath-visual');
  const stage = document.getElementById('breath-stage');
  if (!root || !stage) return;
  stage.className = `breath-stage breath-style-${activeBreathMethod}`;
  if (activeBreathMethod === 'sigh') {
    root.innerHTML = `<div class="sigh-stream sigh-stream-one">${Array.from({length:8},()=>'<i></i>').join('')}</div><div class="sigh-stream sigh-stream-two">${Array.from({length:8},()=>'<i></i>').join('')}</div><div class="sigh-release"></div>`;
  } else if (activeBreathMethod === 'box') {
    root.innerHTML = `<div class="box-path"><i></i><b></b><span></span><em></em><strong></strong></div>`;
  } else if (activeBreathMethod === 'relax') {
    root.innerHTML = `<div class="breath-flower">${Array.from({length:8},(_,i)=>`<i style="--petal:${i * 45}deg"></i>`).join('')}<b></b></div><div class="flower-rings"><i></i><i></i><i></i></div>`;
  } else if (activeBreathMethod === 'coherent') {
    root.innerHTML = `<div class="tide-scene"><i></i><i></i><i></i><span></span></div>`;
  } else {
    root.innerHTML = `<div class="belly-figure"><i class="belly-head"></i><i class="belly-body"></i><i class="belly-wave"></i><span></span></div>`;
  }
}
function toggleBreathSession() {
  breathPaused = !breathPaused;
  document.getElementById('breath-toggle').textContent = breathPaused ? 'Continue' : 'Pause';
  document.getElementById('breath-stage').classList.toggle('paused', breathPaused);
}
function stopBreath() {
  if (breathTimer) { clearInterval(breathTimer); breathTimer = null; }
  breathPaused = false;
}


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
