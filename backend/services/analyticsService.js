/**
 * Analytics Service
 * Tracks and stores Instagram post engagement metrics
 * Updates analytics data and generates insights for dashboard
 */

require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });
const fs = require('fs');
const path = require('path');
const { publisher } = require('./instagramPublisher');

const ANALYTICS_DIR = path.join(__dirname, '../data/analytics');
const ANALYTICS_FILE = path.join(ANALYTICS_DIR, 'analytics.json');

if (!fs.existsSync(ANALYTICS_DIR)) {
  fs.mkdirSync(ANALYTICS_DIR, { recursive: true });
}

function loadAnalytics() {
  if (!fs.existsSync(ANALYTICS_FILE)) {
    return { posts: [], summary: {}, last_updated: null };
  }
  try {
    return JSON.parse(fs.readFileSync(ANALYTICS_FILE, 'utf-8'));
  } catch {
    return { posts: [], summary: {}, last_updated: null };
  }
}

function saveAnalytics(data) {
  data.last_updated = new Date().toISOString();
  fs.writeFileSync(ANALYTICS_FILE, JSON.stringify(data, null, 2));
}

async function trackPost(publishResult, postContent) {
  console.log(`📊 Tracking analytics for post: ${postContent.headline}`);
  
  const analytics = loadAnalytics();
  
  // Check if we already have this post
  const existingIndex = analytics.posts.findIndex(p => p.post_id === publishResult.post_id);
  
  // Fetch current metrics
  let metrics = null;
  if (publishResult.instagram_post_id) {
    metrics = await publisher.getPostAnalytics(publishResult.instagram_post_id);
  }
  
  const analyticsEntry = {
    post_id: publishResult.post_id,
    instagram_post_id: publishResult.instagram_post_id,
    rank: publishResult.rank,
    headline: postContent.headline,
    category: postContent.category,
    emoji: postContent.emoji,
    published_at: publishResult.published_at,
    status: publishResult.status,
    preview_mode: publishResult.preview_mode,
    metrics: metrics || {
      likes: 0,
      comments: 0,
      saves: 0,
      reach: 0,
      impressions: 0,
      engagement_rate: '0.00'
    },
    history: [],
    last_checked: new Date().toISOString()
  };
  
  if (existingIndex >= 0) {
    // Update existing entry, keep history
    const existing = analytics.posts[existingIndex];
    analyticsEntry.history = [
      ...(existing.history || []),
      { metrics: existing.metrics, checked_at: existing.last_checked }
    ].slice(-30); // Keep last 30 data points
    analytics.posts[existingIndex] = analyticsEntry;
  } else {
    analytics.posts.push(analyticsEntry);
  }
  
  // Update summary stats
  analytics.summary = computeSummary(analytics.posts);
  saveAnalytics(analytics);
  
  console.log(`  ✅ Analytics saved for: ${postContent.headline}`);
  return analyticsEntry;
}

async function refreshAllAnalytics() {
  console.log('🔄 Refreshing analytics for all posts...');
  const analytics = loadAnalytics();
  
  for (const post of analytics.posts) {
    if (post.instagram_post_id && post.status !== 'failed') {
      const metrics = await publisher.getPostAnalytics(post.instagram_post_id);
      if (metrics) {
        post.history = [
          ...(post.history || []),
          { metrics: post.metrics, checked_at: post.last_checked }
        ].slice(-30);
        post.metrics = metrics;
        post.last_checked = new Date().toISOString();
      }
    }
  }
  
  analytics.summary = computeSummary(analytics.posts);
  saveAnalytics(analytics);
  
  console.log(`✅ Analytics refreshed for ${analytics.posts.length} posts`);
  return analytics;
}

function computeSummary(posts) {
  if (!posts.length) return {};
  
  const recentPosts = posts.slice(-25); // Last 25 posts
  
  return {
    total_posts: posts.length,
    total_likes: recentPosts.reduce((sum, p) => sum + (p.metrics?.likes || 0), 0),
    total_comments: recentPosts.reduce((sum, p) => sum + (p.metrics?.comments || 0), 0),
    total_saves: recentPosts.reduce((sum, p) => sum + (p.metrics?.saves || 0), 0),
    total_reach: recentPosts.reduce((sum, p) => sum + (p.metrics?.reach || 0), 0),
    avg_engagement: (
      recentPosts.reduce((sum, p) => sum + parseFloat(p.metrics?.engagement_rate || 0), 0) / 
      recentPosts.length
    ).toFixed(2),
    best_post: recentPosts.sort((a, b) => (b.metrics?.likes || 0) - (a.metrics?.likes || 0))[0]?.headline,
    by_category: recentPosts.reduce((acc, p) => {
      const cat = p.category || 'Unknown';
      acc[cat] = (acc[cat] || 0) + 1;
      return acc;
    }, {}),
    computed_at: new Date().toISOString()
  };
}

function getAnalytics() {
  return loadAnalytics();
}

function getRecentPosts(limit = 10) {
  const analytics = loadAnalytics();
  return analytics.posts
    .sort((a, b) => new Date(b.published_at) - new Date(a.published_at))
    .slice(0, limit);
}

module.exports = { trackPost, refreshAllAnalytics, getAnalytics, getRecentPosts };
