/**
 * Evergreen Content Agent
 * Generates Instagram carousels on timeless AI topics
 * without needing today's live news.
 * Used when user selects 'Evergreen' mode in the picker.
 */

// ─── 30+ EVERGREEN TOPICS ────────────────────────────────────────────────────
const EVERGREEN_TOPICS = [
  // Prompt collections → Pattern B
  { headline: '10 ChatGPT prompts every student must save', category: 'Prompt Guide', suggested_pattern: 'B', emoji: '📋' },
  { headline: '8 ChatGPT prompts that replace a $200/month copywriter', category: 'Prompt Guide', suggested_pattern: 'B', emoji: '✍️' },
  { headline: '6 Gemini prompts that will change how you research', category: 'Prompt Guide', suggested_pattern: 'B', emoji: '🔍' },
  { headline: '7 Claude prompts for writing better code reviews', category: 'Prompt Guide', suggested_pattern: 'B', emoji: '💻' },
  { headline: '5 AI prompts to ace any job interview', category: 'Prompt Guide', suggested_pattern: 'B', emoji: '🎯' },
  { headline: '10 ChatGPT prompts for remote workers who want to do more in less time', category: 'Prompt Guide', suggested_pattern: 'B', emoji: '⚡' },

  // Tool spotlights → Pattern A
  { headline: '7 free AI tools that replaced $500/month software', category: 'AI Tool', suggested_pattern: 'A', emoji: '🔦' },
  { headline: 'The best free AI image generator nobody is talking about', category: 'AI Tool', suggested_pattern: 'A', emoji: '🎨' },
  { headline: 'This free AI tool builds websites in 30 seconds', category: 'AI Tool', suggested_pattern: 'A', emoji: '🌐' },
  { headline: 'The AI meeting tool that writes your follow-ups automatically', category: 'AI Tool', suggested_pattern: 'A', emoji: '📋' },
  { headline: 'The AI tools every entrepreneur needs in 2025', category: 'AI Tool', suggested_pattern: 'A', emoji: '🚀' },
  { headline: 'AI tools that create presentations in under 60 seconds', category: 'AI Tool', suggested_pattern: 'A', emoji: '📊' },
  { headline: 'The AI writing tool that sounds more human than most humans', category: 'AI Tool', suggested_pattern: 'A', emoji: '📝' },

  // Tutorials → Pattern C
  { headline: 'How to write a professional CV with AI in 10 minutes', category: 'Tutorial', suggested_pattern: 'C', emoji: '📄' },
  { headline: 'How to automate your social media completely with AI', category: 'Tutorial', suggested_pattern: 'C', emoji: '📱' },
  { headline: 'How students are using AI to get better grades (step by step)', category: 'Tutorial', suggested_pattern: 'C', emoji: '🎓' },
  { headline: 'The AI workflow that saves 10 hours every single week', category: 'Tutorial', suggested_pattern: 'C', emoji: '⏱️' },
  { headline: 'How to use AI for job interview prep and actually get hired', category: 'Tutorial', suggested_pattern: 'C', emoji: '💼' },
  { headline: 'How to build a side income using only AI tools', category: 'Tutorial', suggested_pattern: 'C', emoji: '💰' },
  { headline: 'How to use Notion AI to manage your entire life', category: 'Tutorial', suggested_pattern: 'C', emoji: '🗂️' },
  { headline: 'How to research any topic 10x faster with AI', category: 'Tutorial', suggested_pattern: 'C', emoji: '🔬' },

  // Myth busting → Pattern D
  { headline: '5 AI myths killing your career growth right now', category: 'Reality Check', suggested_pattern: 'D', emoji: '🚫' },
  { headline: '7 lies about AI that smart people still believe', category: 'Reality Check', suggested_pattern: 'D', emoji: '🚨' },
  { headline: 'The biggest AI misconceptions students need to stop believing', category: 'Reality Check', suggested_pattern: 'D', emoji: '❌' },
  { headline: '6 AI productivity myths that are secretly slowing you down', category: 'Reality Check', suggested_pattern: 'D', emoji: '⚠️' },

  // Comparisons → Pattern E
  { headline: 'ChatGPT vs Claude vs Gemini: which one should you actually use?', category: 'Comparison', suggested_pattern: 'E', emoji: '⚔️' },
  { headline: 'Midjourney vs DALL-E 3: the honest comparison after 30 days', category: 'Comparison', suggested_pattern: 'E', emoji: '🎨' },
  { headline: 'Notion AI vs Obsidian AI: which note-taking AI wins?', category: 'Comparison', suggested_pattern: 'E', emoji: '📓' },
  { headline: '5 AI writing tools compared: which one actually sounds human?', category: 'Comparison', suggested_pattern: 'E', emoji: '✍️' },
  { headline: 'Perplexity vs ChatGPT for research: the verdict', category: 'Comparison', suggested_pattern: 'E', emoji: '🔎' },
  { headline: 'GitHub Copilot vs Cursor: which AI coding tool wins in 2025?', category: 'Comparison', suggested_pattern: 'E', emoji: '💻' },
];

// ─── SELECT TOPIC ─────────────────────────────────────────────────────────────
/**
 * Select an evergreen topic.
 * @param {string|null} customTopic - User-provided topic, or null for auto-pick
 * @param {string[]} recentTopics   - Headlines already used recently (to avoid repeats)
 * @returns {{ id, headline, summary, source, impact, category, emoji, suggested_pattern, is_evergreen }}
 */
function selectEvergreenTopic(customTopic = null, recentTopics = []) {
  if (customTopic && customTopic.trim().length > 0) {
    const t = customTopic.trim();
    const cat = inferCategory(t);
    return {
      id: `ev_custom_${Date.now()}`,
      headline: t,
      summary: `An evergreen Instagram carousel about: ${t}`,
      source: 'Evergreen',
      impact: 'High educational value — timeless and saveable',
      category: cat.category,
      suggested_pattern: cat.pattern,
      emoji: cat.emoji,
      final_score: 9.5,
      is_evergreen: true,
    };
  }

  // Shuffle and pick first non-recent
  const shuffled = [...EVERGREEN_TOPICS].sort(() => Math.random() - 0.5);
  const recentLower = recentTopics.map(r => r.toLowerCase());
  const pick = shuffled.find(t => !recentLower.includes(t.headline.toLowerCase())) || shuffled[0];

  return {
    id: `ev_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    headline: pick.headline,
    summary: `An evergreen Instagram carousel about: ${pick.headline}`,
    source: 'Evergreen',
    impact: 'High educational value — timeless content with long shelf life',
    category: pick.category,
    suggested_pattern: pick.suggested_pattern,
    emoji: pick.emoji,
    final_score: 9.0,
    is_evergreen: true,
  };
}

// ─── INFER CATEGORY FROM CUSTOM TOPIC ────────────────────────────────────────
function inferCategory(topic) {
  const t = topic.toLowerCase();
  if (t.includes('prompt') || t.includes('write this') || t.includes('say this')) {
    return { category: 'Prompt Guide', pattern: 'B', emoji: '📋' };
  }
  if (t.includes('vs') || t.includes('compare') || t.includes('better') || t.includes('which')) {
    return { category: 'Comparison', pattern: 'E', emoji: '⚔️' };
  }
  if (t.includes('myth') || t.includes('truth') || t.includes('lie') || t.includes('wrong') || t.includes('stop')) {
    return { category: 'Reality Check', pattern: 'D', emoji: '🚫' };
  }
  if (t.includes('how to') || t.includes('step') || t.includes('workflow') || t.includes('guide') || t.includes('tutorial')) {
    return { category: 'Tutorial', pattern: 'C', emoji: '📖' };
  }
  if (t.includes('tool') || t.includes('free') || t.includes('app') || t.includes('software')) {
    return { category: 'AI Tool', pattern: 'A', emoji: '🔦' };
  }
  // Default: tool spotlight
  return { category: 'AI Tool', pattern: 'A', emoji: '✨' };
}

// ─── GENERATE EVERGREEN CONTENT (PIPELINE ENTRY POINT) ───────────────────────
/**
 * Generate a filteredNews-style object for evergreen mode.
 * @param {object} options - { topic?: string, recentTopics?: string[] }
 * @returns {{ selected_items: [], is_evergreen: true, total_items: 1 }}
 */
async function generateEvergreenContent(options = {}) {
  const { topic = null, recentTopics = [] } = options;
  const selectedTopic = selectEvergreenTopic(topic, recentTopics);

  console.log(`♻️  [EvergreenAgent] Selected topic: "${selectedTopic.headline}"`);
  console.log(`    Pattern: ${selectedTopic.suggested_pattern} | Category: ${selectedTopic.category}`);

  return {
    selected_items: [selectedTopic],
    is_evergreen: true,
    total_items: 1,
    generated_at: new Date().toISOString(),
    mode: 'evergreen',
    custom_topic: !!topic,
  };
}

// ─── EXPORTS ─────────────────────────────────────────────────────────────────
module.exports = {
  generateEvergreenContent,
  selectEvergreenTopic,
  EVERGREEN_TOPICS,
  inferCategory,
};
