/**
 * Content Generation Agent
 * Patterns: A=Tool Spotlight, B=Prompt Playbook, C=Tutorial, D=Myth Busting, E=Comparison
 */
require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });
const { callGemini } = require('./geminiHelper');
const { buildGuaranteedFallback } = require('./qualityAgent');

// ─────────────────────────────────────────
// PATTERN NAMES
// ─────────────────────────────────────────
const PATTERN_NAMES = {
  A: 'Tool Spotlight',
  B: 'Prompt Playbook',
  C: 'Tutorial',
  D: 'Myth Busting',
  E: 'Comparison',
};

// ─────────────────────────────────────────
// PATTERN SELECTION
// ─────────────────────────────────────────
function selectPattern(newsItem, requestedPattern) {
  if (requestedPattern && ['A','B','C','D','E'].includes(requestedPattern)) return requestedPattern;
  const suggested = newsItem.suggested_pattern;
  if (suggested && ['A','B','C','D','E'].includes(suggested)) return suggested;
  const cat = (newsItem.category || '').toLowerCase();
  if (cat.includes('tool') || cat.includes('feature') || cat.includes('launch')) return 'A';
  if (cat.includes('model') || cat.includes('api') || cat.includes('prompt')) return 'B';
  if (cat.includes('productivity') || cat.includes('how-to') || cat.includes('workflow')) return 'C';
  if (cat.includes('research') || cat.includes('career') || cat.includes('industry')) return 'D';
  if (cat.includes('comparison') || cat.includes('vs') || cat.includes('review')) return 'E';
  const pool = ['A','B','C','D','E'];
  return pool[Math.floor(Math.random() * pool.length)];
}

// ─────────────────────────────────────────
// HASHTAG BUILDER
// ─────────────────────────────────────────
function buildHashtags(newsItem, pattern) {
  const base = [
    '#LearnAI','#AIForBeginners','#AILearning','#AIEducation','#LearnWithAI',
    '#ArtificialIntelligence','#AITools','#AIProductivity','#FutureOfWork',
    '#TechForStudents','#AIForStudents','#AIForBusiness','#WorkWithAI',
    '#AI2025','#MachineLearning','#ChatGPT','#GoogleGemini','#AIAssistant',
    '#TechNews','#AIRevolution','#LearnwithManii',
  ];
  const extra = {
    A: ['#NewAITool','#AIToolDrop','#TechLaunch','#AIUpdate'],
    B: ['#PromptEngineering','#AIPrompts','#ChatGPTPrompts','#PromptHacks'],
    C: ['#AITutorial','#StepByStep','#AIWorkflow','#HowToAI'],
    D: ['#AIMyths','#AIFacts','#AITruth','#TechMyths'],
    E: ['#AIComparison','#VSPost','#AIReview','#BestAITools'],
  };
  return [...new Set([...base, ...(extra[pattern] || extra.A)])].slice(0, 25);
}

// ─────────────────────────────────────────
// CAPTION BUILDER
// ─────────────────────────────────────────
function buildFullCaption(post) {
  const c = post.caption || {};
  const tags = (post.hashtags || []).join(' ');
  post.caption.full_caption = [
    c.hook || '',
    '',
    c.body || '',
    '',
    c.engagement_prompt || '',
    '',
    c.save_prompt || '',
    '',
    c.call_to_action || 'Follow @learnwithmanii + tag a friend who needs this',
    '',
    tags,
  ].join('\n').trim();
  return post;
}

// ─────────────────────────────────────────
// PATTERN PROMPT BUILDERS
// ─────────────────────────────────────────
function buildPrompt(pattern, newsItem, rank) {
  const h = newsItem.headline || '';
  const s = newsItem.summary || '';
  const src = newsItem.source || 'AI Industry';
  const imp = newsItem.impact || '';
  const cat = newsItem.category || 'AI';
  const em = newsItem.emoji || '🤖';
  const pName = PATTERN_NAMES[pattern];

  const schemaByPattern = {
    A: `{
  "post_id":"post_${rank}_a","rank":${rank},"pattern":"A","pattern_name":"Tool Spotlight",
  "headline":"${h.replace(/"/g,'\\"')}","category":"${cat}","emoji":"${em}",
  "slides":{
    "slide_1":{"label":"","tool_name":"","tagline":"","subtitle":""},
    "slide_2":{"title":"","one_liner":"","analogy":"","key_fact":""},
    "slide_3":{"use_case_title":"","who_its_for":"","step_1":"","step_2":"","step_3":"","time_saved":""},
    "slide_4":{"use_case_title":"","who_its_for":"","step_1":"","step_2":"","step_3":"","time_saved":""},
    "slide_5":{"use_case_title":"","who_its_for":"","step_1":"","step_2":"","step_3":"","time_saved":""},
    "slide_6":{"slide_label":"COPY THIS PROMPT","prompt_name":"","prompt_text":"","expected_output":""},
    "slide_7":{"title":"","for_students":"","for_employees":"","for_creators":"","for_business":""},
    "slide_8":{"title":"","step_1":"","step_2":"","step_3":"","closing_line":""},
    "slide_9":{"title":"","limitation_1":"","limitation_2":"","still_worth_it":""},
    "slide_10":{"verdict":"","save_cta":"Save this guide — you'll need it later 🔖","follow_cta":"Follow @learnwithmanii for daily AI tool drops 🤖","comment_question":""}
  },
  "caption":{"hook":"","body":"","engagement_prompt":"","save_prompt":"","call_to_action":"","full_caption":""},
  "hashtags":[],"generated_at":"${new Date().toISOString()}"
}`,
    B: `{
  "post_id":"post_${rank}_b","rank":${rank},"pattern":"B","pattern_name":"Prompt Playbook",
  "headline":"${h.replace(/"/g,'\\"')}","category":"${cat}","emoji":"${em}",
  "slides":{
    "slide_1":{"label":"PROMPT PACK","headline":"","subtitle":""},
    "slide_2":{"title":"","context":"","tease":""},
    "slide_3":{"prompt_number":"1","prompt_name":"","prompt_text":"","use_when":"","output_description":""},
    "slide_4":{"prompt_number":"2","prompt_name":"","prompt_text":"","use_when":"","output_description":""},
    "slide_5":{"prompt_number":"3","prompt_name":"","prompt_text":"","use_when":"","output_description":""},
    "slide_6":{"prompt_number":"4","prompt_name":"","prompt_text":"","use_when":"","output_description":""},
    "slide_7":{"prompt_number":"5","prompt_name":"","prompt_text":"","use_when":"","output_description":""},
    "slide_8":{"prompt_number":"6","prompt_name":"","prompt_text":"","use_when":"","output_description":""},
    "slide_9":{"title":"","technique":"","before_example":"","after_example":""},
    "slide_10":{"verdict":"","save_cta":"Save this prompt pack 🔖","follow_cta":"Follow @learnwithmanii for weekly prompt drops 🤖","comment_question":""}
  },
  "caption":{"hook":"","body":"","engagement_prompt":"","save_prompt":"","call_to_action":"","full_caption":""},
  "hashtags":[],"generated_at":"${new Date().toISOString()}"
}`,
    C: `{
  "post_id":"post_${rank}_c","rank":${rank},"pattern":"C","pattern_name":"Tutorial",
  "headline":"${h.replace(/"/g,'\\"')}","category":"${cat}","emoji":"${em}",
  "slides":{
    "slide_1":{"label":"","headline":"","subtitle":""},
    "slide_2":{"deliverable":"","tools_needed":"","time_required":"","skill_level":""},
    "slide_3":{"step_number":"01","step_title":"","action":"","exact_input":"","expected_output":"","common_mistake":""},
    "slide_4":{"step_number":"02","step_title":"","action":"","exact_input":"","expected_output":"","common_mistake":""},
    "slide_5":{"step_number":"03","step_title":"","action":"","exact_input":"","expected_output":"","common_mistake":""},
    "slide_6":{"step_number":"04","step_title":"","action":"","exact_input":"","expected_output":"","common_mistake":""},
    "slide_7":{"step_number":"05","step_title":"","action":"","exact_input":"","expected_output":"","common_mistake":""},
    "slide_8":{"step_number":"06","step_title":"","action":"","exact_input":"","expected_output":"","common_mistake":""},
    "slide_9":{"before_state":"","after_state":"","time_saved":"","quality_note":""},
    "slide_10":{"verdict":"","save_cta":"Save this workflow 🔖","follow_cta":"Follow @learnwithmanii for daily AI tutorials 🤖","comment_question":""}
  },
  "caption":{"hook":"","body":"","engagement_prompt":"","save_prompt":"","call_to_action":"","full_caption":""},
  "hashtags":[],"generated_at":"${new Date().toISOString()}"
}`,
    D: `{
  "post_id":"post_${rank}_d","rank":${rank},"pattern":"D","pattern_name":"Myth Busting",
  "headline":"${h.replace(/"/g,'\\"')}","category":"${cat}","emoji":"${em}",
  "slides":{
    "slide_1":{"label":"","headline":"","subtitle":""},
    "slide_2":{"myth_text":"","truth_text":"","why_it_matters":""},
    "slide_3":{"myth_text":"","truth_text":"","why_it_matters":""},
    "slide_4":{"myth_text":"","truth_text":"","why_it_matters":""},
    "slide_5":{"myth_text":"","truth_text":"","why_it_matters":""},
    "slide_6":{"myth_text":"","truth_text":"","why_it_matters":""},
    "slide_7":{"title":"","myth_text":"","truth_text":"","impact":""},
    "slide_8":{"title":"","action_1":"","action_2":"","action_3":""},
    "slide_9":{"title":"","honest_summary":"","bottom_line":""},
    "slide_10":{"verdict":"","comment_trigger":"","save_cta":"","follow_cta":""}
  },
  "caption":{"hook":"","body":"","engagement_prompt":"","save_prompt":"","call_to_action":"","full_caption":""},
  "hashtags":[],"generated_at":"${new Date().toISOString()}"
}`,
    E: `{
  "post_id":"post_${rank}_e","rank":${rank},"pattern":"E","pattern_name":"Comparison",
  "headline":"${h.replace(/"/g,'\\"')}","category":"${cat}","emoji":"${em}",
  "slides":{
    "slide_1":{"label":"","headline":"","subtitle":""},
    "slide_2":{"tool_a":"","tool_b":"","categories_tested":"","disclaimer":""},
    "slide_3":{"category":"","winner":"","tool_a_score":"","tool_a_reason":"","tool_b_score":"","tool_b_reason":"","key_difference":""},
    "slide_4":{"category":"","winner":"","tool_a_score":"","tool_a_reason":"","tool_b_score":"","tool_b_reason":"","key_difference":""},
    "slide_5":{"category":"","winner":"","tool_a_score":"","tool_a_reason":"","tool_b_score":"","tool_b_reason":"","key_difference":""},
    "slide_6":{"category":"","winner":"","tool_a_score":"","tool_a_reason":"","tool_b_score":"","tool_b_reason":"","key_difference":""},
    "slide_7":{"category":"","winner":"","tool_a_score":"","tool_a_reason":"","tool_b_score":"","tool_b_reason":"","key_difference":""},
    "slide_8":{"tool_a_wins_for":"","tool_b_wins_for":"","overall_winner":"","verdict_reason":""},
    "slide_9":{"for_students":"","for_professionals":"","for_budget":"","for_power_users":""},
    "slide_10":{"verdict":"","comment_trigger":"","save_cta":"","follow_cta":""}
  },
  "caption":{"hook":"","body":"","engagement_prompt":"","save_prompt":"","call_to_action":"","full_caption":""},
  "hashtags":[],"generated_at":"${new Date().toISOString()}"
}`,
  };

  const instructions = {
    A: `slide_1: label(TOOL DROP or JUST LAUNCHED or FREE TOOL), tool_name(exact AI tool name), tagline(what it does in 5-7 words), subtitle("Save this before it goes viral")
slide_2: title("What Is [ToolName] Exactly?"), one_liner(1 crystal-clear sentence), analogy("It's like X but Y with a specific twist"), key_fact(surprising stat or real capability)
slide_3/4/5: three DIFFERENT use cases each with use_case_title, who_its_for, step_1, step_2, step_3, time_saved
slide_6: slide_label="COPY THIS PROMPT", prompt_name, prompt_text(REAL copy-pasteable prompt of AT LEAST 100 characters — write the actual prompt, not a description of it), expected_output("You'll get: [specific result]")
slide_7: title("Who Is This For?"), for_students(specific benefit max 12 words), for_employees, for_creators, for_business
slide_8: title("Start in 5 Minutes"), step_1("Go to [REAL URL]"), step_2(exact action), step_3(exact action), closing_line
slide_9: title("The Honest Catch"), limitation_1(real limitation), limitation_2(real limitation), still_worth_it(strong reason it is still great)
slide_10: verdict(bold opinion 15 words), save_cta, follow_cta, comment_question(specific question about this tool)`,
    B: `slide_1: label="PROMPT PACK", headline("[N] [Model] Prompts That [Specific Benefit]"), subtitle("Copy-paste ready. Save this.")
slide_2: title(engaging intro), context(why these prompts are different — 2 sentences), tease("I tested 100+ prompts. These survived.")
slides 3-8 (6 prompts): prompt_number(1-6), prompt_name(descriptive), prompt_text(REAL FULL PROMPT AT LEAST 100 CHARS — must be immediately usable in ChatGPT/Claude/Gemini, NOT a description), use_when(specific situation), output_description(what you get — 8 words)
slide_9: title("The Pro Technique"), technique(one universal prompt improvement method), before_example(weak vague prompt), after_example(improved specific prompt at least 80 chars)
slide_10: verdict, save_cta, follow_cta, comment_question`,
    C: `slide_1: label("TUTORIAL" or "STEP BY STEP"), headline("How to [Achieve Specific Result] With AI"), subtitle("Copy my exact workflow")
slide_2: deliverable(specific output the reader will have), tools_needed(list real tools by name), time_required, skill_level("Beginner ✅")
slides 3-8 (6 steps): step_number(01-06), step_title, action(exact what to do), exact_input(the REAL URL/prompt/command to type — not a description), expected_output(what you see), common_mistake(one specific mistake to avoid)
slide_9: before_state(old painful way), after_state(new AI result), time_saved, quality_note
slide_10: verdict, save_cta, follow_cta, comment_question`,
    D: `slide_1: label("MYTH vs FACT" or "REALITY CHECK"), headline("[N] AI Myths Holding You Back"), subtitle(hook about what will be revealed)
slides 2-6 (5 myths): myth_text(specific believable wrong belief people hold — not vague), truth_text(real fact with specific stat or example), why_it_matters(1 sentence impact)
slide_7: title("The Biggest One Nobody Talks About"), myth_text(most shocking myth), truth_text(most surprising truth), impact(how this affects careers or income RIGHT NOW)
slide_8: title("What To Do Instead"), action_1(specific), action_2(specific), action_3(specific)
slide_9: title("Reality Check"), honest_summary(2-3 balanced sentences about AI today), bottom_line(one powerful closing statement)
slide_10: verdict, comment_trigger("Which myth surprised you most? Comment 1, 2, 3, 4 or 5 👇"), save_cta, follow_cta`,
    E: `slide_1: label("VS" or "COMPARISON" or "HONEST REVIEW"), headline("[REAL Tool A] vs [REAL Tool B]: The Honest Truth"), subtitle("I tested both for 30 days. Here's what I found.")
slide_2: tool_a(real tool name), tool_b(real tool name), categories_tested(4-5 specific tasks as string), disclaimer("Not sponsored. Here's what I actually found:")
slides 3-7 (5 categories): category(specific task), winner(which tool wins), tool_a_score("X/10" specific number), tool_a_reason(why), tool_b_score("X/10" specific), tool_b_reason(why), key_difference(decisive factor)
slide_8: tool_a_wins_for(use cases), tool_b_wins_for(use cases), overall_winner, verdict_reason
slide_9: for_students(which tool and why), for_professionals, for_budget, for_power_users
slide_10: verdict, comment_trigger("Comment A or B — which one are you using? 👇"), save_cta, follow_cta`,
  };

  return `You are the chief content officer for @learnwithmanii, an Instagram page teaching AI to students and professionals (18-35 yr olds).

NEWS: ${h}
SUMMARY: ${s}
SOURCE: ${src}
IMPACT: ${imp}
CATEGORY: ${cat}

Generate a 10-slide PATTERN ${pattern} (${pName}) Instagram carousel.

CRITICAL RULES — breaking any of these means the content is rejected:
- NEVER write "..." in any field — always write complete sentences
- NEVER use placeholder text: [string], [ToolName], [URL], your_, undefined, null
- prompt_text fields must be REAL, SPECIFIC, COPY-PASTEABLE prompts of at least 100 characters — write the ACTUAL PROMPT TEXT not a description
- All steps/actions need EXACT details: real URLs, real tool names, real commands
- Minimum 50 characters per descriptive field
- Every slide must make the reader NEED to see the next one

SLIDE INSTRUCTIONS:
${instructions[pattern]}

Also generate:
- caption with fields: hook (scroll-stopping first line), body (3 short paragraphs), engagement_prompt (specific question), save_prompt (why to save), call_to_action, full_caption (assembled with all parts)
- hashtags: array of exactly 25 relevant hashtags

Fill in ALL empty fields in this JSON structure. Return ONLY valid JSON — no markdown, no explanation, no code fences:

${schemaByPattern[pattern]}`;
}

// ─────────────────────────────────────────
// GENERATE SINGLE POST
// ─────────────────────────────────────────
async function generatePostContent(newsItem, rank, options = {}) {
  const pattern = selectPattern(newsItem, options.pattern);
  const theme = options.theme || 'default';
  console.log(`  📝 Pattern ${pattern} (${PATTERN_NAMES[pattern]}) — ${newsItem.headline.substring(0, 55)}`);

  try {
    const { text } = await callGemini(buildPrompt(pattern, newsItem, rank), 'content');

    // Strip markdown fences if present
    let jsonStr = text;
    const fenceMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (fenceMatch) jsonStr = fenceMatch[1];

    const block = jsonStr.match(/\{[\s\S]*\}/);
    if (!block) throw new Error('No JSON object in Gemini response');

    const post = JSON.parse(block[0]);

    // Ensure required metadata
    post.post_id    = post.post_id || `post_${rank}_${Date.now()}`;
    post.rank       = rank;
    post.pattern    = pattern;
    post.pattern_name = PATTERN_NAMES[pattern];
    post.theme      = theme;
    post.generated_at = new Date().toISOString();
    post.headline   = post.headline || newsItem.headline;
    post.category   = post.category || newsItem.category || 'AI';
    post.emoji      = post.emoji    || newsItem.emoji    || '🤖';

    if (!post.caption) post.caption = {};
    if (!post.caption.call_to_action) post.caption.call_to_action = 'Follow @learnwithmanii + tag a friend who needs this';
    if (!post.hashtags || post.hashtags.length < 20) post.hashtags = buildHashtags(newsItem, pattern);

    buildFullCaption(post);
    console.log(`  ✅ Pattern ${pattern} generated OK`);
    return post;

  } catch (err) {
    console.error(`  ❌ Pattern ${pattern} failed (rank ${rank}): ${err.message}`);
    console.log(`  🔄 Falling back to guaranteed content...`);
    return buildGuaranteedFallback(newsItem, rank, pattern);
  }
}

// ─────────────────────────────────────────
// GENERATE ALL POSTS
// ─────────────────────────────────────────
async function generateAllContent(filteredNews, options = {}) {
  const items = filteredNews?.selected_items || filteredNews?.news_items || filteredNews || [];
  if (!items || items.length === 0) {
    console.error('❌ No items to generate');
    return { posts: [], total: 0, patterns_used: {} };
  }

  console.log(`\n📝 Generating ${items.length} posts | Pattern: ${options.pattern || 'auto'} | Theme: ${options.theme || 'default'}`);

  const posts = [];
  const patterns_used = {};

  for (let i = 0; i < items.length; i++) {
    const newsItem = items[i];
    const rank = i + 1;
    try {
      console.log(`\n[${rank}/${items.length}] ${newsItem.headline?.substring(0, 60)}`);
      const post = await generatePostContent(newsItem, rank, options);
      posts.push(post);
      const p = post.pattern || 'unknown';
      patterns_used[p] = (patterns_used[p] || 0) + 1;
      console.log(`   ✅ Done — Pattern ${p} (${PATTERN_NAMES[p] || p})`);
    } catch (err) {
      console.error(`   ❌ Rank ${rank} error: ${err.message}`);
    }
  }

  console.log('\n📊 Pattern usage:');
  for (const [p, count] of Object.entries(patterns_used)) {
    console.log(`   ${p} (${PATTERN_NAMES[p] || p}): ${count} post(s)`);
  }

  return { posts, total: posts.length, patterns_used, generated_at: new Date().toISOString() };
}

module.exports = { generatePostContent, generateAllContent, selectPattern, PATTERN_NAMES };
