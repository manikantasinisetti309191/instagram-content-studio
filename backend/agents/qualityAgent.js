/**
 * Quality Agent
 * Validates every single field of every slide.
 * Auto-fixes missing/empty content by re-calling Gemini.
 * Runs a feedback loop until all slides pass quality checks.
 * Max 3 iterations before using a guaranteed rich fallback.
 */

const { callGemini } = require('./geminiHelper');

// ─── REQUIRED FIELDS PER SLIDE ───────────────────────────────────────────────
const SLIDE_SCHEMA = {
  slide_1:  ['label', 'title', 'subtitle'],
  slide_2:  ['title', 'bullet_1', 'bullet_2', 'bullet_3'],
  slide_3:  ['title', 'simple_explanation', 'analogy'],
  slide_4:  ['title', 'impact_statement', 'for_students', 'for_employees', 'for_business'],
  slide_5:  ['title', 'step_1', 'step_2', 'step_3', 'fun_fact'],
  slide_6:  ['title', 'use_case_1', 'use_case_2', 'use_case_3', 'use_case_4'],
  slide_7:  ['title', 'pro_1', 'pro_2', 'con_1', 'con_2'],
  slide_8:  ['title', 'context', 'vs_before', 'vs_now'],
  slide_9:  ['title', 'tip_1', 'tip_2', 'tip_3', 'bonus_tip'],
  slide_10: ['title', 'summary', 'cta_question', 'cta_follow', 'cta_save'],
};

const MIN_CHARS = {
  title: 5, subtitle: 10, label: 2,
  simple_explanation: 30, analogy: 15,
  context: 30, summary: 15,
  default: 8,
};

// ─── VALIDATE A SINGLE SLIDE ─────────────────────────────────────────────────
function validateSlide(slideKey, slideData) {
  const issues = [];
  const required = SLIDE_SCHEMA[slideKey];
  if (!required) return issues;

  for (const field of required) {
    const val = slideData?.[field];
    if (!val || typeof val !== 'string' || val.trim().length === 0) {
      issues.push(`${slideKey}.${field}: MISSING or EMPTY`);
      continue;
    }
    const minLen = MIN_CHARS[field] || MIN_CHARS.default;
    if (val.trim().length < minLen) {
      issues.push(`${slideKey}.${field}: TOO SHORT (${val.trim().length} < ${minLen} chars) — "${val}"`);
    }
    // Check for placeholder/template text
    if (/^string$|^your_|^\[|^undefined|^null/i.test(val.trim())) {
      issues.push(`${slideKey}.${field}: PLACEHOLDER TEXT — "${val}"`);
    }
  }
  return issues;
}

// ─── VALIDATE ALL 10 SLIDES ──────────────────────────────────────────────────
function validateAllSlides(post) {
  const allIssues = [];
  const slides = post?.slides || {};

  // Must have exactly 10 slides
  const slideKeys = Object.keys(slides);
  if (slideKeys.length < 10) {
    allIssues.push(`MISSING SLIDES: only ${slideKeys.length}/10 slides present`);
  }

  // Check every slide
  for (const slideKey of Object.keys(SLIDE_SCHEMA)) {
    const slideIssues = validateSlide(slideKey, slides[slideKey]);
    allIssues.push(...slideIssues);
  }

  // Check caption
  if (!post?.caption?.hook || post.caption.hook.trim().length < 10) {
    allIssues.push('caption.hook: MISSING or too short');
  }
  if (!post?.caption?.body || post.caption.body.trim().length < 50) {
    allIssues.push('caption.body: MISSING or too short');
  }

  // Check hashtags
  if (!post?.hashtags || post.hashtags.length < 20) {
    allIssues.push(`hashtags: only ${post?.hashtags?.length || 0}/25 hashtags`);
  }

  return allIssues;
}

// ─── FIX PROMPT: regenerate only the broken slides ──────────────────────────
const FIX_PROMPT = (newsItem, brokenSlides, currentContent) => `
You are a senior Instagram content editor for @learnwithmanii.

The following slides have quality issues and need to be FIXED:
${brokenSlides.map(issue => `  ❌ ${issue}`).join('\n')}

NEWS TOPIC: ${newsItem.headline}
SUMMARY: ${newsItem.summary}
IMPACT: ${newsItem.impact}

CURRENT SLIDE DATA (for context):
${JSON.stringify(currentContent.slides, null, 2)}

INSTRUCTIONS:
- Fix ONLY the slides/fields listed above
- Keep all other slides unchanged
- Write in casual, friendly English like texting a smart friend
- Every field MUST have real, meaningful content — no placeholders
- Minimum 8 words per field (except labels)
- Return the COMPLETE slides object with ALL 10 slides fixed

Return ONLY valid JSON with this exact structure:
{
  "slides": {
    "slide_1": { "label": "string", "title": "string", "subtitle": "string" },
    "slide_2": { "title": "string", "bullet_1": "string", "bullet_2": "string", "bullet_3": "string" },
    "slide_3": { "title": "string", "simple_explanation": "string", "analogy": "string" },
    "slide_4": { "title": "string", "impact_statement": "string", "for_students": "string", "for_employees": "string", "for_business": "string" },
    "slide_5": { "title": "string", "step_1": "string", "step_2": "string", "step_3": "string", "fun_fact": "string" },
    "slide_6": { "title": "string", "use_case_1": "string", "use_case_2": "string", "use_case_3": "string", "use_case_4": "string" },
    "slide_7": { "title": "string", "pro_1": "string", "pro_2": "string", "con_1": "string", "con_2": "string" },
    "slide_8": { "title": "string", "context": "string", "vs_before": "string", "vs_now": "string" },
    "slide_9": { "title": "string", "tip_1": "string", "tip_2": "string", "tip_3": "string", "bonus_tip": "string" },
    "slide_10": { "title": "The Bottom Line", "summary": "string", "cta_question": "string", "cta_follow": "Follow @learnwithmanii for daily AI lessons like this 🤖", "cta_save": "Save this — you'll need it later 🔖" }
  },
  "caption": {
    "hook": "string",
    "body": "string",
    "engagement_prompt": "string",
    "save_prompt": "string",
    "call_to_action": "Follow @learnwithmanii and tag a friend who needs to know this!"
  },
  "hashtags": ["25 hashtags array"]
}`;

// ─── GUARANTEED RICH FALLBACK (used only if ALL AI attempts fail) ─────────────
function buildGuaranteedFallback(newsItem, rank) {
  const h = newsItem.headline || 'AI Just Changed Everything';
  const s = newsItem.summary || 'A major AI breakthrough was just announced that will impact millions of people worldwide.';
  const imp = newsItem.impact || 'This makes powerful AI tools accessible to everyone — students, professionals, and businesses alike.';
  const src = newsItem.source || 'AI Labs';

  return {
    post_id: `learnwithmanii_${Date.now()}_${rank}`,
    rank,
    news_id: newsItem.id,
    headline: h,
    category: newsItem.category || 'AI News',
    emoji: newsItem.emoji || '🤖',
    slides: {
      slide_1: {
        label: 'MUST KNOW',
        title: h.length > 45 ? h.substring(0, 42) + '...' : h,
        subtitle: `Here's what it means for you — swipe to learn in 60 seconds.`,
      },
      slide_2: {
        title: "Here's What Happened",
        bullet_1: s.split('.')[0]?.trim() || `${src} just announced a major AI update`,
        bullet_2: `${src} released this to help students, professionals and businesses`,
        bullet_3: `Early users are already calling it a game-changer for productivity`,
      },
      slide_3: {
        title: 'What Does This Actually Mean?',
        simple_explanation: `Think of it like getting a super-smart assistant that never sleeps. ${s.split('.')[0]}. You don't need to be a tech expert to use it.`,
        analogy: `It's like upgrading from a bicycle to a Tesla — same destination, 10x faster and smarter.`,
      },
      slide_4: {
        title: 'Why YOU Should Care',
        impact_statement: imp.split('.')[0] || 'This AI update changes how we work, learn and create forever.',
        for_students: `Use it to research faster, write better essays, and ace your assignments`,
        for_employees: `Automate repetitive tasks, draft reports, and work smarter not harder`,
        for_business: `Cut costs, boost customer service, and scale your operations with AI`,
      },
      slide_5: {
        title: 'How It Actually Works',
        step_1: `You give it a task or question in plain simple language`,
        step_2: `It processes your input using advanced AI models trained on billions of examples`,
        step_3: `It returns accurate, human-like results in seconds — ready to use`,
        fun_fact: `The AI behind this was trained on more text than a human could read in 10,000 lifetimes`,
      },
      slide_6: {
        title: 'How YOU Can Use This Today',
        use_case_1: `Students: Write essays, summarize textbooks, prep for exams faster`,
        use_case_2: `Employees: Draft emails, analyze data, create presentations in minutes`,
        use_case_3: `Business: Build chatbots, automate support, generate marketing content`,
        use_case_4: `Creators: Script videos, write captions, generate ideas on demand`,
      },
      slide_7: {
        title: 'The Good and The Not-So-Good',
        pro_1: `Saves hours of work every single day for anyone who uses it`,
        pro_2: `No coding or tech skills needed — works in plain English`,
        con_1: `Can occasionally make mistakes — always double-check important outputs`,
        con_2: `Works best when you give it clear, specific instructions`,
      },
      slide_8: {
        title: 'The Bigger Picture',
        context: `We are in the fastest period of AI growth in history. Every few weeks a new tool launches that was impossible just months ago. This is one of those moments.`,
        vs_before: `Before: hours of manual work, expensive experts, slow results`,
        vs_now: `Now: minutes of AI-powered work, accessible to everyone, instant results`,
      },
      slide_9: {
        title: 'Pro Tips to Get Started',
        tip_1: `Be specific in your prompts — the more detail you give, the better the output`,
        tip_2: `Start with small tasks to build confidence, then tackle bigger projects`,
        tip_3: `Compare outputs from 2-3 different AI tools to find what works best for you`,
        bonus_tip: `Bookmark the official website and follow their social media for free updates and tutorials`,
      },
      slide_10: {
        title: 'The Bottom Line',
        summary: `${imp.split('.')[0] || 'AI is becoming more powerful and accessible'}. The question is — will you use it?`,
        cta_question: `What's the first thing you'll do with this AI tool?`,
        cta_follow: `Follow @learnwithmanii for daily AI lessons like this 🤖`,
        cta_save: `Save this — you'll need it later 🔖`,
      },
    },
    caption: {
      hook: `🚨 ${h}`,
      body: `${s}\n\n${imp}\n\nWhether you're a student, professional or entrepreneur — this affects YOU directly.`,
      engagement_prompt: `What would you use this AI for first? Drop it in the comments 👇`,
      save_prompt: `Save this post — when you're ready to try AI, this breakdown will be your starting guide.`,
      call_to_action: `Follow @learnwithmanii and tag a friend who needs to see this! 🤖`,
      full_caption: `🚨 ${h}\n\n${s}\n\n${imp}\n\nWhat would you use this AI for? Comment below 👇\n\nSave this post for when you're ready to start!\n\nFollow @learnwithmanii for daily AI lessons 🤖`,
    },
    hashtags: [
      '#LearnAI', '#AIForBeginners', '#AIForStudents', '#AILearning', '#LearnWithAI',
      '#AIEducation', '#TechForStudents', '#LearnTech',
      '#AIForBusiness', '#AITools', '#WorkWithAI', '#AIProductivity', '#FutureOfWork',
      '#CareerGrowth', '#TechProfessionals',
      '#ArtificialIntelligence', '#AINews', '#TechNews', '#AI2025', '#MachineLearning',
      '#ChatGPT', '#GoogleGemini', '#AIAssistant', '#TechUpdates', '#AIRevolution',
    ],
    generated_at: new Date().toISOString(),
  };
}

// ─── MAIN: VALIDATE + FIX LOOP ───────────────────────────────────────────────
async function validateAndFix(post, newsItem, maxAttempts = 3) {
  let current = JSON.parse(JSON.stringify(post)); // deep clone
  let attempt = 0;

  while (attempt < maxAttempts) {
    attempt++;
    const issues = validateAllSlides(current);

    if (issues.length === 0) {
      if (attempt === 1) {
        console.log(`  ✅ Quality check PASSED on first try — all 10 slides perfect!`);
      } else {
        console.log(`  ✅ Quality check PASSED after ${attempt - 1} fix attempt(s) — all slides perfect!`);
      }
      return { post: current, passed: true, attempts: attempt, issues: [] };
    }

    console.log(`  ⚠️  Quality check attempt ${attempt}/${maxAttempts} — ${issues.length} issues found:`);
    issues.forEach(issue => console.log(`     ❌ ${issue}`));

    if (attempt >= maxAttempts) break;

    // Try to fix with AI
    console.log(`  🔧 Sending to AI for fixes...`);
    try {
      const { text } = await callGemini(FIX_PROMPT(newsItem, issues, current), 'content');
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error('No JSON in fix response');

      const fixed = JSON.parse(jsonMatch[0]);

      // Merge fixed slides into current
      if (fixed.slides) {
        for (const [key, slideData] of Object.entries(fixed.slides)) {
          if (slideData && typeof slideData === 'object') {
            current.slides[key] = { ...current.slides[key], ...slideData };
          }
        }
      }
      if (fixed.caption) current.caption = { ...current.caption, ...fixed.caption };
      if (fixed.hashtags?.length >= 20) current.hashtags = fixed.hashtags;

      console.log(`  🔄 AI fixes applied — re-validating...`);
    } catch (err) {
      console.error(`  ❌ AI fix failed: ${err.message} — applying manual fixes...`);
      // Apply manual field-level fixes for known missing fields
      current = applyManualFixes(current, newsItem, issues);
    }
  }

  // Final check after all attempts
  const finalIssues = validateAllSlides(current);
  if (finalIssues.length > 0) {
    console.log(`  ⚠️  ${finalIssues.length} issues remain after ${maxAttempts} attempts — using guaranteed rich fallback`);
    const fallback = buildGuaranteedFallback(newsItem, post.rank);
    return { post: fallback, passed: false, attempts: maxAttempts, issues: finalIssues };
  }

  return { post: current, passed: true, attempts: maxAttempts, issues: [] };
}

// ─── MANUAL FIELD FIXER (no AI needed) ───────────────────────────────────────
function applyManualFixes(post, newsItem, issues) {
  const fallback = buildGuaranteedFallback(newsItem, post.rank);

  for (const issue of issues) {
    const match = issue.match(/^(slide_\d+)\.(\w+):/);
    if (match) {
      const [, slideKey, field] = match;
      if (!post.slides[slideKey]) post.slides[slideKey] = {};
      // Use the guaranteed fallback value for this field
      post.slides[slideKey][field] = fallback.slides[slideKey]?.[field] || `See our full breakdown on @learnwithmanii`;
    }
    if (issue.includes('MISSING SLIDES')) {
      // Add all missing slides from fallback
      for (const [key, data] of Object.entries(fallback.slides)) {
        if (!post.slides[key]) post.slides[key] = data;
      }
    }
    if (issue.includes('caption.hook')) post.caption.hook = fallback.caption.hook;
    if (issue.includes('caption.body')) post.caption.body = fallback.caption.body;
    if (issue.includes('hashtags')) post.hashtags = fallback.hashtags;
  }

  return post;
}

module.exports = { validateAndFix, validateAllSlides, buildGuaranteedFallback };
