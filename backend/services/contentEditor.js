/**
 * Content Editor Service
 * Provides two capabilities:
 *   1. editContent   — rewrites a post's slides/caption using a user text instruction via Gemini
 *   2. regeneratePost — runs research + filter + content steps fresh, skipping previously used topics
 */

require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });
const fs = require('fs');
const path = require('path');

const { callGemini } = require('../agents/geminiHelper');
const { researchAINews } = require('../agents/researchAgent');
const { filterTopNews } = require('../agents/filterAgent');
const { generateAllContent } = require('../agents/contentAgent');

const DATA_DIR = path.join(__dirname, '../data');
const POSTS_DIR = path.join(DATA_DIR, 'posts');

// ================================
// EDIT CONTENT
// Rewrites a post's slides and caption based on a plain-text user instruction.
// ================================

/**
 * Rewrite a post's slides and caption according to a user instruction.
 * @param {Object} post - The post object (with post.slides and post.caption).
 * @param {string} userInstruction - Plain-text instruction (e.g. "make it simpler", "more professional tone").
 * @returns {Object} - Updated post object with modified slides and caption.
 */
async function editContent(post, userInstruction) {
  console.log(`\n✏️  [contentEditor] Editing post: "${post.headline}"`);
  console.log(`   Instruction: "${userInstruction}"`);

  const prompt = `You are the chief content editor for @learnwithmanii — an Instagram channel teaching AI to students, employees, engineers, and business owners.

You have been given an existing Instagram carousel post and a specific editing instruction from the content creator.

EDITING INSTRUCTION:
"${userInstruction}"

CURRENT POST (JSON):
${JSON.stringify({ headline: post.headline, slides: post.slides, caption: post.caption, hashtags: post.hashtags }, null, 2)}

YOUR TASK:
Rewrite the slides and caption according to the editing instruction. Keep the same JSON structure exactly — only change the text content of the fields. Do not add or remove slide fields.

Rules:
- Apply the instruction to ALL slides and the caption
- Preserve all existing JSON keys exactly as they are
- Keep the same overall topic and educational value
- Return the modified slides and caption as valid JSON

Return ONLY valid JSON with this exact structure:
{
  "slides": { ...same keys as input, with rewritten text... },
  "caption": {
    "hook": "string",
    "body": "string",
    "engagement_prompt": "string",
    "save_prompt": "string",
    "call_to_action": "string",
    "full_caption": "string"
  },
  "hashtags": ["string"]
}`;

  try {
    const { text } = await callGemini(prompt, 'content');

    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('Could not extract JSON from Gemini edit response');

    const edited = JSON.parse(jsonMatch[0]);

    // Rebuild full_caption from parts if not provided or empty
    if (edited.caption && !edited.caption.full_caption) {
      edited.caption.full_caption = [
        edited.caption.hook || '',
        '',
        edited.caption.body || '',
        '',
        edited.caption.engagement_prompt || '',
        '',
        edited.caption.save_prompt || '',
        '',
        edited.caption.call_to_action || '',
        '',
        (edited.hashtags || post.hashtags || []).join(' ')
      ].join('\n');
    }

    // Merge edits back into the original post object
    const updatedPost = {
      ...post,
      slides: edited.slides || post.slides,
      caption: edited.caption || post.caption,
      hashtags: edited.hashtags || post.hashtags,
      edited_at: new Date().toISOString(),
      last_edit_instruction: userInstruction
    };

    console.log(`✅ [contentEditor] Edit complete for: "${post.headline}"`);
    return updatedPost;

  } catch (error) {
    console.error(`❌ [contentEditor] Edit failed: ${error.message}`);
    throw error;
  }
}

// ================================
// REGENERATE POST
// Runs research → filter → content with a fresh topic,
// excluding topics already covered.
// ================================

/**
 * Re-run the research + filter + content pipeline with a fresh topic.
 * @param {string[]} excludeTopics - Array of headline strings or topic strings to skip.
 * @returns {Object} - contentData object ({ posts, generated_at, total_posts }) for the new post.
 */
async function regeneratePost(excludeTopics = []) {
  console.log('\n🔄 [contentEditor] Regenerating post with fresh topic...');
  if (excludeTopics.length > 0) {
    console.log(`   Excluding ${excludeTopics.length} topic(s):`, excludeTopics.slice(0, 3).join(', '));
  }

  try {
    // Step 1: Research
    console.log('🔍 [contentEditor] Step 1: Researching AI news...');
    const newsData = await researchAINews();

    // Filter out excluded topics from the news pool
    if (excludeTopics.length > 0 && newsData.news_items) {
      const excludeLower = excludeTopics.map(t => t.toLowerCase());
      newsData.news_items = newsData.news_items.filter(item => {
        const headlineLower = (item.headline || '').toLowerCase();
        const summaryLower = (item.summary || '').toLowerCase();
        // Exclude if any excluded topic keyword appears in the headline or summary
        return !excludeLower.some(ex => headlineLower.includes(ex) || summaryLower.includes(ex));
      });
      newsData.total_items = newsData.news_items.length;
      console.log(`   After exclusion: ${newsData.total_items} items remain`);
    }

    if (!newsData.news_items || newsData.news_items.length === 0) {
      throw new Error('No fresh news items available after excluding prior topics');
    }

    // Step 2: Filter — pick best topic
    console.log('🎯 [contentEditor] Step 2: Filtering to best story...');
    const filteredNews = await filterTopNews(newsData);
    // Enforce 1 post per call
    filteredNews.selected_items = filteredNews.selected_items.slice(0, 1);

    const topStory = filteredNews.selected_items[0];
    console.log(`   Selected: "${topStory?.headline}"`);

    // Step 3: Generate content
    console.log('📝 [contentEditor] Step 3: Generating new carousel content...');
    const contentData = await generateAllContent(filteredNews);

    console.log(`✅ [contentEditor] Regeneration complete: "${contentData.posts[0]?.headline}"`);
    return contentData;

  } catch (error) {
    console.error(`❌ [contentEditor] Regeneration failed: ${error.message}`);
    throw error;
  }
}

/**
 * Helper: Load the most recently generated post file from POSTS_DIR.
 * Excludes run_ prefixed files.
 * @returns {{ filePath: string, data: Object }|null}
 */
function loadLatestPostFile() {
  if (!fs.existsSync(POSTS_DIR)) return null;

  // Primary: read run_run_*.json files sorted by modification time (newest first).
  // These are written by the current pipeline on every generate.
  const runFiles = fs.readdirSync(POSTS_DIR)
    .filter(f => f.startsWith('run_') && f.endsWith('.json') && !f.startsWith('quality_'))
    .map(f => ({ f, mtime: fs.statSync(path.join(POSTS_DIR, f)).mtimeMs }))
    .sort((a, b) => b.mtime - a.mtime)
    .map(o => o.f);

  // Fallback: old YYYY-MM-DD.json date files (legacy)
  const dateFiles = fs.readdirSync(POSTS_DIR)
    .filter(f => f.endsWith('.json') && !f.startsWith('run_') && !f.startsWith('quality_'))
    .sort()
    .reverse();

  const candidates = [...runFiles, ...dateFiles];
  if (candidates.length === 0) return null;

  for (const file of candidates) {
    const filePath = path.join(POSTS_DIR, file);
    try {
      const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
      // Must have actual post content
      if (data.content?.posts?.length > 0) return { filePath, data };
    } catch { /* skip unreadable */ }
  }
  return null;
}

module.exports = { editContent, regeneratePost, loadLatestPostFile };
