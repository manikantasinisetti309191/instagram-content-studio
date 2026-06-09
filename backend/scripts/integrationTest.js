/**
 * Integration Test — Content Schema ↔ Carousel Renderer
 *
 * Tests that every pattern (A/B/C/D/E) can be:
 *   1. Generated via buildGuaranteedFallback()
 *   2. Rendered to 10 PNG slides by renderCarousel()
 *   3. Each slide file is non-blank (>30KB means real content was drawn)
 *
 * This catches field-name mismatches between contentAgent and carouselRenderer
 * BEFORE they reach production.
 *
 * Usage: node backend/scripts/integrationTest.js
 */

require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });

const path = require('path');
const fs   = require('fs');

// ─── IMPORTS ────────────────────────────────────────────────────────────────
let buildGuaranteedFallback, renderCarousel;
try {
  ({ buildGuaranteedFallback } = require('../agents/qualityAgent'));
} catch (e) {
  console.error('❌ Cannot import qualityAgent:', e.message);
  process.exit(1);
}
try {
  ({ renderCarousel } = require('../services/carouselRenderer'));
} catch (e) {
  console.error('❌ Cannot import carouselRenderer:', e.message);
  process.exit(1);
}

// ─── MOCK NEWS ITEMS PER PATTERN ────────────────────────────────────────────
const MOCK_NEWS = {
  A: { id: 'test_a', headline: 'Runway Gen-3 Generates Hollywood Videos From Text', summary: 'Runway Gen-3 is a new AI video generation tool that creates cinematic quality videos from text prompts.', source: 'Runway AI', impact: 'Anyone can now create professional video content without a camera or crew.', category: 'AI Tool', emoji: '🎬', suggested_pattern: 'A', viral_score: 9 },
  B: { id: 'test_b', headline: 'ChatGPT Prompt Techniques That 10x Your Output Quality', summary: 'Six advanced prompt engineering techniques that dramatically improve ChatGPT responses.', source: 'OpenAI', impact: 'Users get dramatically better AI outputs using these techniques.', category: 'Prompts', emoji: '📋', suggested_pattern: 'B', viral_score: 9 },
  C: { id: 'test_c', headline: 'How to Build an AI Research Assistant in 30 Minutes', summary: 'A step-by-step tutorial for building an AI-powered research assistant using Perplexity and Notion.', source: 'AI Tools', impact: 'Cuts research time from hours to minutes.', category: 'Tutorial', emoji: '📖', suggested_pattern: 'C', viral_score: 8 },
  D: { id: 'test_d', headline: '5 AI Myths That Are Killing Your Career Growth', summary: 'Common misconceptions about AI that are preventing professionals from adopting it effectively.', source: 'Tech Research', impact: 'Professionals who believe these myths fall behind peers.', category: 'Myths', emoji: '🚫', suggested_pattern: 'D', viral_score: 9 },
  E: { id: 'test_e', headline: 'ChatGPT vs Claude vs Gemini: The Honest 2025 Comparison', summary: 'A real-world comparison of the three leading AI assistants across writing, coding, and research tasks.', source: 'AI Research', impact: 'Users waste money on wrong tools without this comparison.', category: 'Comparison', emoji: '⚔️', suggested_pattern: 'E', viral_score: 9 },
};

// ─── TEST A SINGLE PATTERN ───────────────────────────────────────────────────
async function testPattern(pattern) {
  console.log(`\n  Testing Pattern ${pattern}...`);
  const errors = [];

  // Step 1: Build fallback content (no Gemini API needed — uses local data)
  let post;
  try {
    post = buildGuaranteedFallback(MOCK_NEWS[pattern], 1, pattern);
    if (!post) throw new Error('buildGuaranteedFallback returned null');
    if (!post.slides) throw new Error('post has no slides');
    const slideCount = Object.keys(post.slides).length;
    if (slideCount !== 10) throw new Error(`Expected 10 slides, got ${slideCount}`);
    console.log(`    ✅ Content schema: ${slideCount} slides (Pattern ${post.pattern})`);
  } catch (e) {
    errors.push(`Content generation: ${e.message}`);
    return errors;
  }

  // Step 2: Validate key fields exist for this pattern
  const fieldChecks = {
    A: [['slide_1', 'tool_name'], ['slide_1', 'tagline'], ['slide_2', 'one_liner'], ['slide_2', 'analogy'], ['slide_6', 'prompt_text'], ['slide_9', 'limitation_1']],
    B: [['slide_1', 'headline'], ['slide_3', 'prompt_text'], ['slide_3', 'prompt_name'], ['slide_9', 'technique']],
    C: [['slide_1', 'headline'], ['slide_3', 'step_title'], ['slide_3', 'action'], ['slide_9', 'before_state']],
    D: [['slide_1', 'headline'], ['slide_2', 'myth_text'], ['slide_2', 'truth_text'], ['slide_8', 'action_1']],
    E: [['slide_1', 'headline'], ['slide_2', 'tool_a'], ['slide_2', 'tool_b'], ['slide_3', 'category'], ['slide_8', 'overall_winner']],
  };

  for (const [slideKey, fieldKey] of (fieldChecks[pattern] || [])) {
    const val = post.slides[slideKey]?.[fieldKey];
    if (!val || String(val).trim().length < 3) {
      errors.push(`Schema mismatch: ${slideKey}.${fieldKey} is empty/missing`);
    }
  }

  if (errors.length === 0) {
    console.log(`    ✅ Field validation: all required fields present`);
  } else {
    errors.forEach(e => console.log(`    ❌ ${e}`));
    return errors; // skip render if schema is broken
  }

  // Step 3: Render all 10 slides
  let imagePaths;
  try {
    const result = await renderCarousel(post);
    imagePaths = result.imagePaths;
    if (!imagePaths || imagePaths.length !== 10) {
      throw new Error(`Expected 10 images, got ${imagePaths?.length ?? 0}`);
    }
    console.log(`    ✅ Renderer: produced ${imagePaths.length} slides`);
  } catch (e) {
    errors.push(`Renderer crashed: ${e.message}`);
    return errors;
  }

  // Step 4: Check slide file sizes — blank slides are suspiciously small
  let blankCount = 0;
  for (const imgPath of imagePaths) {
    if (!fs.existsSync(imgPath)) {
      errors.push(`Slide file not found: ${imgPath}`);
      continue;
    }
    const size = fs.statSync(imgPath).size;
    if (size < 20000) { // < 20KB = likely blank canvas
      blankCount++;
      errors.push(`Slide appears blank: ${path.basename(imgPath)} is only ${size} bytes`);
    }
  }

  if (blankCount === 0) {
    console.log(`    ✅ Slide content: all slides have real content (non-blank)`);
  }

  // Clean up test images
  try {
    imagePaths.forEach(p => fs.existsSync(p) && fs.unlinkSync(p));
    const dir = path.dirname(imagePaths[0]);
    if (fs.existsSync(dir)) fs.rmdirSync(dir, { recursive: true });
  } catch { /* non-fatal */ }

  return errors;
}

// ─── MAIN ────────────────────────────────────────────────────────────────────
async function main() {
  console.log('\n🧪 Integration Test — Content Schema ↔ Carousel Renderer');
  console.log('─'.repeat(55));

  const patterns = ['A', 'B', 'C', 'D', 'E'];
  const results = {};
  let totalErrors = 0;

  for (const pattern of patterns) {
    const errors = await testPattern(pattern);
    results[pattern] = errors;
    totalErrors += errors.length;
  }

  // ─── SUMMARY ──────────────────────────────────────────────────────────────
  console.log('\n' + '─'.repeat(55));
  console.log('📋 Integration Test Summary\n');

  for (const [pattern, errors] of Object.entries(results)) {
    const name = { A: 'Tool Spotlight', B: 'Prompt Playbook', C: 'Tutorial', D: 'Myth Busting', E: 'Comparison' }[pattern];
    if (errors.length === 0) {
      console.log(`  ✅ Pattern ${pattern} (${name}): PASS`);
    } else {
      console.log(`  ❌ Pattern ${pattern} (${name}): FAIL — ${errors.length} error(s)`);
      errors.forEach(e => console.log(`       • ${e}`));
    }
  }

  console.log('\n' + '─'.repeat(55));
  if (totalErrors === 0) {
    console.log('  🎉 ALL PATTERNS PASS — safe to deploy\n');
    process.exit(0);
  } else {
    console.log(`  ⛔ ${totalErrors} ERROR(S) FOUND — DO NOT DEPLOY until fixed\n`);
    process.exit(1);
  }
}

main().catch(err => {
  console.error('\n💥 Test runner crashed:', err.message);
  process.exit(1);
});
