/**
 * Content Generation Agent
 * Generates complete Instagram carousel content including:
 * - 5 carousel slide scripts per post
 * - Instagram captions with hooks and CTAs
 * - 30 targeted hashtags per post
 */

require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });
const { callGemini } = require('./geminiHelper');
const { buildGuaranteedFallback } = require('./qualityAgent');

const CONTENT_PROMPT = (newsItem, rank) => `You are the CHIEF CONTENT OFFICER for @learnwithmanii — a top-tier Instagram page that makes AI accessible and exciting for students, employees, engineers, and business owners. Your audience is 18–35 years old, curious, ambitious, and scroll fast.

TODAY'S NEWS:
${JSON.stringify(newsItem, null, 2)}

INSTAGRAM ANGLE: ${newsItem.instagram_angle || newsItem.headline}
KEY TEACHING POINTS: ${JSON.stringify(newsItem.key_teaching_points || [])}

━━━ CONTENT PHILOSOPHY ━━━
1. STOP THE SCROLL — every slide must earn the swipe to the next
2. MAKE IT PERSONAL — use "you/your" constantly, never "one/users"
3. NO JARGON — explain like you're texting a smart 16-year-old friend
4. ONE IDEA PER SLIDE — don't overload, make each point land perfectly
5. EMOTIONAL > INFORMATIONAL — curiosity, surprise, and FOMO beat dry facts
6. SPECIFIC > VAGUE — "saves 3 hours daily" beats "saves time"
7. SHORT SENTENCES — max 12 words per sentence, punchy and powerful

━━━ VIRAL CONTENT RULES ━━━
- Start every bullet/point with an action verb or bold claim
- Use contrast: "Before: [struggle] → Now: [solution]"
- Numbers make it credible: use stats, percentages, timeframes
- Make them feel SMART for knowing this — not dumb for not knowing before
- End every slide making them NEED to see the next one

━━━ 10 SLIDE BLUEPRINT ━━━

SLIDE 1 — THE HOOK (Make them stop scrolling in 0.3 seconds):
- LABEL: Power word: "BREAKING" / "GAME CHANGER" / "MUST KNOW" / "WOW" / "JUST DROPPED"
- TITLE: 5-10 words that make it impossible NOT to swipe. Use numbers if possible. Create a knowledge gap. NEVER use "..." or ellipsis. Write the complete title.
  ✅ Good: "Midjourney Now Makes Videos From Text"
  ✅ Good: "OpenAI Launches GPT-5 with Unprecedented Reasoning"
  ❌ Bad: "New AI Update Released"
  ❌ Bad: "OpenAI Launches GPT-5 with Unprecedented R..."
- SUBTITLE: Adds intrigue. Hints at the value inside. Max 12 words. (e.g. "Here's what it means for YOUR career — swipe to find out")

SLIDE 2 — THE NEWS (Crystal clear, 30 seconds to read):
- TITLE: "Here's What Happened" or "Wait, What Just Happened?" or "The Big News"
- BULLET_1: What EXACTLY changed — be specific with names/numbers (max 15 words)
- BULLET_2: WHO made it happen and WHY now (max 12 words)
- BULLET_3: The one statistic/fact that proves this is HUGE (max 12 words)

SLIDE 3 — EXPLAIN IT SIMPLY (Zero jargon, maximum clarity):
- TITLE: "What Is [Topic] Anyway?" or "Confusing? Here's the Simple Version"
- SIMPLE_EXPLANATION: Explain it like talking to a curious 15-year-old. 2-3 sentences only. Max 45 words. No technical terms.
- ANALOGY: A razor-sharp analogy from everyday life that makes it instantly click (max 20 words)
  ✅ Good: "It's like Google Maps, but for AI decisions — it finds the best route automatically"

SLIDE 4 — WHY IT MATTERS (Make them feel the impact):
- TITLE: "Why YOU Should Care" or "This Changes Everything For You"
- IMPACT_STATEMENT: Bold, emotional, specific main impact. Use numbers or contrast. (max 18 words)
  ✅ Good: "This cuts content creation time from 8 hours to 20 minutes — for FREE"
- FOR_STUDENTS: Hyper-specific student benefit (max 15 words)
- FOR_EMPLOYEES: Hyper-specific employee/professional benefit (max 15 words)
- FOR_BUSINESS: Hyper-specific business benefit with ROI or time saved (max 15 words)

SLIDE 5 — HOW IT WORKS (Simple steps, zero fluff):
- TITLE: "How It Actually Works" or "The 3-Step Magic Behind It"
- STEP_1: First mechanism — keep it visual and simple (max 12 words)
- STEP_2: Second mechanism — build on step 1 (max 12 words)
- STEP_3: Final mechanism — the "aha" moment (max 12 words)
- FUN_FACT: One genuinely surprising fact that will make them screenshot this (max 18 words)

SLIDE 6 — ACTION STEPS (Tell them EXACTLY what to do):
- TITLE: "Your Action Plan for Today" or "How To Use This Right Now"
- USE_CASE_1: Student action — be specific and achievable TODAY (max 12 words)
- USE_CASE_2: Employee action — save time on a real work task (max 12 words)
- USE_CASE_3: Business action — real revenue/cost impact (max 12 words)
- USE_CASE_4: Creator action — help them grow their audience/income (max 12 words)

SLIDE 7 — HONEST REVIEW (Build trust with balanced truth):
- TITLE: "The Real Talk" or "Honest Pros & Cons"
- PRO_1: Biggest genuine advantage — be enthusiastic but real (max 12 words)
- PRO_2: Second strong benefit that surprises people (max 12 words)
- CON_1: The honest limitation — don't sugarcoat it (max 12 words)
- CON_2: What to watch out for practically (max 12 words)

SLIDE 8 — BIG PICTURE (Show them the trend, make them feel smart):
- TITLE: "The Bigger Picture" or "Where This Is All Heading"
- CONTEXT: 2-3 powerful sentences on what this means for AI's future direction (max 45 words)
- VS_BEFORE: What the world was like BEFORE this (max 14 words, start with "Before:")
- VS_NOW: What the world is like NOW (max 14 words, start with "Now:")

SLIDE 9 — EXPERT TIPS (Insider knowledge they can't Google easily):
- TITLE: "Expert Tips to Get Started" or "How The Pros Use This"
- TIP_1: A tactical tip that sounds like insider advice (max 15 words)
- TIP_2: A productivity/efficiency tip (max 15 words)
- TIP_3: A common mistake to avoid (max 15 words)
- BONUS_TIP: A hidden gem / advanced trick they won't find easily (max 18 words)

SLIDE 10 — THE CTA (Drive saves, follows, comments):
- TITLE: "The Bottom Line" (keep exactly this)
- SUMMARY: One powerful definitive verdict. Bold opinion. Makes them feel informed. (max 18 words)
- CTA_QUESTION: A question SO specific to this topic that only engaged followers comment. NOT "what do you think?" (max 12 words)
- CTA_FOLLOW: "Follow @learnwithmanii for daily AI lessons like this 🤖" (keep exactly this)
- CTA_SAVE: "Save this — you'll need it later 🔖" (keep exactly this)

━━━ INSTAGRAM CAPTION ━━━
- HOOK: First visible line. Must stop the scroll. Use curiosity + emotion + emoji. Max 15 words. (e.g. "🚨 This AI just made professional video creation free for everyone...")
- BODY: 3 short punchy paragraphs. Para 1: The news. Para 2: Why it matters. Para 3: What to do with it. Max 2-3 lines each.
- ENGAGEMENT_PROMPT: Ultra-specific question tied to THIS news. Creates a real opinion divide. (e.g. "Would you trust AI to create videos for your brand? Or does it still feel too risky?")
- SAVE_PROMPT: Tell them exactly WHY they'll want this saved later (be specific)
- CALL_TO_ACTION: "Follow @learnwithmanii + tag a friend who needs to see this"

━━━ HASHTAGS (exactly 25) ━━━
- 8 education: #LearnAI #AIForBeginners #AIForStudents #AILearning #LearnWithAI #AIEducation #TechForStudents #LearnTech
- 7 professional: #AIForBusiness #AITools #WorkWithAI #AIProductivity #FutureOfWork #CareerGrowth #TechProfessionals
- 5 topic-specific: based on the EXACT news (tool name, company, AI area)
- 5 reach: #ArtificialIntelligence #AINews #TechNews #AI2025 #MachineLearning

Return ONLY valid JSON with this exact structure:
{
  "post_id": "unique_string",
  "rank": ${rank},
  "news_id": "${newsItem.id}",
  "headline": "${newsItem.headline}",
  "category": "${newsItem.category || 'AI News'}",
  "emoji": "${newsItem.emoji || '🤖'}",
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
    "call_to_action": "string",
    "full_caption": "string"
  },
  "hashtags": ["string"],
  "generated_at": "ISO timestamp"
}`;

async function generatePostContent(newsItem, rank) {
  console.log(`📝 Generating content for post #${rank}: ${newsItem.headline}`);
  
  try {
    const { text } = await callGemini(CONTENT_PROMPT(newsItem, rank), 'content');
    
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('Could not extract JSON from content response');
    
    const postContent = JSON.parse(jsonMatch[0]);
    
    // Build full caption from parts
    if (postContent.caption && !postContent.caption.full_caption) {
      postContent.caption.full_caption = [
        postContent.caption.hook,
        '',
        postContent.caption.body,
        '',
        postContent.caption.engagement_prompt,
        '',
        postContent.caption.save_prompt,
        '',
        postContent.caption.call_to_action,
        '',
        postContent.hashtags?.join(' ') || ''
      ].join('\n');
    }
    
    postContent.generated_at = new Date().toISOString();
    postContent.post_id = postContent.post_id || `post_${Date.now()}_${rank}`;
    
    console.log(`  ✅ Post #${rank} content ready!`);
    console.log(`     Slides: ${Object.keys(postContent.slides || {}).length}`);
    console.log(`     Title: ${postContent.slides?.slide_1?.title}`);
    
    return postContent;
    
  } catch (error) {
    console.error(`  ❌ Content generation error for post #${rank}:`, error.message);
    return generateFallbackContent(newsItem, rank);
  }
}

async function generateAllContent(filteredNews) {
  console.log('📋 Generating content for all 5 posts...');
  
  const posts = [];
  
  for (let i = 0; i < filteredNews.selected_items.length; i++) {
    const item = filteredNews.selected_items[i];
    const content = await generatePostContent(item, i + 1);
    posts.push(content);
    
    // Small delay to avoid rate limiting
    if (i < filteredNews.selected_items.length - 1) {
      await new Promise(r => setTimeout(r, 1000));
    }
  }
  
  console.log(`✅ All ${posts.length} posts generated!`);
  return {
    posts,
    generated_at: new Date().toISOString(),
    total_posts: posts.length
  };
}

function generateFallbackContent(newsItem, rank) {
  console.log(`  🟡 Using guaranteed rich fallback content for post #${rank}`);
  return buildGuaranteedFallback(newsItem, rank);
}

// Test mode
if (process.argv.includes('--test')) {
  const testItem = {
    id: 'test_001',
    headline: 'OpenAI Releases GPT-5 with Mind-Blowing Capabilities',
    summary: 'OpenAI has launched GPT-5, featuring revolutionary reasoning and multimodal capabilities that surpass all existing AI models.',
    source: 'OpenAI',
    impact: 'This will fundamentally change how businesses and creators use AI.',
    viral_score: 10,
    relevance_score: 10,
    innovation_score: 10,
    category: 'Model Release',
    emoji: '🚀',
    instagram_angle: 'GPT-5 just dropped and it changes EVERYTHING',
    researched_at: new Date().toISOString()
  };
  
  generatePostContent(testItem, 1).then(content => {
    console.log('\n📝 GENERATED CONTENT:');
    console.log('Slide 1:', content.slides.slide_1);
    console.log('Caption hook:', content.caption.hook);
    console.log('Hashtags:', content.hashtags.slice(0, 5).join(', ') + '...');
  }).catch(console.error);
}

module.exports = { generatePostContent, generateAllContent };
