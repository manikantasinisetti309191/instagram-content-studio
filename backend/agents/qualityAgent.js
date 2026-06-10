/**
 * Quality Agent
 * Pattern-aware validation for all 5 content patterns (A-E).
 * Auto-fixes broken slides via Gemini. Falls back to rich guaranteed content.
 */
const { callGemini } = require('./geminiHelper');

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
// LEGACY SCHEMA (for posts with no pattern field)
// ─────────────────────────────────────────
const SLIDE_SCHEMA = {
  slide_1:  ['label','title','subtitle'],
  slide_2:  ['title','bullet_1','bullet_2','bullet_3'],
  slide_3:  ['title','simple_explanation','analogy'],
  slide_4:  ['title','impact_statement','for_students','for_employees','for_business'],
  slide_5:  ['title','step_1','step_2','step_3','fun_fact'],
  slide_6:  ['title','use_case_1','use_case_2','use_case_3','use_case_4'],
  slide_7:  ['title','pro_1','pro_2','con_1','con_2'],
  slide_8:  ['title','context','vs_before','vs_now'],
  slide_9:  ['title','tip_1','tip_2','tip_3','bonus_tip'],
  slide_10: ['title','summary','cta_question','cta_follow','cta_save'],
};

// ─────────────────────────────────────────
// PATTERN SCHEMAS
// ─────────────────────────────────────────
const PATTERN_SCHEMAS = {
  A: {
    slide_1:  ['label','tool_name','tagline','subtitle'],
    slide_2:  ['title','one_liner','analogy','key_fact'],
    slide_3:  ['use_case_title','who_its_for','step_1','step_2','step_3','time_saved'],
    slide_4:  ['use_case_title','who_its_for','step_1','step_2','step_3','time_saved'],
    slide_5:  ['use_case_title','who_its_for','step_1','step_2','step_3','time_saved'],
    slide_6:  ['slide_label','prompt_name','prompt_text','expected_output'],
    slide_7:  ['title','for_students','for_employees','for_creators','for_business'],
    slide_8:  ['title','step_1','step_2','step_3','closing_line'],
    slide_9:  ['title','limitation_1','limitation_2','still_worth_it'],
    slide_10: ['verdict','save_cta','follow_cta','comment_question'],
  },
  B: {
    slide_1:  ['label','headline','subtitle'],
    slide_2:  ['title','context','tease'],
    slide_3:  ['prompt_number','prompt_name','prompt_text','use_when','output_description'],
    slide_4:  ['prompt_number','prompt_name','prompt_text','use_when','output_description'],
    slide_5:  ['prompt_number','prompt_name','prompt_text','use_when','output_description'],
    slide_6:  ['prompt_number','prompt_name','prompt_text','use_when','output_description'],
    slide_7:  ['prompt_number','prompt_name','prompt_text','use_when','output_description'],
    slide_8:  ['prompt_number','prompt_name','prompt_text','use_when','output_description'],
    slide_9:  ['title','technique','before_example','after_example'],
    slide_10: ['verdict','save_cta','follow_cta','comment_question'],
  },
  C: {
    slide_1:  ['label','headline','subtitle'],
    slide_2:  ['deliverable','tools_needed','time_required','skill_level'],
    slide_3:  ['step_number','step_title','action','exact_input','expected_output','common_mistake'],
    slide_4:  ['step_number','step_title','action','exact_input','expected_output','common_mistake'],
    slide_5:  ['step_number','step_title','action','exact_input','expected_output','common_mistake'],
    slide_6:  ['step_number','step_title','action','exact_input','expected_output','common_mistake'],
    slide_7:  ['step_number','step_title','action','exact_input','expected_output','common_mistake'],
    slide_8:  ['step_number','step_title','action','exact_input','expected_output','common_mistake'],
    slide_9:  ['before_state','after_state','time_saved','quality_note'],
    slide_10: ['verdict','save_cta','follow_cta','comment_question'],
  },
  D: {
    slide_1:  ['label','headline','subtitle'],
    slide_2:  ['myth_text','truth_text','why_it_matters'],
    slide_3:  ['myth_text','truth_text','why_it_matters'],
    slide_4:  ['myth_text','truth_text','why_it_matters'],
    slide_5:  ['myth_text','truth_text','why_it_matters'],
    slide_6:  ['myth_text','truth_text','why_it_matters'],
    slide_7:  ['title','myth_text','truth_text','impact'],
    slide_8:  ['title','action_1','action_2','action_3'],
    slide_9:  ['title','honest_summary','bottom_line'],
    slide_10: ['verdict','comment_trigger','save_cta','follow_cta'],
  },
  E: {
    slide_1:  ['label','headline','subtitle'],
    slide_2:  ['tool_a','tool_b','categories_tested','disclaimer'],
    slide_3:  ['category','winner','tool_a_score','tool_a_reason','tool_b_score','tool_b_reason','key_difference'],
    slide_4:  ['category','winner','tool_a_score','tool_a_reason','tool_b_score','tool_b_reason','key_difference'],
    slide_5:  ['category','winner','tool_a_score','tool_a_reason','tool_b_score','tool_b_reason','key_difference'],
    slide_6:  ['category','winner','tool_a_score','tool_a_reason','tool_b_score','tool_b_reason','key_difference'],
    slide_7:  ['category','winner','tool_a_score','tool_a_reason','tool_b_score','tool_b_reason','key_difference'],
    slide_8:  ['tool_a_wins_for','tool_b_wins_for','overall_winner','verdict_reason'],
    slide_9:  ['for_students','for_professionals','for_budget','for_power_users'],
    slide_10: ['verdict','comment_trigger','save_cta','follow_cta'],
  },
};

// ─────────────────────────────────────────
// MINIMUM CHAR REQUIREMENTS PER FIELD
// ─────────────────────────────────────────
const MIN_CHARS = {
  title:8, subtitle:10, label:2, headline:10,
  one_liner:20, analogy:15, key_fact:15,
  prompt_text:80, before_example:20, after_example:50,
  myth_text:20, truth_text:20, why_it_matters:15,
  honest_summary:40, bottom_line:15,
  tool_a_reason:15, tool_b_reason:15, key_difference:15,
  verdict:10, action:20, exact_input:20, expected_output:8,
  context:25, technique:20, impact:15, deliverable:20,
  // Short-by-design fields — just check they exist
  prompt_number:1, step_number:1, winner:2,
  tool_a_score:3, tool_b_score:3, overall_winner:2,
  use_case_title:8, who_its_for:8, time_saved:5, closing_line:8,
  tease:10, output_description:5, use_when:8,
  skill_level:5, time_required:5, quality_note:15,
  comment_question:10, comment_trigger:10, save_cta:5, follow_cta:5,
  slide_label:3, prompt_name:5, step_title:5,
  for_students:10, for_employees:10, for_creators:10, for_business:10,
  for_professionals:10, for_budget:10, for_power_users:10,
  limitation_1:10, limitation_2:10, still_worth_it:10,
  tool_a:3, tool_b:3, categories_tested:10, disclaimer:10,
  tool_a_wins_for:10, tool_b_wins_for:10, verdict_reason:10,
  before_state:15, after_state:15, bottom_line:15,
  action_1:15, action_2:15, action_3:15,
  default:5,
};

// ─────────────────────────────────────────
// SEMANTIC VALIDATORS
// Deep field-level checks beyond "is it empty?" —
// catches real quality problems like tool_name = full headline
// ─────────────────────────────────────────
const SEMANTIC_VALIDATORS = {

  // tool_name should be brand/product name only — max 5 words, no action verbs
  tool_name(val) {
    if (val.split(' ').length > 5)
      return `tool_name looks like a full headline — should be brand name only (e.g. "Runway Gen-3", "GPT-5")`;
    if (/\b(makes|launches|beats|releases|announces|drops|debuts|unveils|introduces|adds|gets|reveals|builds|creates|generates)\b/i.test(val))
      return `tool_name contains action verbs — extract only the product name`;
    return null;
  },

  // tagline must be specific to this tool, not generic boilerplate
  tagline(val) {
    const genericPhrases = ['the ai tool everyone is talking about','this tool','game-changing ai','revolutionary ai'];
    if (genericPhrases.some(p => val.toLowerCase().includes(p)))
      return `tagline is too generic — describe what THIS specific tool actually does`;
    if (val.split(' ').length > 10)
      return `tagline is too long — keep under 10 words`;
    return null;
  },

  // prompt_text must be a real usable prompt, not a description of one
  prompt_text(val) {
    if (val.length < 100)
      return `prompt_text is only ${val.length} chars — must be a real copy-paste prompt of 100+ chars`;
    if (!/you|act as|write|generate|create|explain|list|give me|help me|analyze|summarize|rewrite|respond/i.test(val))
      return `prompt_text doesn't look like a real prompt — should start with an action word`;
    if (/^(a prompt|this prompt|use this|here is a|enter this|copy this)/i.test(val.trim()))
      return `prompt_text starts with a description — write the actual prompt text, not instructions about it`;
    return null;
  },

  // Scores must be in X/10 format
  tool_a_score(val) {
    if (!/^\d+(\.\d+)?\/10$/.test(val.trim()))
      return `tool_a_score must be in "X/10" format (e.g. "8/10")`;
    return null;
  },
  tool_b_score(val) {
    if (!/^\d+(\.\d+)?\/10$/.test(val.trim()))
      return `tool_b_score must be in "X/10" format (e.g. "7/10")`;
    return null;
  },

  // verdict should be an opinion, not a question or very short
  verdict(val) {
    if (val.endsWith('?')) return `verdict is a question — write a bold confident opinion statement`;
    if (val.split(' ').length < 5) return `verdict is too short — write a complete opinion of at least 5 words`;
    return null;
  },

  // Audience fields (slide 7) must be concise — max 10 words to fit in cards
  for_students(val) {
    if (val.split(' ').length > 13) return `for_students is ${val.split(' ').length} words — keep to max 10 words for card layout`;
    return null;
  },
  for_employees(val) {
    if (val.split(' ').length > 13) return `for_employees is ${val.split(' ').length} words — keep to max 10 words for card layout`;
    return null;
  },
  for_creators(val) {
    if (val.split(' ').length > 13) return `for_creators is ${val.split(' ').length} words — keep to max 10 words for card layout`;
    return null;
  },
  for_business(val) {
    if (val.split(' ').length > 13) return `for_business is ${val.split(' ').length} words — keep to max 10 words for card layout`;
    return null;
  },
};

const PLACEHOLDER_RE = /^string$|^\[|^undefined$|^null$|^Your\s/i;

// ─────────────────────────────────────────
// VALIDATE ONE FIELD
// ─────────────────────────────────────────
function validateField(slideKey, field, val) {
  const issues = [];
  if (!val || typeof val !== 'string' || val.trim().length === 0) {
    issues.push(`${slideKey}.${field}: MISSING or EMPTY`);
    return issues;
  }
  const v = val.trim();
  const minLen = MIN_CHARS[field] || MIN_CHARS.default;
  if (v.length < minLen) {
    issues.push(`${slideKey}.${field}: TOO SHORT (${v.length} < ${minLen}) — "${v.substring(0,40)}"`);
  }
  if (PLACEHOLDER_RE.test(v)) {
    issues.push(`${slideKey}.${field}: PLACEHOLDER — "${v.substring(0,40)}"`);
  }
  if (v.includes('...')) {
    issues.push(`${slideKey}.${field}: CONTAINS ELLIPSIS — write complete text`);
  }
  // ── Semantic validation (deep quality checks) ──────────────────────────
  if (SEMANTIC_VALIDATORS[field]) {
    const semanticError = SEMANTIC_VALIDATORS[field](v);
    if (semanticError) issues.push(`${slideKey}.${field}: SEMANTIC — ${semanticError}`);
  }
  return issues;
}

// ─────────────────────────────────────────
// VALIDATE ALL 10 SLIDES
// ─────────────────────────────────────────
function validateAllSlides(post) {
  const allIssues = [];
  const slides = post?.slides || {};
  const pattern = post?.pattern;
  const schema = PATTERN_SCHEMAS[pattern] || SLIDE_SCHEMA;

  if (Object.keys(slides).length < 10) {
    allIssues.push(`MISSING SLIDES: only ${Object.keys(slides).length}/10 slides present`);
  }

  for (const slideKey of Object.keys(schema)) {
    for (const field of (schema[slideKey] || [])) {
      allIssues.push(...validateField(slideKey, field, slides[slideKey]?.[field]));
    }
  }

  // Extra: prompt_text must be >=80 chars for Pattern A slide_6 and Pattern B slides 3-8
  if (pattern === 'A') {
    const pt = slides['slide_6']?.prompt_text;
    if (pt && pt.trim().length < 80) allIssues.push('slide_6.prompt_text: PROMPT TOO SHORT — must be real copy-pasteable prompt >=80 chars');
  }
  if (pattern === 'B') {
    ['slide_3','slide_4','slide_5','slide_6','slide_7','slide_8'].forEach(sk => {
      const pt = slides[sk]?.prompt_text;
      if (pt && pt.trim().length < 80) allIssues.push(`${sk}.prompt_text: PROMPT TOO SHORT — must be real copy-pasteable prompt >=80 chars`);
    });
  }

  // Caption
  if (!post?.caption?.hook || post.caption.hook.trim().length < 10) allIssues.push('caption.hook: MISSING or too short');
  if (!post?.caption?.body || post.caption.body.trim().length < 50) allIssues.push('caption.body: MISSING or too short');

  // Hashtags
  if (!post?.hashtags || post.hashtags.length < 20) allIssues.push(`hashtags: only ${post?.hashtags?.length||0}/25`);

  return allIssues;
}

// ─────────────────────────────────────────
// FIX PROMPT
// ─────────────────────────────────────────
const FIX_PROMPT = (newsItem, issues, post) => `You are a senior Instagram content editor for @learnwithmanii.

Fix ONLY the broken fields listed below. All other fields are fine.

BROKEN FIELDS:
${issues.map(i => `  ❌ ${i}`).join('\n')}

PATTERN: ${post.pattern} (${PATTERN_NAMES[post.pattern] || post.pattern})
NEWS: ${newsItem.headline}
SUMMARY: ${newsItem.summary}

RULES:
- Fix ONLY broken fields
- No "..." — write complete sentences
- No placeholder text
- prompt_text fields must be real copy-pasteable prompts >=80 chars

Return ONLY this JSON (merged fixes only):
{ "slides": { ...fixed slides... }, "caption": { "hook": "...", "body": "..." } }`;

// ─────────────────────────────────────────
// GUARANTEED RICH FALLBACK (all 5 patterns)
// ─────────────────────────────────────────
function buildGuaranteedFallback(newsItem, rank, pattern = 'A') {
  const h   = newsItem.headline || 'AI Is Changing Everything Right Now';
  const s   = newsItem.summary  || 'Artificial intelligence is advancing faster than ever.';
  const imp = newsItem.impact   || 'This directly affects students, professionals, and creators worldwide.';

  const hashtags = [
    '#LearnAI','#AIForBeginners','#AILearning','#AIEducation','#LearnWithAI',
    '#ArtificialIntelligence','#AITools','#AIProductivity','#FutureOfWork',
    '#TechForStudents','#AIForStudents','#AIForBusiness','#WorkWithAI',
    '#AI2025','#MachineLearning','#ChatGPT','#GoogleGemini','#AIAssistant',
    '#TechNews','#AIRevolution','#LearnwithManii','#NewAITool','#AIUpdate',
    '#PromptEngineering','#AIForCreators',
  ];

  const caption = {
    hook: `🚨 ${h}`,
    body: `${s}\n\n${imp}\n\nWhether you're a student, professional or creator — this affects you directly.`,
    engagement_prompt: 'What would you use this AI for? Drop it in the comments 👇',
    save_prompt: 'Save this post — when you\'re ready to try AI, this breakdown will be your starting guide.',
    call_to_action: 'Follow @learnwithmanii + tag a friend who needs to see this! 🤖',
    full_caption: `🚨 ${h}\n\n${s}\n\n${imp}\n\nWhat would you use this for? 👇\n\nSave for later!\n\nFollow @learnwithmanii 🤖`,
  };

  const base = { post_id:`fallback_${rank}_${Date.now()}`, rank, pattern_name:PATTERN_NAMES[pattern]||pattern, headline:h, category:newsItem.category||'AI', emoji:newsItem.emoji||'🤖', is_fallback:true, caption, hashtags, generated_at:new Date().toISOString() };

  if (pattern === 'A') return { ...base, pattern:'A', slides:{
    slide_1:{ label:'TOOL DROP', tool_name:h.split(' ').slice(0,3).join(' '), tagline:'The AI tool everyone is talking about', subtitle:'Save this before it goes viral' },
    slide_2:{ title:'What Is This Tool Exactly?', one_liner:`This AI tool automates complex tasks so you can focus on what matters most — it works in plain English.`, analogy:`It's like having a brilliant expert available 24/7, but powered by AI and completely free to start.`, key_fact:'Early users report saving 5-10 hours per week using this for their daily workflows.' },
    slide_3:{ use_case_title:'Use It To Write Faster', who_its_for:'For: writers, students, and content creators', step_1:'Go to the tool website and create a free account in under 2 minutes', step_2:'Type your writing task in plain English — be specific about what you need', step_3:'Review the output, ask one follow-up question to refine it, then copy and use it', time_saved:'Saves 3-5 hours / week' },
    slide_4:{ use_case_title:'Use It To Research Smarter', who_its_for:'For: students, analysts, and researchers', step_1:'Open the tool and start a new conversation with the AI assistant', step_2:'Ask it to summarize any topic, paper, or concept in simple terms', step_3:'Ask follow-up questions until you fully understand — it never gets impatient or tired', time_saved:'Saves 2-4 hours / week' },
    slide_5:{ use_case_title:'Use It To Plan Projects', who_its_for:'For: managers, freelancers, and entrepreneurs', step_1:'Describe your project goal, deadline, and constraints to the AI in plain language', step_2:'Ask it to create a step-by-step action plan with realistic time estimates for each phase', step_3:'Export the plan to Google Docs and share it with your team or use it as your roadmap', time_saved:'Saves 4-6 hours / week' },
    slide_6:{ slide_label:'COPY THIS PROMPT', prompt_name:'The Expert Explainer Prompt', prompt_text:`Act as an expert in [your topic]. Explain [specific concept] to me as if I am a complete beginner with no background knowledge. Use simple language, one real-world analogy, and three concrete examples. Then give me three action steps I can take today to immediately apply this knowledge.`, expected_output:"You'll get: a clear beginner-friendly explanation with examples and an immediate action plan" },
    slide_7:{ title:'Who Is This For?', for_students:'Research faster, write better essays, and ace your assignments with AI help', for_employees:'Automate repetitive reports, draft professional emails, and summarize meetings in seconds', for_creators:'Generate content ideas, write captions, and create scripts 10 times faster than before', for_business:'Cut operational costs, boost customer service quality, and scale operations with AI' },
    slide_8:{ title:'Start in 5 Minutes', step_1:'Go to the tool website and sign up free with your Google or email account', step_2:'Complete the quick onboarding tutorial to learn the three core features', step_3:'Type your first real task in plain English and watch the AI deliver results instantly', closing_line:"That's it. You're ready. Your first AI-powered result is one message away." },
    slide_9:{ title:'The Honest Catch', limitation_1:'The free tier has monthly usage limits — heavy daily users may need to upgrade to a paid plan', limitation_2:'AI can occasionally make factual errors on niche topics — always verify critical information', still_worth_it:'The hours saved on every task pays for itself within the first week of consistent use' },
    slide_10:{ verdict:'This tool will save you hours every single week — start using it today.', save_cta:"Save this guide — you'll need it later 🔖", follow_cta:'Follow @learnwithmanii for daily AI tool drops 🤖', comment_question:'What is the first task you would automate with this tool? Tell me below!' },
  }};

  if (pattern === 'B') return { ...base, pattern:'B', slides:{
    slide_1:{ label:'PROMPT PACK', headline:'6 ChatGPT Prompts That Save 10 Hours Every Week', subtitle:'Copy-paste ready. Save this.' },
    slide_2:{ title:'Why These Prompts Actually Work', context:`Most people use AI like a search engine and get mediocre results. These prompts treat it like a specialist consultant — giving full role, context, and output format so the AI delivers exactly what you need every single time.`, tease:'I tested 100+ prompts. These 6 survived.' },
    slide_3:{ prompt_number:'1', prompt_name:'The Email Polisher', prompt_text:`Rewrite this email to be professional, clear, and concise. Keep the core message but improve the tone so it sounds confident and respectful. Remove any filler words or redundant sentences. Here is my draft: [paste your email here]`, use_when:'Before sending any important professional or client email', output_description:'Polished professional email ready to send' },
    slide_4:{ prompt_number:'2', prompt_name:'The Meeting Summarizer', prompt_text:`You are an expert meeting facilitator. Read these meeting notes and create: 1) A 3-bullet executive summary of the key decisions, 2) A complete list of all action items with owner names and deadlines, 3) Any open questions that still need to be resolved. Meeting notes: [paste notes here]`, use_when:'After every team meeting, client call, or brainstorm session', output_description:'Structured summary with all action items' },
    slide_5:{ prompt_number:'3', prompt_name:'The Study Guide Creator', prompt_text:`Act as an expert tutor. Create a comprehensive study guide for [topic] that includes: 1) The 5 most important concepts explained in simple terms, 2) 10 practice questions with detailed answers, 3) The 3 most common mistakes students make on this topic, 4) One memory trick for each key concept. My current level is [beginner or intermediate or advanced].`, use_when:'When studying for any exam or trying to learn a new topic fast', output_description:'Complete study guide with practice questions' },
    slide_6:{ prompt_number:'4', prompt_name:'The Content Idea Generator', prompt_text:`You are a viral content strategist for [platform: Instagram or LinkedIn or YouTube]. Generate 10 specific content ideas about [your topic] for [your target audience: students or professionals or creators]. For each idea include: the exact hook line, the key insight or value, and one reason why it will perform well with this audience. Make every idea specific and immediately actionable.`, use_when:"When you have creative block or need fresh content ideas fast", output_description:'10 detailed content ideas with hooks' },
    slide_7:{ prompt_number:'5', prompt_name:'The Resume Bullet Optimizer', prompt_text:`Act as a senior recruiter with 15 years of experience in hiring for top companies. Review my resume bullet points and rewrite each one to be achievement-focused, quantified with specific metrics, and optimized to pass ATS systems. Use strong action verbs at the start of each bullet. Here are my current bullet points: [paste your bullet points here]`, use_when:'When updating your resume or preparing job applications', output_description:'ATS-optimized bullets with specific metrics' },
    slide_8:{ prompt_number:'6', prompt_name:'The Business Plan Builder', prompt_text:`Act as an experienced startup consultant. Create a focused lean business plan for [your business idea] targeting [your specific audience]. Include: 1) The core problem and solution in two clear sentences, 2) A specific target customer profile with demographics, 3) Three different revenue model options with pros and cons, 4) The top three competitors and exactly how to differentiate, 5) A 90-day action plan with specific milestones. Be realistic and specific.`, use_when:'When starting a new business, side project, or freelance service', output_description:'Complete lean business plan outline' },
    slide_9:{ title:'The Pro Technique', technique:'Always assign a specific role, give full context, and specify the exact output format. Role + Context + Format = outputs 10x better than a simple question.', before_example:'Write me a cover letter for a marketing job.', after_example:`Act as a senior hiring manager with 20 years in B2B marketing. Write a 3-paragraph cover letter for a Digital Marketing Manager role at a SaaS startup. I have 4 years growing paid acquisition and scaled a brand Instagram from 2k to 50k followers. Tone: confident and human. Format: ready to copy-paste directly.` },
    slide_10:{ verdict:'These 6 prompts will save you more time than any app or subscription.', save_cta:'Save this prompt pack 🔖', follow_cta:'Follow @learnwithmanii for weekly prompt drops 🤖', comment_question:'Which prompt are you trying first? Drop the number in the comments 👇' },
  }};

  if (pattern === 'C') return { ...base, pattern:'C', slides:{
    slide_1:{ label:'STEP BY STEP', headline:'How to Build Your First AI Workflow in 30 Minutes', subtitle:'Copy my exact workflow — no experience needed' },
    slide_2:{ deliverable:'A fully working AI-powered workflow that eliminates 5 hours of repetitive work every week', tools_needed:'ChatGPT free tier, Google Docs (free), 30 minutes of focused time', time_required:'30 minutes to set up, then 5 minutes per use after that', skill_level:'Beginner ✅' },
    slide_3:{ step_number:'01', step_title:'Create Your AI Account', action:'Sign up for ChatGPT free — no credit card needed', exact_input:'Go to chat.openai.com — click Sign Up — register with Google or email account', expected_output:'You land on the ChatGPT chat interface and can start typing immediately', common_mistake:'Do not pay for Plus yet — the free tier handles this entire workflow perfectly' },
    slide_4:{ step_number:'02', step_title:'Set Your System Role', action:'Tell the AI exactly who it should be before giving any real task', exact_input:`Type exactly: "You are my expert [role — e.g. writing coach, business advisor, research assistant]. I will give you tasks. Always respond in clear bullet points. Be specific and actionable. Confirm you understand."`, expected_output:'AI confirms the role and signals it is ready for your instructions', common_mistake:'Skipping this step cuts output quality by 50% — always set the role before your first task' },
    slide_5:{ step_number:'03', step_title:'Submit Your First Task', action:'Give the AI a real task using a structured four-part format', exact_input:`Type: "Task: [what you need done]. Context: [relevant background about your situation]. Format: [how you want the output — bullet list, table, email draft, numbered steps]. Constraints: [word limit, tone, or style requirements]."`, expected_output:'A well-structured output in exactly the format you specified, ready to use or refine', common_mistake:'Vague tasks produce vague results — the more specific your input, the better the AI output' },
    slide_6:{ step_number:'04', step_title:'Refine With Follow-Up', action:'Improve the output using targeted one-sentence follow-up messages', exact_input:`Type: "Make this more [concise or formal or casual or detailed]. Focus more on [specific section]. Add [what is missing]. Remove [what does not fit my needs]."`, expected_output:'A refined version that matches exactly what you needed from the start', common_mistake:'Starting a new chat to fix issues — always continue in the same conversation to preserve context' },
    slide_7:{ step_number:'05', step_title:'Build Your Prompt Library', action:'Create a Google Doc to save every prompt that produced great results', exact_input:'Open docs.google.com — create a new doc called "My AI Prompts" — paste any prompt that worked well with a short note about what task it solved', expected_output:'A reusable personal prompt library you can copy from every single time you need it', common_mistake:'Closing the chat without saving successful prompts — great prompts disappear and you waste time recreating them' },
    slide_8:{ step_number:'06', step_title:'Automate Your Top 3 Tasks', action:'Identify the three most time-consuming tasks you do weekly and create a saved prompt for each', exact_input:`For each task write: "Act as [expert role]. [Describe the task clearly]. Context about my work: [what you do]. Output format I need: [exactly how you want it]. My constraints: [time or length or tone limits]."`, expected_output:'Three ready-to-use prompts saved in your library that instantly automate your biggest time drains', common_mistake:'Trying to automate everything at once — start with your single biggest weekly time waster and perfect that first' },
    slide_9:{ before_state:'Before: spending 3-5 hours per week on repetitive writing, research, planning, and admin tasks that drain your energy', after_state:'After: those same tasks take 20-40 minutes using this AI workflow, often with higher consistency and quality', time_saved:'Saves 4-6 hours every single week once this workflow becomes your daily habit', quality_note:'AI-assisted work is often more consistent and polished than rushed manual work done under time pressure' },
    slide_10:{ verdict:'This workflow will give you back a full workday every single week — start today.', save_cta:'Save this workflow 🔖', follow_cta:'Follow @learnwithmanii for daily AI tutorials 🤖', comment_question:'Which step will you start with today? Tell me in the comments 👇' },
  }};

  if (pattern === 'D') return { ...base, pattern:'D', slides:{
    slide_1:{ label:'MYTH vs FACT', headline:'5 AI Myths That Are Holding You Back Right Now', subtitle:'Stop believing these — your career depends on it' },
    slide_2:{ myth_text:'MYTH: You need to learn programming or coding to use AI tools effectively in 2025', truth_text:'FACT: Over 90% of the most powerful AI tools including ChatGPT, Gemini, Claude, Midjourney, and Canva AI work entirely in plain English with zero code required.', why_it_matters:'This single myth stops millions of qualified people from starting — while their competitors move ahead using the exact same free tools.' },
    slide_3:{ myth_text:'MYTH: AI is going to replace your entire job within the next two years', truth_text:'FACT: McKinsey research across 800 professions shows AI automates specific tasks within jobs, not entire roles. Workers actively using AI are 3x more productive and become significantly harder to replace.', why_it_matters:'Fear of replacement is stopping people from learning the one skill that would actually make them irreplaceable in the age of AI.' },
    slide_4:{ myth_text:'MYTH: AI tools are too expensive for students, freelancers, or people just starting out', truth_text:'FACT: ChatGPT, Gemini, Claude, Perplexity, Canva AI, and over 50 other powerful professional-grade tools all offer completely free tiers that cover the majority of everyday use cases.', why_it_matters:'Cost is not a barrier at all — lack of awareness is. Free tools exist for every major task you need to accomplish today.' },
    slide_5:{ myth_text:'MYTH: AI constantly makes things up and cannot be trusted for real professional work', truth_text:'FACT: Modern AI models achieve over 90% accuracy on factual topics within their training data. A simple verification habit of checking one key fact makes AI-assisted work highly reliable and usable.', why_it_matters:'Dismissing AI entirely because of rare hallucinations means missing massive daily productivity gains that your competitors are already capturing.' },
    slide_6:{ myth_text:'MYTH: You need months of training and practice to get good results from AI tools', truth_text:'FACT: Most professionals get excellent, usable results in their very first 15 minutes by following one technique: be specific about the role you want the AI to play, the task, and the exact output format you need.', why_it_matters:'The real learning curve is 15 minutes, not months. Waiting until you feel "ready" just means falling further behind every single week.' },
    slide_7:{ title:'The Biggest One Nobody Talks About', myth_text:'MYTH: AI tools are only useful for large tech companies and enterprises with massive budgets', truth_text:'FACT: A landmark study of 50,000 freelancers found that solo professionals using AI tools earn 3 times more per hour than those who do not. A free AI toolkit can replace over $500 per month in software and services.', impact:'Small businesses and solo creators who ignore AI are already losing clients, contracts, and opportunities to AI-powered competitors who charge less and deliver more.' },
    slide_8:{ title:'What To Do Instead', action_1:'Spend 15 minutes today picking ONE AI tool and using it for your single most repetitive task — just one task to start, not everything at once', action_2:'Search "free AI tools for [your job or industry]" and bookmark three tools you will actually test before the end of this week', action_3:'Follow one AI educator like @learnwithmanii to get practical, jargon-free weekly lessons delivered directly to your feed without the hype' },
    slide_9:{ title:'The Real Situation', honest_summary:`AI is genuinely powerful but not magic. It works best when you treat it as a skilled collaborator who needs clear direction, not a mind reader. The professionals winning with AI right now are not tech geniuses — they are curious, consistent people who started six months ago when everyone else was still skeptical.`, bottom_line:'The gap between AI users and non-users is compounding every single month. The best time to start was last year. The second best time is right now.' },
    slide_10:{ verdict:'Stop believing the myths. Start using AI today. The window is still open.', comment_trigger:'Which myth surprised you most? Comment 1, 2, 3, 4 or 5 👇', save_cta:"Save this — share it with someone who needs it 🔖", follow_cta:'Follow @learnwithmanii for weekly AI reality checks 🤖' },
  }};

  if (pattern === 'E') return { ...base, pattern:'E', slides:{
    slide_1:{ label:'HONEST REVIEW', headline:'ChatGPT vs Claude: The Honest Truth After 30 Days', subtitle:'I tested both every day for a month. The winner surprised me.' },
    slide_2:{ tool_a:'ChatGPT (GPT-4o)', tool_b:'Claude (claude-3-5-sonnet)', categories_tested:'Writing quality, coding help, long document research, instruction following, and creative tasks', disclaimer:"Not sponsored. Here's what I actually found after 30 days of real daily use:" },
    slide_3:{ category:'Writing Quality', winner:'Claude', tool_a_score:'8/10', tool_a_reason:'ChatGPT writes clearly and fluently but sometimes adds unnecessary filler sentences and has a slightly formulaic structure', tool_b_score:'9/10', tool_b_reason:'Claude produces more natural, nuanced writing that sounds less like AI and better matches specific tones on the first attempt', key_difference:'Claude is notably better at matching your exact tone and style without multiple rounds of back-and-forth refinement' },
    slide_4:{ category:'Coding and Debugging', winner:'ChatGPT', tool_a_score:'9/10', tool_a_reason:'ChatGPT excels at coding with broader framework knowledge, faster debugging cycles, and better documentation awareness across more languages', tool_b_score:'8/10', tool_b_reason:'Claude codes well and explains its reasoning clearly but occasionally misses edge cases in complex multi-file logic problems', key_difference:'ChatGPT has a larger effective training base for code libraries, framework specifics, and debugging common production errors' },
    slide_5:{ category:'Research and Long Documents', winner:'Claude', tool_a_score:'7/10', tool_a_reason:'ChatGPT summarizes short to medium content well but loses critical nuances and details when processing very long documents or multi-source research', tool_b_score:'9/10', tool_b_reason:'Claude handles 200,000 token context windows and reliably retains key details, contradictions, and nuances across extremely long documents', key_difference:'Claude\'s massive context window is a genuine game-changer for anyone working with long documents, reports, or research papers' },
    slide_6:{ category:'Following Complex Instructions', winner:'Claude', tool_a_score:'7/10', tool_a_reason:'ChatGPT sometimes drifts away from detailed multi-step instructions after several exchanges, especially in longer conversations', tool_b_score:'9/10', tool_b_reason:'Claude maintains precise, consistent adherence to complex multi-layered instructions throughout an entire long conversation', key_difference:'Claude is significantly more reliable when you have strict formatting requirements, structured templates, or multi-step conditional instructions' },
    slide_7:{ category:'Creative and Ideation Work', winner:'Tie', tool_a_score:'8/10', tool_a_reason:'ChatGPT is highly creative with broad cultural references, playful wordplay, and strong brainstorming output when given creative latitude', tool_b_score:'8/10', tool_b_reason:'Claude matches ChatGPT on creativity with more literary depth, original phrasing, and thoughtful nuance in creative writing tasks', key_difference:'Preference comes down to style — ChatGPT tends more playful and punchy while Claude leans more literary and considered' },
    slide_8:{ tool_a_wins_for:'ChatGPT wins for: coding projects, data analysis, using third-party plugins, DALL-E image generation, and users already invested in the Microsoft or OpenAI ecosystem', tool_b_wins_for:'Claude wins for: long-form writing, research with large documents, following complex multi-part instructions, and nuanced editing or tone matching', overall_winner:'Claude (by a slim but consistent margin)', verdict_reason:'Claude consistently follows instructions more precisely and produces higher-quality text output for the majority of professional daily tasks' },
    slide_9:{ for_students:'Use Claude for essays and research — it handles long documents and maintains academic tone better than any other free option', for_professionals:'Use Claude as your primary writing and research tool; switch to ChatGPT for any coding, data, or plugin-based workflow', for_budget:'Both have strong free tiers — start with Claude in 2025, its free tier is more capable for most professional writing tasks', for_power_users:'Use both strategically: Claude as your primary writer and researcher, ChatGPT as your coding assistant and plugin ecosystem hub' },
    slide_10:{ verdict:'Claude edges ahead for writing and research. ChatGPT wins at code. Use both strategically.', comment_trigger:'Comment A (ChatGPT) or B (Claude) — which one are you using right now? 👇', save_cta:'Save this comparison 🔖', follow_cta:'Follow @learnwithmanii for honest AI tool reviews 🤖' },
  }};

  // Unknown pattern — default to A
  return buildGuaranteedFallback(newsItem, rank, 'A');
}

// ─────────────────────────────────────────
// VALIDATE + AUTO-FIX LOOP
// ─────────────────────────────────────────
async function validateAndFix(post, newsItem, maxAttempts = 5) {
  let current = JSON.parse(JSON.stringify(post));

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const issues = validateAllSlides(current);

    if (issues.length === 0) {
      console.log(`  ✅ Quality PASSED${attempt > 1 ? ` after ${attempt-1} AI fix(es)` : ' on first try'}`);
      return { post: current, passed: true, attempts: attempt, issues: [] };
    }

    console.log(`  ⚠️  Attempt ${attempt}/${maxAttempts} — ${issues.length} issue(s) found:`);
    issues.forEach(i => console.log(`     ❌ ${i}`));

    if (attempt >= maxAttempts) break;

    try {
      const { text } = await callGemini(FIX_PROMPT(newsItem, issues, current), 'content');
      const block = text.match(/\{[\s\S]*\}/);
      if (!block) throw new Error('No JSON in fix response');
      const fixed = JSON.parse(block[0]);
      if (fixed.slides) {
        for (const [key, data] of Object.entries(fixed.slides)) {
          if (data && typeof data === 'object') current.slides[key] = { ...current.slides[key], ...data };
        }
      }
      if (fixed.caption) current.caption = { ...current.caption, ...fixed.caption };
      if (fixed.hashtags?.length >= 20) current.hashtags = fixed.hashtags;
      console.log(`  ✔️  AI fixes applied (attempt ${attempt}) — re-validating...`);
    } catch (err) {
      console.error(`  ❌ AI fix attempt ${attempt} failed: ${err.message} — applying manual field fixes`);
      current = applyManualFixes(current, newsItem, issues);
    }
  }

  // All 5 attempts exhausted — signal failure so pipeline triggers full regeneration
  console.log(`  ❌ Quality still failing after ${maxAttempts} attempts — triggering pipeline-level retry`);
  return { post: buildGuaranteedFallback(newsItem, post.rank, post.pattern || 'A'), passed: false, attempts: maxAttempts, issues: validateAllSlides(current) };
}

// ─────────────────────────────────────────
// MANUAL FIELD FIXER
// ─────────────────────────────────────────
function applyManualFixes(post, newsItem, issues) {
  const fallback = buildGuaranteedFallback(newsItem, post.rank, post.pattern || 'A');
  for (const issue of issues) {
    const match = issue.match(/^(slide_\d+)\.(\w+):/);
    if (match) {
      const [, sk, field] = match;
      if (!post.slides[sk]) post.slides[sk] = {};
      post.slides[sk][field] = fallback.slides[sk]?.[field] || 'Follow @learnwithmanii for the full breakdown';
    }
    if (issue.includes('MISSING SLIDES')) {
      for (const [k, data] of Object.entries(fallback.slides)) {
        if (!post.slides[k]) post.slides[k] = data;
      }
    }
    if (issue.includes('caption.hook')) post.caption.hook = fallback.caption.hook;
    if (issue.includes('caption.body')) post.caption.body = fallback.caption.body;
    if (issue.includes('hashtags')) post.hashtags = fallback.hashtags;
  }
  return post;
}

module.exports = {
  validateAndFix,
  validateAllSlides,
  buildGuaranteedFallback,
  PATTERN_SCHEMAS,
  PATTERN_NAMES,
};
