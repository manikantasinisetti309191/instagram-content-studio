/**
 * Topic Memory Agent
 * Tracks every generated topic for 30 days to prevent repetition.
 * Stores data in backend/data/topicMemory.json.
 * Also tracks which patterns and categories are used most.
 */

const fs   = require('fs');
const path = require('path');

const MEMORY_FILE   = path.join(__dirname, '../data/topicMemory.json');
const RETENTION_DAYS = 30;

// Ensure data directory exists
if (!fs.existsSync(path.dirname(MEMORY_FILE))) {
  fs.mkdirSync(path.dirname(MEMORY_FILE), { recursive: true });
}

// ─── PERSISTENCE ─────────────────────────────────────────────────────────────
function loadMemory() {
  try {
    if (fs.existsSync(MEMORY_FILE)) {
      return JSON.parse(fs.readFileSync(MEMORY_FILE, 'utf-8'));
    }
  } catch (e) {
    console.warn('[TopicMemory] Failed to load memory, starting fresh:', e.message);
  }
  return { topics: [], patterns: {}, categories: {} };
}

function saveMemory(memory) {
  try {
    fs.writeFileSync(MEMORY_FILE, JSON.stringify(memory, null, 2));
  } catch (e) {
    console.warn('[TopicMemory] Failed to save:', e.message);
  }
}

// ─── HELPERS ─────────────────────────────────────────────────────────────────
function pruneOldEntries(memory) {
  const cutoff = Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000;
  memory.topics = (memory.topics || []).filter(
    t => new Date(t.generated_at).getTime() > cutoff
  );
  return memory;
}

function normalizeHeadline(headline) {
  return String(headline).toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

// Returns true if two headlines share ≥60% of significant words
function isSimilar(a, b, threshold = 0.6) {
  const stopWords = new Set(['the','and','for','with','that','this','from','have','will','are','its','how','why','what','who','can','you']);
  const words = str => new Set(
    normalizeHeadline(str).split(' ').filter(w => w.length > 3 && !stopWords.has(w))
  );
  const wa = words(a), wb = words(b);
  if (wa.size === 0 || wb.size === 0) return false;
  const overlap = [...wa].filter(w => wb.has(w)).length;
  return overlap / Math.min(wa.size, wb.size) >= threshold;
}

// ─── PUBLIC API ───────────────────────────────────────────────────────────────

/**
 * Check if a headline was recently generated
 */
function wasRecentlyUsed(headline) {
  const memory = pruneOldEntries(loadMemory());
  for (const topic of memory.topics) {
    if (isSimilar(headline, topic.headline)) {
      const daysAgo = Math.floor(
        (Date.now() - new Date(topic.generated_at).getTime()) / (1000 * 60 * 60 * 24)
      );
      return { used: true, last_used: topic.headline, days_ago: daysAgo };
    }
  }
  return { used: false };
}

/**
 * Filter news items — remove recently used topics
 * Returns { fresh: Array, skipped: Array }
 */
function filterFreshTopics(newsItems) {
  const fresh   = [];
  const skipped = [];
  for (const item of newsItems) {
    const check = wasRecentlyUsed(item.headline);
    if (check.used) {
      skipped.push({ ...item, skip_reason: `Used ${check.days_ago}d ago: "${check.last_used}"` });
      console.log(`[TopicMemory] Skipping (used ${check.days_ago}d ago): ${item.headline}`);
    } else {
      fresh.push(item);
    }
  }
  if (skipped.length > 0) {
    console.log(`[TopicMemory] ${fresh.length} fresh topics | ${skipped.length} skipped as repeats`);
  }
  return { fresh, skipped };
}

/**
 * Record a topic after generation — call once per generated post
 */
function recordTopic(post) {
  if (!post?.headline) return;
  const memory = pruneOldEntries(loadMemory());

  memory.topics.push({
    headline:      post.headline,
    pattern:       post.pattern  || 'unknown',
    category:      post.category || 'unknown',
    post_id:       post.post_id  || null,
    generated_at:  new Date().toISOString(),
  });

  // Track frequency counts
  if (post.pattern)  memory.patterns[post.pattern]   = (memory.patterns[post.pattern]   || 0) + 1;
  if (post.category) memory.categories[post.category] = (memory.categories[post.category] || 0) + 1;

  saveMemory(memory);
  console.log(`[TopicMemory] Recorded: "${post.headline}" (Pattern ${post.pattern})`);
}

/**
 * Get stats for dashboard / API
 */
function getMemoryStats() {
  const memory = pruneOldEntries(loadMemory());
  const patternEntries  = Object.entries(memory.patterns  || {});
  const categoryEntries = Object.entries(memory.categories || {});
  return {
    total_topics_30_days: memory.topics.length,
    recent_topics: memory.topics.slice(-5).reverse().map(t => ({
      headline: t.headline,
      pattern:  t.pattern,
      days_ago: Math.floor((Date.now() - new Date(t.generated_at).getTime()) / (1000 * 60 * 60 * 24)),
    })),
    pattern_usage:       memory.patterns  || {},
    category_usage:      memory.categories || {},
    most_used_pattern:   patternEntries.sort((a,b) => b[1]-a[1])[0]?.[0]  || 'none',
    least_used_pattern:  patternEntries.sort((a,b) => a[1]-b[1])[0]?.[0]  || 'none',
    top_category:        categoryEntries.sort((a,b) => b[1]-a[1])[0]?.[0] || 'none',
  };
}

/**
 * Get recent headlines for UI display
 */
function getRecentHeadlines(limit = 10) {
  const memory = pruneOldEntries(loadMemory());
  return memory.topics
    .slice(-limit)
    .reverse()
    .map(t => ({
      headline: t.headline,
      pattern:  t.pattern,
      days_ago: Math.floor((Date.now() - new Date(t.generated_at).getTime()) / (1000 * 60 * 60 * 24)),
    }));
}

module.exports = {
  wasRecentlyUsed,
  filterFreshTopics,
  recordTopic,
  getMemoryStats,
  getRecentHeadlines,
};
