// ============================================================
// data.js — Static constants
// ============================================================

// Onboarding questions — shown once when a new account is created.
// Answers (1–5) form the user's sensitivity profile.
const ONBOARDING_QUESTIONS = [
  "I often feel overwhelmed by small things.",
  "I frequently feel under pressure.",
  "I tend to overthink situations.",
  "My emotions feel intense and hard to manage.",
  "I need alone time to recover from social interactions."
];

// Dimension labels that match the 5 onboarding questions above.
// Used when building the AI prompt for profile analysis.
const PROFILE_DIMENSIONS = [
  "Overwhelm sensitivity",
  "Pressure sensitivity",
  "Overthinking tendency",
  "Emotional intensity",
  "Need for solitude (introversion)"
];

// Shown on the homepage next to the profile score.
// Each entry has: label, description, and a colour.
const SENSITIVITY_LEVELS = [
  {
    min: 1, max: 1.8,
    label: "Grounded",
    color: "#51cf66",
    desc:  "You tend to stay steady even when things get noisy around you."
  },
  {
    min: 1.8, max: 2.6,
    label: "Balanced",
    color: "#74c0fc",
    desc:  "You process emotions at a moderate pace — neither numb nor overwhelmed."
  },
  {
    min: 2.6, max: 3.4,
    label: "Perceptive",
    color: "#a9e34b",
    desc:  "You notice emotional nuance that others often miss."
  },
  {
    min: 3.4, max: 4.2,
    label: "Sensitive",
    color: "#f9c74f",
    desc:  "You feel things deeply and process experiences more intensely than most."
  },
  {
    min: 4.2, max: 5.0,
    label: "Highly Sensitive",
    color: "#f06595",
    desc:  "You experience the world with exceptional depth and richness — and that comes with both gifts and challenges."
  }
];

// Fallback questions if the AI call fails
const FALLBACK_QUESTIONS = [
  { q: "How intense does this feeling seem right now?" },
  { q: "How much is this weighing on your mind?" },
  { q: "How settled does your body feel?" },
  { q: "How connected do you feel to yourself right now?" }
];

// Fallback planet if the AI call fails
const FALLBACK_PLANET = {
  name:        "Wandering",
  emotion:     "Unclear",
  color:       "#8ab4f8",
  gradient:    "radial-gradient(circle at 35% 35%, #c4d9f5, #8ab4f8 55%, #5a8fd4)",
  description: "Something is stirring beneath the surface. Even if words feel out of reach right now, that is okay — the feeling is still real and worth holding gently.",
  hasRing:     false
};

// Emoji / colours used by the Clear-Space regulation screen
const CLEAR_WORRIES = ["😔","😰","😤","😞","😓","🌧","💭","😟"];
const CLEAR_COLORS  = ["#f06595","#8ab4f8","#81e6d9","#b794f6","#f9c784","#a8d8ea","#ff9a9e","#a18cd1"];
