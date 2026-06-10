/**
 * Visual Test — renders ALL 10 slides with realistic long-text content
 * similar to what Gemini actually generates, then saves to a test output folder
 * so we can visually inspect every slide.
 */

const { renderCarousel } = require('../services/carouselRenderer');
const path = require('path');
const fs   = require('fs');

const OUT = path.join(__dirname, '../../data/visualTest');
if (!fs.existsSync(OUT)) fs.mkdirSync(OUT, { recursive: true });

// Realistic Pattern A post — uses long text like Gemini writes
const POST_A = {
  post_id: 'visual_test_A',
  rank: 1,
  pattern: 'A',
  pattern_name: 'Tool Spotlight',
  headline: 'Runway Gen-3 Makes Hollywood-Quality Videos From Plain Text Prompts',
  category: 'AI TOOL',
  emoji: '🎬',
  slides: {
    slide_1: {
      label: 'JUST LAUNCHED',
      tool_name: 'Runway Gen-3',
      tagline: 'Generate cinematic videos with text',
      subtitle: 'Save this before it goes viral'
    },
    slide_2: {
      title: 'What Is Runway Gen-3 Exactly?',
      one_liner: 'Runway Gen-3 Alpha is a state-of-the-art AI video generation model that creates high-fidelity, cinematic video clips from text descriptions or reference images.',
      analogy: "It's like having a Hollywood film crew that follows your text instructions perfectly — but you only need a laptop and a browser",
      key_fact: 'Gen-3 can generate 10-second video clips at 24fps with consistent character motion, realistic physics, and cinematic lighting in under 90 seconds'
    },
    slide_3: {
      use_case_title: 'Use It To Create Marketing Videos',
      who_its_for: 'For: Content creators and social media managers',
      step_1: 'Go to app.runwayml.com and sign up with your Google account for free',
      step_2: 'Click "Generate Video" and type your scene description in plain English',
      step_3: 'Download the 10-second clip and post directly to Instagram Reels or TikTok',
      time_saved: 'Saves 8 hours/week on video production'
    },
    slide_4: {
      use_case_title: 'Use It To Create Product Demos',
      who_its_for: 'For: E-commerce entrepreneurs and startup founders',
      step_1: 'Upload your product image as a reference and write what you want it to do',
      step_2: 'Select the "Motion Brush" tool to specify exactly which parts should move',
      step_3: 'Export your 10-second demo clip and embed it on your landing page',
      time_saved: 'Saves 12 hours/week on video editing'
    },
    slide_5: {
      use_case_title: 'Use It To Create Educational Content',
      who_its_for: 'For: Teachers, trainers, and course creators',
      step_1: 'Write a detailed scene description of the concept you want to visualize',
      step_2: 'Generate 3-5 different versions and pick the one that explains best',
      step_3: 'Stitch clips together in CapCut or Adobe Premiere for a full explainer',
      time_saved: 'Saves 5 hours/week on course material creation'
    },
    slide_6: {
      slide_label: 'COPY THIS PROMPT',
      prompt_name: 'Cinematic Product Showcase Prompt',
      prompt_text: 'A sleek [product name] floating in zero gravity against a deep space background with subtle lens flares and dramatic rim lighting. The product slowly rotates 360 degrees revealing every angle. Camera moves in a slow orbit. Cinematic color grading, 4K quality, realistic reflections and materials.',
      expected_output: "You'll get: a 10-second cinematic product video ready for Instagram"
    },
    slide_7: {
      title: 'Who Is Runway Gen-3 For?',
      for_students: 'Create stunning class projects without filmmaking skills',
      for_employees: 'Automate work videos in minutes, not hours',
      for_creators: 'Make pro Instagram Reels without a camera',
      for_business: 'Cut video production costs by 80 percent'
    },
    slide_8: {
      title: 'Start Using Runway Gen-3 in 5 Minutes',
      step_1: 'Go to app.runwayml.com and sign up free',
      step_2: 'Click Generate Video and type your scene',
      step_3: 'Download your 10-second clip and post it',
      closing_line: "That's it. You're making videos now."
    },
    slide_9: {
      title: 'The Honest Catch About Runway',
      limitation_1: 'The free tier has monthly usage limits — heavy daily users may need to upgrade to a paid plan starting at $15 per month to avoid running out of credits',
      limitation_2: 'AI can occasionally make factual errors on niche topics — always fact-check and verify any generated video content before publishing publicly',
      still_worth_it: 'The hours saved on every task pays for itself within the first week of regular use — even the paid plan costs less than one hour of freelancer time'
    },
    slide_10: {
      verdict: 'Runway Gen-3 is the most powerful AI video tool available today and every creator needs to be using it right now before their competitors do',
      save_cta: "Save this guide — you'll need it later 🔖",
      follow_cta: 'Follow @learnwithmanii for daily AI tool drops 🤖',
      comment_question: 'What kind of video would you create first with Runway Gen-3?'
    }
  },
  caption: {
    hook: '🎬 This AI tool just made Hollywood-quality video production free for everyone',
    body: 'Runway Gen-3 Alpha has changed the game entirely.',
    full_caption: '🎬 Runway Gen-3 is here and it is insane'
  },
  hashtags: ['#AI', '#RunwayML']
};

async function runVisualTest() {
  console.log('\n📸 VISUAL TEST — Rendering Pattern A with realistic long text\n');
  console.log('This simulates what Gemini actually generates (long field values)\n');
  
  try {
    const slides = await renderCarousel(POST_A);
    console.log(`\n✅ Rendered ${slides.length} slides`);
    console.log(`📁 Output: ${path.join('backend/data/images', POST_A.post_id)}`);
    console.log('\nSlide files:');
    slides.forEach(s => console.log(`  → ${path.basename(s)}`));
    
    console.log('\n🔍 Open these images to visually verify no overflow:\n');
    console.log('  Key slides to check:');
    console.log('  • slide_7.png — 2x2 audience grid (most likely to overflow)');
    console.log('  • slide_8.png — 3 steps (long step text)');
    console.log('  • slide_9.png — 2 limitations (long text)');
    console.log('  • slide_10.png — Bottom Line with verdict text (was empty before)');
  } catch (err) {
    console.error('❌ Render failed:', err.message);
    process.exit(1);
  }
}

runVisualTest();
