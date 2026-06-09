/**
 * Hashtag Intelligence Agent
 * Generates optimized, topic-specific Instagram hashtags using Gemini AI.
 * Mixes reach tiers (mega → niche) for maximum discoverability.
 */

require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });
const { callGemini } = require('./geminiHelper');

// Always-include brand tags
const BRAND_TAGS = ['#learnwithmanii', '#aitools2025', '#artificialintelligence'];

// Pattern-specific base tags
const PATTERN_TAGS = {
  A: ['#AITool', '#TechTool', '#NewAITool', '#AIApp', '#ProductReview'],
  B: ['#PromptEngineering', '#ChatGPTPrompts', '#AIPrompts', '#PromptHacks', '#BetterPrompts'],
  C: ['#AITutorial', '#HowToAI', '#AIWorkflow', '#StepByStep', '#LearnAI'],
  D: ['#AIMyths', '#AIFacts', '#TechMyths', '#AITruth', '#DebunkingAI'],
  E: ['#AIComparison', '#VSPost', '#TechReview', '#AIReview', '#BestAITools'],
};

// Reliable fallback — covers all bases
const FALLBACK_BASE = [
  '#ai', '#chatgpt', '#artificialintelligence', '#aitools', '#machinelearning',
  '#tech', '#technology', '#futureofwork', '#productivity', '#digitaltransformation',
  '#aiforbeginners', '#aieducation', '#ainews', '#openai', '#generativeai',
  '#studentlife', '#careertips', '#professionaldevelopment', '#techcommunity', '#innovation',
  '#llm', '#techeducation', '#airevolution', '#smarttech', '#learntech',
];

/**
 * Generate optimized hashtags for a post using Gemini
 * @param {Object} post - generated post object with headline, category, pattern, caption
 * @returns {Promise<string[]>} array of hashtag strings starting with #
 */
async function generateHashtags(post) {
  const { headline = '', category = 'AI', pattern = 'A', caption = {} } = post;
  console.log('[HashtagAgent] Generating hashtags for:', headline.substring(0, 60));

  try {
    const prompt = `You are an Instagram hashtag strategist for an AI education page (@learnwithmanii).

Post details:
- Headline: ${headline}
- Category: ${category}
- Content type: ${pattern === 'A' ? 'Tool Spotlight' : pattern === 'B' ? 'Prompt Playbook' : pattern === 'C' ? 'Tutorial' : pattern === 'D' ? 'Myth Busting' : 'AI Tool Comparison'}
- Hook: ${caption?.hook || 'AI content for students and professionals'}

Generate exactly 22 Instagram hashtags optimized for this specific post.
Use this tier mix for best reach + engagement balance:
- 2 mega tags (>10M posts): maximum reach, e.g. #ai #tech
- 5 large tags (1M-10M): visibility, e.g. #aitools #chatgpt  
- 8 medium tags (100K-1M): BEST engagement zone — most targeted
- 4 niche tags (10K-100K): high save rate, community
- 3 micro tags (<10K): early mover, ultra-specific to this topic

RULES:
- Every hashtag must be directly relevant to THIS post topic — no generic filler
- Include tool/topic name as hashtag if it has one (e.g. #RunwayML #GPT5)
- English only, no spaces in hashtag
- Return ONLY a valid JSON array of strings. No explanation.

Example: ["#ai","#chatgpt","#promptengineering","#aistudent"]

Return JSON array only:`;

    const raw = await callGemini(prompt);

    // Extract JSON array robustly
    const match = raw.match(/\[[\s\S]*?\]/);
    if (!match) throw new Error('No JSON array found in Gemini response');

    let tags = JSON.parse(match[0]);

    // Validate and clean
    tags = tags
      .filter(t => typeof t === 'string')
      .map(t => t.trim().startsWith('#') ? t.trim() : `#${t.trim()}`)
      .filter(t => t.length > 2 && t.length < 50 && !/\s/.test(t))
      .slice(0, 22);

    if (tags.length < 12) throw new Error(`Only ${tags.length} valid tags returned`);

    // Merge with pattern tags and brand tags, deduplicate
    const allTags = [...new Set([...tags, ...(PATTERN_TAGS[pattern] || []), ...BRAND_TAGS])].slice(0, 30);
    console.log(`[HashtagAgent] ✅ Generated ${allTags.length} hashtags`);
    return allTags;

  } catch (err) {
    console.warn('[HashtagAgent] Gemini failed, using smart fallback:', err.message);
    return buildSmartFallback(pattern, headline);
  }
}

/**
 * Build a smart fallback without Gemini
 */
function buildSmartFallback(pattern, headline) {
  // Extract meaningful words from headline as micro-tags
  const stopWords = new Set(['the','and','for','with','that','from','have','will','are','how','why','what','who','can','you','its','all','top']);
  const keywordTags = String(headline)
    .replace(/[^a-zA-Z0-9\s]/g, '')
    .split(/\s+/)
    .filter(w => w.length > 3 && !stopWords.has(w.toLowerCase()))
    .slice(0, 3)
    .map(w => `#${w.charAt(0).toUpperCase()}${w.slice(1).toLowerCase()}`);

  return [...new Set([
    ...keywordTags,
    ...(PATTERN_TAGS[pattern] || PATTERN_TAGS.A),
    ...BRAND_TAGS,
    ...FALLBACK_BASE,
  ])].slice(0, 25);
}

module.exports = { generateHashtags, buildSmartFallback };
