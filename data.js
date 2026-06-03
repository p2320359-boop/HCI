// ============================================================
// data.js — Aemona v2 constants
// ============================================================

// ── ONBOARDING GUIDE SLIDES (3 screens before auth) ──────────
const GUIDE_SLIDES = [
  {
    title: "It's not that you won't.",
    sub:   "Emotions become clearer when you learn their language.",
    color: "#e8e0f5"
  },
  {
    title: "You don't have to name it to feel it.",
    sub:   "Aemona meets you where you are — even when that place is just 'off'.",
    color: "#f0e8f8"
  },
  {
    title: "Step into your inner world.",
    sub:   "Let's see what's waiting there.",
    color: "#ede8f5"
  }
];

// ── COMPANIONS (setup step 4/9) ───────────────────────────────
const COMPANIONS = [
  {
    id: "milo",
    name: "Milo",
    emoji: "💧",
    color: "#a8c8e8",
    tagline: "Some feelings don't arrive with answers right away.",
    desc: "Milo reminds you that it's okay to slow down and simply be with what you're feeling."
  },
  {
    id: "avis",
    name: "Avis",
    emoji: "⭐",
    color: "#f0b8d0",
    tagline: "You don't have to be ready to take the next step.",
    desc: "Avis encourages you to trust your own pace, even when things feel uncertain."
  },
  {
    id: "echo",
    name: "Echo",
    emoji: "☁️",
    color: "#c8b8e8",
    tagline: "Sometimes it's hard to explain what's going on inside.",
    desc: "Echo helps you find language for things you've been carrying quietly, even when the words aren't there yet."
  },
  {
    id: "sila",
    name: "Sila",
    emoji: "🟫",
    color: "#d4c4a8",
    tagline: "Not everything has to make sense right now.",
    desc: "Sila supports you in finding the path ahead one small step at a time."
  }
];

// ── SETUP STEP 2: How do you respond to emotions? ────────────
const EMOTION_RESPONSE_OPTIONS = [
  { id: "understand", emoji: "🌦", label: "Try to understand it" },
  { id: "sitwith",    emoji: "💧", label: "Sit with it for a while" },
  { id: "busy",       emoji: "🚀", label: "Keep moving and stay busy" },
  { id: "reachout",   emoji: "✨", label: "Reach out to someone" }
];

// ── SETUP STEP 5: Why are you here? ──────────────────────────
const GOALS_OPTIONS = [
  { id: "g1", label: "I want to feel less overwhelmed by the intensity of what I feel" },
  { id: "g2", label: "I want to understand what triggers my emotional reactions" },
  { id: "g3", label: "I want to put words to my emotions before they build up inside" },
  { id: "g4", label: "I want to bounce back faster from emotionally draining days" },
  { id: "g5", label: "Another reason not listed here" }
];

// ── SETUP STEP 6: What would feel most helpful? ──────────────
const HELPFUL_OPTIONS = [
  { id: "h1", label: "Gentle guidance to help me find the words" },
  { id: "h2", label: "A private space to explore what's inside" },
  { id: "h3", label: "Insights into my emotional patterns over time" },
  { id: "h4", label: "Tools to help me regulate when things feel big" },
  { id: "h5", label: "Another thing not listed here" }
];

// ── EXPLORE QUICK-TAG CATEGORIES ─────────────────────────────
const QUICK_TAGS = {
  about: ["Me", "About something", "To", "About someone", "About myself", "All of everything"],
  duration: ["+", "Just now", "+", "Most of today", "Several days", "Longer than that"],
  space: ["+", "In the background", "Keeps coming back", "Hard to ignore", "It's all I can think about"],
  body: ["+", "Head", "Chest", "Throat", "Stomach", "Legs"]
};

// ── AI FOLLOW-UP QUESTIONS (slider style, companion shown) ───
const FALLBACK_SLIDER_QUESTIONS = [
  {
    q:    "When this feeling shows up… what feels more true?",
    left: "It makes me pull inward",
    right:"It makes me push against something"
  },
  {
    q:    "Right now… how close does it feel to the surface?",
    left: "Buried deep",
    right:"Right at the edge"
  },
  {
    q:    "How long has this been sitting with you?",
    left: "Just arrived",
    right:"Been here a while"
  },
  {
    q:    "In your body… where do you feel it most?",
    left: "Scattered",
    right:"One clear place"
  },
  {
    q:    "Right now… what would help more?",
    left: "Feeling understood",
    right:"Feeling reassured"
  }
];

// ── EMOTIONAL LANDSCAPE DIMENSIONS (result screen) ───────────
const EMOTION_DIMENSIONS = [
  { left: "JOY",      leftEmoji: "✦",  right: "SADNESS",      rightEmoji: "💧", key: "joy_sadness" },
  { left: "TRUST",    leftEmoji: "♥",  right: "DISGUST",      rightEmoji: "⬡",  key: "trust_disgust" },
  { left: "FEAR",     leftEmoji: "●",  right: "ANGER",        rightEmoji: "✸",  key: "fear_anger" },
  { left: "SURPRISE", leftEmoji: "✦",  right: "ANTICIPATION", rightEmoji: "▲",  key: "surprise_anticipation" }
];

// ── TOOLS GRID ────────────────────────────────────────────────
const TOOLS = [
  { id: "tap",     name: "Tap It Out",    desc: "Release the tension, one tap at a time.",      emoji: "👆", page: "reg-clear"  },
  { id: "draw",    name: "Draw the Noise",desc: "Give it a shape, don't need the right words.", emoji: "🎨", page: "reg-drag"   },
  { id: "breath",  name: "Soft Breath",   desc: "Slow your breath, soften your body.",          emoji: "🌬", page: "reg-breath" },
  { id: "badge",   name: "Pocket Badge",  desc: "You did well. Don't forget that.",             emoji: "⭐", page: "reg-badge"  },
  { id: "unsent",  name: "Unsent Note",   desc: "Say it anyway. You don't have to send it.",    emoji: "📝", page: "reg-unsent" },
  { id: "loop",    name: "Burn the Loop", desc: "Let it go. It doesn't need to stay.",          emoji: "🔥", page: "reg-loop"   }
];

// ── STORY PROMPTS shown greyed in textarea ────────────────────
const STORY_PROMPTS = [
  "I can't pinpoint…",
  "Something feels off today.",
  "I can't stop thinking about that conversation…",
  "A lot of small things have been adding up.",
  "I'm not sure why this is affecting me so much…"
];

// ── SENSITIVITY LEVELS ────────────────────────────────────────
const SENS_LEVELS = [
  { min: 1.0, max: 1.8, label: "Grounded",        color: "#51cf66" },
  { min: 1.8, max: 2.6, label: "Balanced",         color: "#74c0fc" },
  { min: 2.6, max: 3.4, label: "Perceptive",       color: "#a9e34b" },
  { min: 3.4, max: 4.2, label: "Sensitive",        color: "#c084fc" },
  { min: 4.2, max: 5.1, label: "Highly Sensitive", color: "#f472b6" }
];

// ── PROFILE DIMENSION LABELS ──────────────────────────────────
const PROFILE_DIMS = [
  "Overwhelm sensitivity", "Pressure sensitivity",
  "Overthinking tendency", "Emotional intensity", "Need for solitude"
];

// ── FALLBACK PLANET (if AI fails) ────────────────────────────
const FALLBACK_PLANET = {
  name: "Wandering", emotion: "Unclear",
  color: "#9b8ec4",
  gradient: "radial-gradient(circle at 35% 35%, #c4b8e8, #9b8ec4 55%, #4a3a6a)",
  description: "Something is stirring beneath the surface. Even if words feel out of reach right now, that is okay — the feeling is still real and worth holding gently.",
  landscape: { joy_sadness: 35, trust_disgust: 55, fear_anger: 40, surprise_anticipation: 50 },
  tools: ["breath", "unsent"]
};
