/**
 * Full Pipeline Runner
 * Orchestrates the complete workflow:
 * 1. Research AI news
 * 2. Filter top 5
 * 3. Generate content
 * 4. Render carousels
 * 5. Publish to Instagram
 */

require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });
const fs = require('fs');
const path = require('path');

const { researchAINews }    = require('./researchAgent');
const { filterTopNews }     = require('./filterAgent');
const { generateAllContent } = require('./contentAgent');
const { validateAndFix }    = require('./qualityAgent');
const { renderAllCarousels } = require('../services/carouselRenderer');
const { publisher }         = require('../services/instagramPublisher');
const { trackPost, getAnalytics } = require('../services/analyticsService');
const { filterFreshTopics, recordTopic } = require('./topicMemoryAgent');
const { generateHashtags }  = require('./hashtagAgent');

const DATA_DIR = path.join(__dirname, '../data');
const POSTS_DIR = path.join(DATA_DIR, 'posts');
const LOGS_DIR = path.join(DATA_DIR, 'logs');

// Ensure directories exist
[DATA_DIR, POSTS_DIR, LOGS_DIR].forEach(dir => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

// Global state for WebSocket broadcasts
let pipelineState = {
  status: 'idle',
  currentStep: null,
  steps: {},
  lastRun: null,
  nextRun: null,
  logs: []
};

function log(message, type = 'info') {
  const entry = {
    timestamp: new Date().toISOString(),
    type,
    message
  };
  
  pipelineState.logs.unshift(entry);
  pipelineState.logs = pipelineState.logs.slice(0, 200); // Keep last 200 logs
  
  const icons = { info: 'ℹ️', success: '✅', error: '❌', warning: '⚠️' };
  console.log(`${icons[type] || '📝'} [${new Date().toLocaleTimeString()}] ${message}`);
  
  // Append to daily log file
  const logFile = path.join(LOGS_DIR, `${new Date().toISOString().split('T')[0]}.log`);
  fs.appendFileSync(logFile, JSON.stringify(entry) + '\n');
  
  return entry;
}

function updateStep(stepName, status, data = {}) {
  pipelineState.steps[stepName] = {
    status,
    ...data,
    updated_at: new Date().toISOString()
  };
}

async function runPipeline(options = {}) {
  const { publishNow = false, skipPublish = false, broadcast = null, onImagesReady = null,
          pattern = 'auto', theme = 'cyber_dark', mode = 'news', topic = null } = options;
  const isPreview = skipPublish || !publisher.isConfigured;
  const isEvergreen = mode === 'evergreen';

  
  console.log('\n' + '='.repeat(60));
  console.log('🤖 AI INSTAGRAM AUTOMATION PIPELINE STARTING');
  console.log('='.repeat(60));
  console.log(`⏰ Start time: ${new Date().toLocaleString()}`);
  console.log(`🚀 Publish mode: ${isPreview ? '🟡 PREVIEW (no posting)' : '🟢 LIVE'}`);
  console.log('='.repeat(60) + '\n');
  
  pipelineState.status = 'running';
  pipelineState.lastRun = new Date().toISOString();
  pipelineState.steps = {};
  
  const pipelineResult = {
    run_id: `run_${Date.now()}`,
    started_at: new Date().toISOString(),
    status: 'running',
    research: null,
    filter: null,
    content: null,
    carousels: null,
    publishing: null,
    analytics: null
  };

  try {
    let newsData, filteredNews;

    if (isEvergreen) {
      // ================================
      // EVERGREEN MODE: Skip research+filter, use evergreenAgent
      // ================================
      log('♻️ EVERGREEN MODE: Generating timeless content...', 'info');
      pipelineState.currentStep = 'research';
      updateStep('research', 'running');
      let evergreenAgent;
      try { evergreenAgent = require('./evergreenAgent'); } catch(e) {
        log('⚠️ evergreenAgent not found — falling back to news mode', 'warning');
      }
      if (evergreenAgent) {
        const evData = await evergreenAgent.generateEvergreenContent({ topic });
        newsData = evData;
        filteredNews = { selected_items: evData.selected_items, is_evergreen: true };
      } else {
        newsData = await researchAINews();
        filteredNews = await filterTopNews(newsData, { broadcast });
        filteredNews.selected_items = filteredNews.selected_items.slice(0, 1);
      }
      updateStep('research', 'complete', { mode: 'evergreen', topic: topic || 'auto' });
      log(`✅ Evergreen topic: ${filteredNews.selected_items[0]?.headline || 'Selected'}`, 'success');
      updateStep('filter', 'complete', { items_selected: 1 });
      if (broadcast) broadcast({ type: 'step_complete', step: 'filter', data: filteredNews });
    } else {
      // ================================
      // STEP 1: AI NEWS RESEARCH
      // ================================
      log('🔍 STEP 1: Starting AI news research...', 'info');
      pipelineState.currentStep = 'research';
      updateStep('research', 'running');
      newsData = await researchAINews();
      pipelineResult.research = newsData;
      updateStep('research', 'complete', { items_found: newsData.total_items, is_fallback: newsData.is_fallback });
      const researchMsg = newsData.is_fallback
        ? `⚠️ Live news unavailable — using curated library (${newsData.total_items} topics)`
        : `✅ Research complete — found ${newsData.total_items} live AI news items`;
      log(researchMsg, newsData.is_fallback ? 'warning' : 'success');
      if (broadcast) broadcast({
        type: newsData.is_fallback ? 'api_warning' : 'step_complete',
        step: 'research', level: newsData.is_fallback ? 'warning' : 'info',
        message: researchMsg,
        data: { items_found: newsData.total_items, is_fallback: newsData.is_fallback }
      });

      // ================================
      // STEP 2: FILTER — PICK BEST 1 POST
      // ================================
      log('🎯 STEP 2: Selecting today\'s best AI story...', 'info');
      pipelineState.currentStep = 'filter';
      updateStep('filter', 'running');
      filteredNews = await filterTopNews(newsData, { broadcast });
      filteredNews.selected_items = filteredNews.selected_items.slice(0, 1);
      pipelineResult.filter = filteredNews;
      const topStory = filteredNews.selected_items[0];
      updateStep('filter', 'complete', { items_selected: 1, top_story: topStory?.headline });
      log(`✅ Today's story selected: ${topStory?.headline}`, 'success');
      log(`   Score: ${topStory?.final_score?.toFixed(1) || 'N/A'} | Category: ${topStory?.category || 'AI News'}`, 'info');
      if (broadcast) broadcast({ type: 'step_complete', step: 'filter', data: filteredNews });
    }

    pipelineResult.research = newsData;
    pipelineResult.filter = filteredNews;


    // ================================
    // STEP 3: CONTENT GENERATION
    // ================================
    log(`📝 STEP 3: Generating 10-slide carousel content (Pattern: ${pattern}, Theme: ${theme})...`, 'info');
    pipelineState.currentStep = 'content';
    updateStep('content', 'running');
    
    const contentData = await generateAllContent(filteredNews, { pattern, theme });
    pipelineResult.content = contentData;

    
    // Save content data
    const contentFile = path.join(POSTS_DIR, `${new Date().toISOString().split('T')[0]}.json`);
    fs.writeFileSync(contentFile, JSON.stringify({
      run_id: pipelineResult.run_id,
      research: newsData,
      filter: filteredNews,
      content: contentData
    }, null, 2));
    
    updateStep('content', 'complete', { posts_generated: 1, headline: contentData.posts[0]?.headline });
    log(`✅ Content ready — 10 slides generated for: ${contentData.posts[0]?.headline}`, 'success');
    if (broadcast) broadcast({ type: 'step_complete', step: 'content', data: contentData });

    // ================================
    // STEP 3.2: UPGRADE HASHTAGS
    // ================================
    log('🏷️  STEP 3.2: Generating optimized topic-specific hashtags...', 'info');
    try {
      for (let i = 0; i < contentData.posts.length; i++) {
        const post = contentData.posts[i];
        const freshTags = await generateHashtags(post);
        contentData.posts[i].hashtags = freshTags;
        log(`  ✅ Hashtags upgraded: ${freshTags.length} tags for "${post.headline}"`, 'success');
      }
    } catch (hashErr) {
      log(`  ⚠️ Hashtag upgrade failed (keeping defaults): ${hashErr.message}`, 'warning');
    }

    // ================================
    // STEP 3.5: QUALITY VALIDATION LOOP
    // ================================
    log('🔍 STEP 3.5: Running quality checks on every slide field...', 'info');
    pipelineState.currentStep = 'quality';
    updateStep('quality', 'running');

    let qualityPassed = true;
    const qualityReport = [];

    for (let i = 0; i < contentData.posts.length; i++) {
      const post = contentData.posts[i];
      const newsItem = filteredNews.selected_items[i] || filteredNews.selected_items[0];
      log(`  🔎 Checking post #${post.rank}: ${post.headline}`, 'info');

      const { post: validatedPost, passed, attempts, issues } = await validateAndFix(post, newsItem, 3);
      contentData.posts[i] = validatedPost;

      const slideCount = Object.keys(validatedPost.slides || {}).length;
      const reportEntry = {
        rank: post.rank,
        headline: post.headline,
        passed,
        attempts,
        slide_count: slideCount,
        remaining_issues: issues
      };
      qualityReport.push(reportEntry);

      if (passed) {
        log(`  ✅ Post #${post.rank} PASSED — ${slideCount}/10 slides, all fields filled`, 'success');
      } else {
        qualityPassed = false;
        log(`  ❌ Post #${post.rank} FAILED quality after ${attempts} attempts`, 'error');
        issues.forEach(issue => log(`     — ${issue}`, 'error'));
      }
    }

    // Save quality report alongside content
    const qualityReportPath = path.join(POSTS_DIR, `quality_${new Date().toISOString().split('T')[0]}.json`);
    fs.writeFileSync(qualityReportPath, JSON.stringify({ qualityPassed, qualityReport, checked_at: new Date().toISOString() }, null, 2));

    // Save validated content
    fs.writeFileSync(contentFile, JSON.stringify({
      run_id: pipelineResult.run_id,
      research: newsData,
      filter: filteredNews,
      content: contentData
    }, null, 2));

    // ================================
    // STEP 3.6: RECORD TO TOPIC MEMORY
    // ================================
    try {
      for (const post of contentData.posts) {
        recordTopic(post);
      }
      log('📝 Topics recorded to 30-day memory (prevents future repeats)', 'info');
    } catch (memErr) {
      log(`⚠️ Topic memory recording failed (non-fatal): ${memErr.message}`, 'warning');
    }

    // ✅ SOFT QUALITY GATE — use fallback on failure instead of hard blocking
    if (!qualityPassed) {
      const failedPosts = qualityReport.filter(r => !r.passed);
      log(`⚠️ Quality issues in ${failedPosts.length} post(s) — fallback content is already applied, continuing to render...`, 'warning');
      log('💡 Fallback content is guaranteed valid — slides will have real content', 'info');
      failedPosts.forEach(p => {
        log(`  ⚠️ Post "${p.headline}" used fallback after ${p.attempts} attempts`, 'warning');
      });

      // Broadcast a warning (not a hard failure) — pipeline continues
      if (broadcast) broadcast({
        type: 'quality_warning',
        data: {
          message: '⚠️ AI had some gaps — using guaranteed fallback content. Slides will still be great!',
          report: qualityReport,
        }
      });

      // Mark quality as complete with warning (not failed)
      updateStep('quality', 'complete', {
        all_passed: false,
        used_fallback: true,
        posts_checked: qualityReport.length,
        warning: 'Fallback content applied — rendering anyway'
      });
    } else {
      updateStep('quality', 'complete', { all_passed: true, posts_checked: qualityReport.length });
      log(`✅ QUALITY GATE PASSED — all ${qualityReport.length} post(s) are 100% ready!`, 'success');
    }
    if (broadcast) broadcast({ type: 'step_complete', step: 'quality', data: { all_passed: qualityPassed } });

    // ================================
    // STEP 4: CAROUSEL RENDERING (8:45 AM)
    // ================================
    log('🎨 STEP 4: Rendering carousel images...', 'info');
    pipelineState.currentStep = 'render';
    updateStep('render', 'running');
    
    const carouselResults = await renderAllCarousels(contentData, { theme });
    pipelineResult.carousels = carouselResults;
    
    const totalImages = carouselResults.reduce((sum, r) => sum + r.image_paths.length, 0);
    updateStep('render', 'complete', { images_created: totalImages });
    log(`✅ Carousel rendering complete — ${totalImages} images created`, 'success');
    if (broadcast) broadcast({ type: 'step_complete', step: 'render', data: { total_images: totalImages } });

    // Notify server to cache base64 images in memory (survives disk wipes on Render)
    if (typeof onImagesReady === 'function') {
      carouselResults.forEach(r => {
        if (r.image_base64s && r.image_base64s.length > 0) {
          onImagesReady(r.post_id, r.image_base64s);
        }
      });
    }

    // ================================
    // STEP 5: INSTAGRAM PUBLISHING (9:00 AM)
    // ================================
    if (isPreview) {
      log('🟡 STEP 5: PREVIEW MODE — Skipping Instagram publishing', 'info');
      log('✅ Content and images are ready to view in the dashboard!', 'success');
      pipelineState.currentStep = 'publish';
      updateStep('publish', 'complete', { posts_published: 0, mode: 'preview' });
      // Create fake publish results so analytics still track
      const publishResults = contentData.posts.map(p => ({
        ...p,
        status: 'preview',
        instagram_post_id: `PREVIEW_${Date.now()}_${p.rank}`,
        published_at: new Date().toISOString()
      }));
      pipelineResult.publishing = publishResults;
      if (broadcast) broadcast({ type: 'step_complete', step: 'publish', data: { mode: 'preview', posts: publishResults.length } });

      // Analytics
      log('📊 STEP 6: Recording analytics...', 'info');
      for (let i = 0; i < publishResults.length; i++) {
        await trackPost(publishResults[i], contentData.posts[i]);
      }
      updateStep('analytics', 'complete');
      log('✅ Analytics recorded', 'success');

      pipelineState.status = 'idle';
      pipelineState.currentStep = null;
      pipelineResult.status = 'preview';
      pipelineResult.completed_at = new Date().toISOString();
      console.log('\n' + '='.repeat(60));
      console.log('🎉 PREVIEW COMPLETE! Check dashboard to review content.');
      console.log(`📱 Posts: ${contentData.posts.length} generated (not posted)`);
      console.log('='.repeat(60) + '\n');
      log('🎉 Preview pipeline completed — review content in dashboard!', 'success');
      if (broadcast) broadcast({ type: 'pipeline_complete', data: pipelineResult });
      return pipelineResult;
    }

    log('📱 STEP 5: Publishing to Instagram...', 'info');
    pipelineState.currentStep = 'publish';
    updateStep('publish', 'running');
    
    const publishResults = await publisher.publishAllPosts(contentData.posts, carouselResults);
    pipelineResult.publishing = publishResults;
    
    const published = publishResults.filter(r => r.status !== 'failed').length;
    updateStep('publish', 'complete', { posts_published: published });
    log(`✅ Publishing complete — ${published}/${contentData.posts.length} posts published`, 'success');
    if (broadcast) broadcast({ type: 'step_complete', step: 'publish', data: publishResults });

    // ================================
    // STEP 6: ANALYTICS TRACKING
    // ================================
    log('📊 STEP 6: Recording analytics...', 'info');
    pipelineState.currentStep = 'analytics';
    updateStep('analytics', 'running');
    
    for (let i = 0; i < publishResults.length; i++) {
      await trackPost(publishResults[i], contentData.posts[i]);
    }
    
    const analytics = getAnalytics();
    pipelineResult.analytics = analytics.summary;
    
    updateStep('analytics', 'complete');
    log(`✅ Analytics recorded`, 'success');

    // Save complete run result
    const runFile = path.join(POSTS_DIR, `run_${pipelineResult.run_id}.json`);
    pipelineResult.status = 'success';
    pipelineResult.completed_at = new Date().toISOString();
    fs.writeFileSync(runFile, JSON.stringify(pipelineResult, null, 2));
    
    pipelineState.status = 'idle';
    pipelineState.currentStep = null;
    
    console.log('\n' + '='.repeat(60));
    console.log('🎉 PIPELINE COMPLETE!');
    console.log(`⏱️  Total time: ${Math.round((Date.now() - new Date(pipelineResult.started_at).getTime()) / 1000)}s`);
    console.log(`📱 Posts: ${published}/5 ${publisher.isConfigured ? 'published' : 'previewed'}`);
    console.log('='.repeat(60) + '\n');
    
    log('🎉 Full pipeline completed successfully!', 'success');
    if (broadcast) broadcast({ type: 'pipeline_complete', data: pipelineResult });
    
    return pipelineResult;
    
  } catch (error) {
    pipelineResult.status = 'failed';
    pipelineResult.error = error.message;
    pipelineResult.completed_at = new Date().toISOString();
    
    pipelineState.status = 'error';
    pipelineState.currentStep = null;
    
    log(`❌ Pipeline failed: ${error.message}`, 'error');
    console.error('Pipeline error:', error);
    
    if (broadcast) broadcast({ type: 'pipeline_error', error: error.message });
    
    return pipelineResult;
  }
}

function getPipelineState() {
  return pipelineState;
}

// Direct execution
if (require.main === module) {
  runPipeline({ publishNow: true }).then(result => {
    console.log('\nFinal result:', result.status);
    process.exit(result.status === 'success' ? 0 : 1);
  }).catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
  });
}

module.exports = { runPipeline, getPipelineState, log };
