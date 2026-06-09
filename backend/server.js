/**
 * Express API Server
 * Main server that powers the dashboard and automation system
 * Includes REST API endpoints and WebSocket for real-time updates
 */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const http = require('http');
const WebSocket = require('ws');

const { setupScheduler, getScheduleStatus, setBroadcast, getNextRunTime } = require('./scheduler');
const { runPipeline, getPipelineState } = require('./agents/pipelineRunner');
const { getAnalytics, getRecentPosts } = require('./services/analyticsService');
const { publisher, setPublicBaseUrl } = require('./services/instagramPublisher');
const { editContent, regeneratePost, loadLatestPostFile } = require('./services/contentEditor');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

const PORT = process.env.PORT || 3000;
const DATA_DIR = path.join(__dirname, 'data');
const POSTS_DIR = path.join(DATA_DIR, 'posts');
const IMAGES_DIR = path.join(DATA_DIR, 'images');
const LOGS_DIR = path.join(DATA_DIR, 'logs');

// Ensure directories exist
[DATA_DIR, POSTS_DIR, IMAGES_DIR, LOGS_DIR].forEach(dir => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

// ─── IN-MEMORY IMAGE STORE ────────────────────────────────────────────────────
// Maps post_id → array of base64 data URIs for each slide.
// Survives disk wipes (Render free tier ephemeral filesystem).
const imageStore = new Map();


// ================================
// MIDDLEWARE
// ================================
app.use(cors());
app.use(express.json());

// Serve frontend files — no-cache for JS/CSS/HTML so deploys are always picked up
// Images use default caching (unique post IDs act as cache busters)
app.use(express.static(path.join(__dirname, '../frontend'), {
  etag: false,
  lastModified: false,
  setHeaders(res, filePath) {
    if (filePath.endsWith('.js') || filePath.endsWith('.css') || filePath.endsWith('.html')) {
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
    } else {
      // Images and other assets — cache for 1 hour
      res.setHeader('Cache-Control', 'public, max-age=3600');
    }
  }
}));

// Serve generated carousel images — disk first, in-memory fallback
// This keeps URL-based <img src="/images/..."> working even after Render disk wipes.
app.get('/images/:postId/:filename', (req, res) => {
  const { postId, filename } = req.params;

  // 1. Disk — fast path when files still exist
  const filepath = path.join(IMAGES_DIR, postId, filename);
  if (fs.existsSync(filepath)) {
    res.set('Content-Type', 'image/png');
    res.set('Cache-Control', 'no-cache');
    return res.sendFile(filepath);
  }

  // 2. In-memory imageStore — decode base64 → real PNG bytes
  if (imageStore.has(postId)) {
    const slideNum = parseInt(filename.replace('slide_', '').replace('.png', ''), 10) - 1;
    const base64Images = imageStore.get(postId);
    if (base64Images && base64Images[slideNum]) {
      const buf = Buffer.from(
        base64Images[slideNum].replace(/^data:image\/png;base64,/, ''),
        'base64'
      );
      res.set('Content-Type', 'image/png');
      res.set('Cache-Control', 'no-cache');
      return res.send(buf);
    }
  }

  res.status(404).json({ error: 'Image not found' });
});

// ================================
// WEBSOCKET — Real-time updates
// ================================
const clients = new Set();

wss.on('connection', (ws) => {
  clients.add(ws);
  console.log(`📡 Dashboard client connected (${clients.size} active)`);
  
  // Send current state immediately
  ws.send(JSON.stringify({
    type: 'connected',
    pipeline_state: getPipelineState(),
    schedule: getScheduleStatus(),
    timestamp: new Date().toISOString()
  }));
  
  ws.on('close', () => {
    clients.delete(ws);
    console.log(`📡 Client disconnected (${clients.size} remaining)`);
  });
  
  ws.on('error', (err) => {
    clients.delete(ws);
  });
});

function broadcast(data) {
  const message = JSON.stringify({ ...data, timestamp: new Date().toISOString() });
  clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(message);
    }
  });
}

// Connect scheduler broadcasts to WebSocket
setBroadcast(broadcast);

// ================================
// API ROUTES
// ================================

// System status
app.get('/api/status', (req, res) => {
  res.json({
    status: 'online',
    version: '2.0.0',
    pipeline: getPipelineState(),
    schedule: getScheduleStatus(),
    instagram_configured: publisher.isConfigured,
    mode: publisher.isConfigured ? 'live' : 'preview',
    uptime: process.uptime(),
    timestamp: new Date().toISOString()
  });
});

// Get all posts — returns flat list of individual post objects
app.get('/api/posts', (req, res) => {
  try {
    const files = fs.readdirSync(POSTS_DIR)
      .filter(f => f.endsWith('.json') && !f.startsWith('run_') && !f.startsWith('quality_'))
      .sort().reverse()
      .slice(0, 30);

    // Each file has shape { content: { posts: [...] } } — flatten to individual posts
    const posts = [];
    for (const file of files) {
      try {
        const data = JSON.parse(fs.readFileSync(path.join(POSTS_DIR, file), 'utf-8'));
        const filePosts = data.content?.posts || [];
        // Attach the file date to each post for display
        const fileDate = file.replace('.json', '');
        filePosts.forEach(p => {
          posts.push({ ...p, generated_date: fileDate });
        });
      } catch { /* skip unreadable files */ }
    }

    res.json({ posts, total: posts.length });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get today's posts
app.get('/api/posts/today', (req, res) => {
  try {
    const today = new Date().toISOString().split('T')[0];
    const todayFile = path.join(POSTS_DIR, `${today}.json`);
    
    if (!fs.existsSync(todayFile)) {
      return res.json({ posts: [], message: 'No posts generated yet today' });
    }
    
    const data = JSON.parse(fs.readFileSync(todayFile, 'utf-8'));
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get specific post
app.get('/api/posts/:postId', (req, res) => {
  try {
    const { postId } = req.params;
    
    // Search through all post files
    const files = fs.readdirSync(POSTS_DIR).filter(f => f.endsWith('.json'));
    
    for (const file of files) {
      try {
        const data = JSON.parse(fs.readFileSync(path.join(POSTS_DIR, file), 'utf-8'));
        const post = data.content?.posts?.find(p => p.post_id === postId);
        if (post) {
          // Check for images
          const imageDir = path.join(IMAGES_DIR, postId);
          const images = fs.existsSync(imageDir)
            ? fs.readdirSync(imageDir).map(img => `/images/${postId}/${img}`)
            : [];
          return res.json({ ...post, images });
        }
      } catch {}
    }
    
    res.status(404).json({ error: 'Post not found' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get carousel images for a post — always returns URL paths (never base64)
// The /images/:postId/:file route handles disk-or-memory serving transparently.
app.get('/api/posts/:postId/images', (req, res) => {
  const { postId } = req.params;

  // Count how many slides we have (check store, then disk)
  let count = 0;
  if (imageStore.has(postId)) {
    count = imageStore.get(postId).length;
  } else {
    const imageDir = path.join(IMAGES_DIR, postId);
    if (fs.existsSync(imageDir)) {
      count = fs.readdirSync(imageDir).filter(f => f.endsWith('.png')).length;
    }
  }

  if (count === 0) {
    return res.json({ images: [], post_id: postId });
  }

  // Return URL paths — browser fetches each as a normal <img src> request
  const images = Array.from({ length: count }, (_, i) => `/images/${postId}/slide_${i + 1}.png`);
  res.json({ images, post_id: postId });
});


// Trigger pipeline manually
app.post('/api/run-now', async (req, res) => {
  const state = getPipelineState();
  
  if (state.status === 'running') {
    return res.status(409).json({ 
      error: 'Pipeline already running',
      current_step: state.currentStep 
    });
  }
  
  // Start pipeline asynchronously
  res.json({ 
    message: 'Pipeline started! Check /api/status for progress.',
    run_started_at: new Date().toISOString()
  });
  
  // Run in PREVIEW ONLY — generates + renders, waits for manual approval
  runPipeline({ publishNow: false, skipPublish: true, broadcast })
    .catch(err => console.error('Background pipeline error:', err));
});

// Preview run — generates content + images but does NOT post to Instagram
app.post('/api/run-preview', async (req, res) => {
  const state = getPipelineState();
  
  if (state.status === 'running') {
    return res.status(409).json({ 
      error: 'Pipeline already running',
      current_step: state.currentStep 
    });
  }
  
  res.json({ 
    message: '🟡 Preview pipeline started! Content will be generated but NOT posted to Instagram.',
    mode: 'preview',
    run_started_at: new Date().toISOString()
  });
  
  // Run in background with skipPublish = true
  runPipeline({ publishNow: false, skipPublish: true, broadcast })
    .catch(err => console.error('Preview pipeline error:', err));
});

// ✅ APPROVE & PUBLISH — Manual approval by Mani before anything goes to Instagram
app.post('/api/approve-publish', async (req, res) => {
  try {
    const state = getPipelineState();
    if (state.status === 'running') {
      return res.status(409).json({ error: 'Pipeline is currently running. Please wait.' });
    }

    // Load today's generated post
    const today = new Date().toISOString().split('T')[0];
    const todayFile = path.join(POSTS_DIR, `${today}.json`);

    if (!fs.existsSync(todayFile)) {
      return res.status(404).json({
        error: 'No content generated yet today. Run the pipeline first, review slides, then approve.',
        hint: 'Click "Generate Today\'s Post" first.'
      });
    }

    const data = JSON.parse(fs.readFileSync(todayFile, 'utf-8'));
    const posts = data.content?.posts;

    if (!posts || posts.length === 0) {
      return res.status(400).json({ error: 'No posts found in today\'s content file.' });
    }

    // Check if already published today
    const alreadyPublished = posts.some(p => p.instagram_post_id);
    if (alreadyPublished) {
      return res.status(409).json({
        error: 'Today\'s post has already been published to Instagram.',
        post_id: posts.find(p => p.instagram_post_id)?.instagram_post_id
      });
    }

    res.json({
      message: '✅ Approval received! Publishing to Instagram now...',
      posts_to_publish: posts.length,
      headline: posts[0]?.headline,
      approved_at: new Date().toISOString()
    });

    console.log('\n✅ MANUAL APPROVAL RECEIVED — Publishing to Instagram...');
    broadcast({
      type: 'publish_approved',
      message: '✅ You approved! Publishing to Instagram now...',
      headline: posts[0]?.headline
    });

    // Publish using existing content + rendered images (no re-generation)
    const { renderAllCarousels } = require('./services/carouselRenderer');
    const { publisher: igPublisher } = require('./services/instagramPublisher');

    // Re-render if needed (images may already exist)
    const imageDir = path.join(IMAGES_DIR, posts[0].post_id);
    let imagePaths = [];
    if (fs.existsSync(imageDir)) {
      imagePaths = fs.readdirSync(imageDir)
        .filter(f => f.endsWith('.png'))
        .sort((a, b) => {
          const numA = parseInt(a.match(/\d+/) || [0]);
          const numB = parseInt(b.match(/\d+/) || [0]);
          return numA - numB;
        })
        .map(f => path.join(imageDir, f));
      console.log(`📸 Found ${imagePaths.length} existing slides — publishing directly`);
    } else {
      console.log('🎨 Re-rendering slides before publish...');
      const rendered = await renderAllCarousels(data.content);
      imagePaths = rendered[0]?.image_paths || [];
    }

    // Publish each post
    for (const post of posts) {
      try {
        console.log(`📤 Publishing: ${post.headline}`)
        const result = await igPublisher.publishPost(post, imagePaths);
        if (result?.instagram_post_id) {
          post.instagram_post_id = result.instagram_post_id;
          post.published_at = new Date().toISOString();
          broadcast({
            type: 'publish_complete',
            message: `🎉 Published! Instagram Post ID: ${result.instagram_post_id}`,
            instagram_post_id: result.instagram_post_id,
            headline: post.headline
          });
          console.log(`✅ Published! Instagram Post ID: ${result.instagram_post_id}`);
        } else if (result?.status === 'failed') {
          throw new Error(result.error || 'Publishing returned no post ID');
        }
      } catch (err) {
        console.error(`❌ Publish failed: ${err.message}`);
        broadcast({ type: 'publish_error', message: `❌ Publish failed: ${err.message}` });
      }
    }

    // Save updated post data with instagram_post_id
    fs.writeFileSync(todayFile, JSON.stringify({ ...data, content: { ...data.content, posts } }, null, 2));

  } catch (error) {
    console.error('Approve-publish error:', error);
    broadcast({ type: 'publish_error', message: `❌ Error: ${error.message}` });
  }
});

// Get analytics
app.get('/api/analytics', (req, res) => {
  try {
    const analytics = getAnalytics();
    res.json(analytics);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get recent posts with analytics
app.get('/api/analytics/recent', (req, res) => {
  const limit = parseInt(req.query.limit) || 10;
  res.json(getRecentPosts(limit));
});

// Get automation logs
app.get('/api/logs', (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 50;
    const state = getPipelineState();
    res.json({
      logs: state.logs.slice(0, limit),
      total: state.logs.length
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get schedule info
app.get('/api/schedule', (req, res) => {
  res.json(getScheduleStatus());
});

// ================================
// NEW ENDPOINTS
// ================================

// GET /api/latest - return the most recently generated post
app.get('/api/latest', (req, res) => {
  try {
    const result = loadLatestPostFile();
    if (!result) {
      return res.status(404).json({ error: 'No posts generated yet. Run the pipeline first.' });
    }
    res.json(result.data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/generate - trigger pipeline (generate + render, no publish)
app.post('/api/generate', async (req, res) => {
  const state = getPipelineState();

  if (state.status === 'running') {
    return res.status(409).json({
      error: 'Pipeline already running',
      current_step: state.currentStep
    });
  }

  // Extract picker options from request body
  const { pattern, theme, mode, topic } = req.body || {};
  const validPatterns = ['A', 'B', 'C', 'D', 'E', 'auto'];
  const validThemes = ['cyber_dark','neon_purple','sunset_fire','matrix_green','rose_gold','ocean_deep','midnight_red','golden_hour'];
  const safePattern = validPatterns.includes(pattern) ? pattern : 'auto';
  const safeTheme   = validThemes.includes(theme) ? theme : 'cyber_dark';

  res.json({
    message: `Pipeline started! Pattern: ${safePattern} | Theme: ${safeTheme}. Check /api/status for progress.`,
    started_at: new Date().toISOString(),
    options: { pattern: safePattern, theme: safeTheme }
  });

  // Run in background — generate + render only, no publish
  runPipeline({
    publishNow: false,
    skipPublish: true,
    pattern: safePattern,
    theme: safeTheme,
    broadcast,
    onImagesReady: (postId, base64s) => imageStore.set(postId, base64s)
  }).catch(err => console.error('Background pipeline error (/api/generate):', err));
});

// POST /api/generate/evergreen - generate timeless content without live news
app.post('/api/generate/evergreen', async (req, res) => {
  const state = getPipelineState();

  if (state.status === 'running') {
    return res.status(409).json({
      error: 'Pipeline already running',
      current_step: state.currentStep
    });
  }

  const { pattern, theme, topic } = req.body || {};
  const validPatterns = ['A', 'B', 'C', 'D', 'E', 'auto'];
  const validThemes = ['cyber_dark','neon_purple','sunset_fire','matrix_green','rose_gold','ocean_deep','midnight_red','golden_hour'];
  const safePattern = validPatterns.includes(pattern) ? pattern : 'auto';
  const safeTheme   = validThemes.includes(theme) ? theme : 'cyber_dark';
  const safeTopic   = typeof topic === 'string' && topic.trim().length > 0 ? topic.trim() : null;

  res.json({
    message: `Evergreen pipeline started! Topic: ${safeTopic || 'auto-selected'}. Check /api/status for progress.`,
    started_at: new Date().toISOString(),
    options: { pattern: safePattern, theme: safeTheme, topic: safeTopic, mode: 'evergreen' }
  });

  runPipeline({
    publishNow: false,
    skipPublish: true,
    mode: 'evergreen',
    topic: safeTopic,
    pattern: safePattern,
    theme: safeTheme,
    broadcast,
    onImagesReady: (postId, base64s) => imageStore.set(postId, base64s)
  }).catch(err => console.error('Background pipeline error (/api/generate/evergreen):', err));
});



// POST /api/regenerate - regenerate with a completely fresh topic (skip current)
app.post('/api/regenerate', async (req, res) => {
  const state = getPipelineState();

  if (state.status === 'running') {
    return res.status(409).json({
      error: 'Pipeline already running',
      current_step: state.currentStep
    });
  }

  // Gather headlines already used today to exclude them
  const excludeTopics = [];
  try {
    const today = new Date().toISOString().split('T')[0];
    const todayFile = path.join(POSTS_DIR, `${today}.json`);
    if (fs.existsSync(todayFile)) {
      const data = JSON.parse(fs.readFileSync(todayFile, 'utf-8'));
      const posts = data.content?.posts || [];
      posts.forEach(p => { if (p.headline) excludeTopics.push(p.headline); });
    }
  } catch { /* ignore — proceed with empty exclusion list */ }

  res.json({
    message: 'Regenerating with a fresh topic in the background. Check /api/status for progress.',
    excluded_topics: excludeTopics,
    started_at: new Date().toISOString()
  });

  // Run research + filter + content + render in background
  (async () => {
    try {
      broadcast({ type: 'regenerate_started', message: '🔄 Regenerating post with a fresh topic...' });

      const contentData = await regeneratePost(excludeTopics);

      // Save new post file (overwrite today's file with regenerated content)
      const today = new Date().toISOString().split('T')[0];
      const todayFile = path.join(POSTS_DIR, `${today}.json`);
      const existing = fs.existsSync(todayFile)
        ? JSON.parse(fs.readFileSync(todayFile, 'utf-8'))
        : {};

      fs.writeFileSync(todayFile, JSON.stringify({
        ...existing,
        run_id: existing.run_id || `regen_${Date.now()}`,
        content: contentData,
        regenerated_at: new Date().toISOString()
      }, null, 2));

      // Render carousels for the new post
      const { renderAllCarousels } = require('./services/carouselRenderer');
      const carouselResults = await renderAllCarousels(contentData);
      const totalImages = carouselResults.reduce((sum, r) => sum + r.image_paths.length, 0);

      // Store base64 images in memory — survives disk wipes
      carouselResults.forEach(r => {
        if (r.image_base64s && r.image_base64s.length > 0) {
          imageStore.set(r.post_id, r.image_base64s);
        }
      });

      broadcast({
        type: 'regenerate_complete',
        message: `✅ New post ready: "${contentData.posts[0]?.headline}" (${totalImages} slides rendered)`,
        headline: contentData.posts[0]?.headline
      });

    } catch (err) {
      console.error('Background regenerate error:', err);
      broadcast({ type: 'regenerate_error', message: `❌ Regeneration failed: ${err.message}` });
    }
  })();
});

// POST /api/edit-content - rewrite content based on a user instruction
app.post('/api/edit-content', async (req, res) => {
  const { instruction } = req.body || {};

  if (!instruction || typeof instruction !== 'string' || !instruction.trim()) {
    return res.status(400).json({ error: 'Missing required field: instruction (string)' });
  }

  // Load latest post to edit
  const latest = loadLatestPostFile();
  if (!latest) {
    return res.status(404).json({
      error: 'No post found to edit. Run the pipeline first.',
      hint: 'Use /api/generate to create a post first.'
    });
  }

  const posts = latest.data.content?.posts;
  if (!posts || posts.length === 0) {
    return res.status(400).json({ error: 'No posts found in the latest content file.' });
  }

  res.json({
    message: `Editing content with instruction: "${instruction.trim()}" — running in background.`,
    post_count: posts.length,
    started_at: new Date().toISOString()
  });

  // Run editing + re-render in background
  (async () => {
    try {
      broadcast({
        type: 'edit_started',
        message: `✏️ Editing content: "${instruction.trim()}"`
      });

      // Edit every post in the file (usually just 1)
      const updatedPosts = [];
      for (const post of posts) {
        const updatedPost = await editContent(post, instruction.trim());
        updatedPosts.push(updatedPost);
      }

      // Save updated content back to the same file
      const updatedData = {
        ...latest.data,
        content: {
          ...latest.data.content,
          posts: updatedPosts
        },
        last_edited_at: new Date().toISOString(),
        last_edit_instruction: instruction.trim()
      };
      fs.writeFileSync(latest.filePath, JSON.stringify(updatedData, null, 2));

      // Re-render carousels with updated content
      const { renderAllCarousels } = require('./services/carouselRenderer');
      const carouselResults = await renderAllCarousels(updatedData.content);
      const totalImages = carouselResults.reduce((sum, r) => sum + r.image_paths.length, 0);

      // Store base64 images in memory
      carouselResults.forEach(r => {
        if (r.image_base64s && r.image_base64s.length > 0) {
          imageStore.set(r.post_id, r.image_base64s);
        }
      });

      broadcast({
        type: 'edit_complete',
        message: `✅ Content updated and ${totalImages} slides re-rendered. Review in dashboard.`,
        instruction: instruction.trim()
      });

    } catch (err) {
      console.error('Background edit-content error:', err);
      broadcast({ type: 'edit_error', message: `❌ Edit failed: ${err.message}` });
    }
  })();
});

// POST /api/posts/:postId/approve - approve a specific post for publishing
app.post('/api/posts/:postId/approve', async (req, res) => {
  const { postId } = req.params;

  try {
    // Find the post file containing this postId
    const files = fs.readdirSync(POSTS_DIR).filter(f => f.endsWith('.json') && !f.startsWith('run_'));
    let targetFile = null;
    let targetData = null;
    let targetPost = null;

    for (const file of files) {
      try {
        const data = JSON.parse(fs.readFileSync(path.join(POSTS_DIR, file), 'utf-8'));
        const post = data.content?.posts?.find(p => p.post_id === postId);
        if (post) {
          targetFile = path.join(POSTS_DIR, file);
          targetData = data;
          targetPost = post;
          break;
        }
      } catch { /* skip unreadable files */ }
    }

    if (!targetPost) {
      return res.status(404).json({ error: `Post not found: ${postId}` });
    }

    if (targetPost.instagram_post_id) {
      return res.status(409).json({
        error: 'This post has already been published to Instagram.',
        instagram_post_id: targetPost.instagram_post_id
      });
    }

    res.json({
      message: `✅ Approval received for post "${targetPost.headline}" — publishing to Instagram now...`,
      post_id: postId,
      headline: targetPost.headline,
      approved_at: new Date().toISOString()
    });

    // Publish in background
    (async () => {
      try {
        broadcast({
          type: 'publish_approved',
          message: `✅ Publishing: "${targetPost.headline}"...`,
          post_id: postId
        });

        const { renderAllCarousels } = require('./services/carouselRenderer');
        const { publisher: igPublisher } = require('./services/instagramPublisher');

        // Use existing rendered images if available, otherwise re-render
        const imageDir = path.join(IMAGES_DIR, postId);
        let imagePaths = [];
        if (fs.existsSync(imageDir)) {
          imagePaths = fs.readdirSync(imageDir)
            .filter(f => f.endsWith('.png'))
            .sort((a, b) => {
              const numA = parseInt(a.match(/\d+/) || [0]);
              const numB = parseInt(b.match(/\d+/) || [0]);
              return numA - numB;
            })
            .map(f => path.join(imageDir, f));
          console.log(`📸 Found ${imagePaths.length} existing slides for post ${postId}`);
        } else {
          console.log('🎨 No existing slides — re-rendering before publish...');
          const rendered = await renderAllCarousels({ posts: [targetPost] });
          imagePaths = rendered[0]?.image_paths || [];
        }

        const result = await igPublisher.publishPost(targetPost, imagePaths);

        if (result?.instagram_post_id) {
          targetPost.instagram_post_id = result.instagram_post_id;
          targetPost.published_at = new Date().toISOString();

          // Persist the updated instagram_post_id back to file
          const updatedPosts = targetData.content.posts.map(p =>
            p.post_id === postId ? targetPost : p
          );
          fs.writeFileSync(targetFile, JSON.stringify({
            ...targetData,
            content: { ...targetData.content, posts: updatedPosts }
          }, null, 2));

          broadcast({
            type: 'publish_complete',
            message: `🎉 Published! Instagram Post ID: ${result.instagram_post_id}`,
            instagram_post_id: result.instagram_post_id,
            headline: targetPost.headline
          });
          console.log(`✅ Published post ${postId} — Instagram ID: ${result.instagram_post_id}`);
        } else if (result?.status === 'failed') {
          throw new Error(result.error || 'Publishing returned no post ID');
        }
      } catch (err) {
        console.error(`❌ Approve-publish error for ${postId}:`, err.message);
        broadcast({ type: 'publish_error', message: `❌ Publish failed: ${err.message}` });
      }
    })();

  } catch (error) {
    console.error('Approve endpoint error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Serve dashboard for all frontend routes
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/index.html'));
});

// ================================
// START SERVER
// ================================
server.listen(PORT, async () => {
  console.log('\n' + '='.repeat(60));
  console.log('🤖 AI INSTAGRAM AUTOMATION SYSTEM');
  console.log('='.repeat(60));
  console.log(`🌐 Dashboard: http://localhost:${PORT}`);
  console.log(`📡 WebSocket: ws://localhost:${PORT}`);
  console.log(`📱 Instagram: ${publisher.isConfigured ? '🟢 LIVE MODE' : '🟡 PREVIEW MODE'}`);
  console.log(`🔑 Gemini API: ${process.env.GEMINI_API_KEY ? '🟢 Connected' : '🔴 Missing'}`);
  console.log('='.repeat(60));

  // Set up public image URL for Instagram API
  // On Render.com (production): use RENDER_EXTERNAL_URL or PUBLIC_BASE_URL env var
  // On local dev: use ngrok tunnel
  if (publisher.isConfigured) {
    const envPublicUrl = process.env.PUBLIC_BASE_URL || process.env.RENDER_EXTERNAL_URL;
    if (envPublicUrl) {
      // Production / cloud deployment — use the hosted URL directly
      setPublicBaseUrl(envPublicUrl);
      console.log(`✅ Public URL set from environment: ${envPublicUrl}`);
      console.log(`📸 Instagram can fetch images from: ${envPublicUrl}/images/`);
    } else {
      // Local dev — try ngrok
      try {
        console.log('\n🔗 Starting ngrok tunnel for local image hosting...');
        const ngrok = require('@ngrok/ngrok');
        const listener = await ngrok.forward({
          addr: PORT,
          authtoken: process.env.NGROK_AUTHTOKEN,
        });
        const publicUrl = listener.url();
        setPublicBaseUrl(publicUrl);
        console.log(`✅ ngrok tunnel active: ${publicUrl}`);
        console.log(`📸 Instagram can fetch images from: ${publicUrl}/images/`);
      } catch (err) {
        console.warn(`⚠️  ngrok tunnel failed: ${err.message}`);
        console.warn('   Set PUBLIC_BASE_URL env var to your server\'s public URL.');
      }
    }
  }

  // Start the scheduler
  setupScheduler();

  console.log('\n🚀 System ready! Open the dashboard to monitor automation.');
});

module.exports = app;
