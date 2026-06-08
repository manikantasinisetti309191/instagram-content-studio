/**
 * News Filter Agent
 * Selects the single best AI story for today's Instagram post.
 * Deduplicates against recent post headlines to prevent repetition.
 * Broadcasts clear status for all negative scenarios.
 */

require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });
const fs   = require('fs');
const path = require('path');
const { callGemini } = require('./geminiHelper');

const POSTS_DIR = path.join(__dirname, '../data/posts');

// ── Load recent headlines (past 7 days) to avoid repeats ─────────────────────
function getRecentHeadlines(days = 7) {
  const headlines = [];
  try {
    if (!fs.existsSync(POSTS_DIR)) return headlines;
    const files = fs.readdirSync(POSTS_DIR)
      .filter(f => f.endsWith('.json') && !f.startsWith('run_'))
      .sort().reverse().slice(0, days);
    for (const file of files) {
      try {
        const data = JSON.parse(fs.readFileSync(path.join(POSTS_DIR, file), 'utf-8'));
        const posts = data.content?.posts || [];
        posts.forEach(p => { if (p.headline) headlines.push(p.headline.toLowerCase()); });
      } catch {}
    }
  } catch {}
  return headlines;
}

function isDuplicate(headline, recentHeadlines) {
  const h = headline.toLowerCase();
  // Word-level overlap: if 3+ key words match a recent headline, it's a duplicate
  const keyWords = h.split(/\s+/).filter(w => w.length > 4);
  return recentHeadlines.some(recent => {
    const matches = keyWords.filter(w => recent.includes(w));
    return matches.length >= 3;
  });
}

const FILTER_PROMPT = (newsItems, recentHeadlines) => `You are an elite social media strategist for @learnwithmanii — an Instagram channel teaching AI to students, employees, engineers and entrepreneurs.

Your job: Select the SINGLE BEST news item for today's Instagram post.

NEWS ITEMS TO EVALUATE:
${JSON.stringify(newsItems, null, 2)}

RECENT POSTS (avoid these topics — we already covered them):
${recentHeadlines.length > 0 ? recentHeadlines.map(h => `- ${h}`).join('\n') : '- None (first post!)'}

AUDIENCE: Students, employees, AI engineers, business owners who want to LEARN and APPLY AI immediately.

SELECTION CRITERIA (score each 1-10):
1. VIRAL_POTENTIAL: Would this trend and get shared widely?
2. LEARNING_VALUE: Does this teach something genuinely useful TODAY?
3. CAREER_RELEVANCE: Does this directly impact jobs, skills, or income?
4. HOOK_POWER: Does this headline stop the scroll in 0.3 seconds?
5. ACTIONABILITY: Can the audience DO something with this knowledge today?
6. FRESHNESS: Is this new to our audience? (penalise if similar to recent posts above)
7. DEPTH: Can this topic fill 10 educational slides with real value?

FINAL_SCORE = (viral×0.20) + (learning×0.25) + (career×0.20) + (hook×0.15) + (actionability×0.10) + (freshness×0.10)

RULES:
- Select EXACTLY 1 item — the absolute best one
- NEVER select a topic already in "Recent Posts" above
- Prefer: practical tools people can use today, career impact, how-tos
- Avoid: pure funding news, vague "AI is advancing" stories

Return ONLY valid JSON:
{
  "selected_items": [
    {
      "rank": 1,
      "item_id": "string",
      "headline": "string",
      "selection_reason": "Why this will resonate with our audience (2-3 sentences)",
      "viral_potential": number,
      "learning_value": number,
      "career_relevance": number,
      "hook_power": number,
      "actionability": number,
      "freshness": number,
      "final_score": number,
      "instagram_angle": "The specific educational angle for Instagram (1-2 sentences)",
      "key_teaching_points": ["point1","point2","point3","point4","point5"]
    }
  ],
  "filter_date": "ISO timestamp",
  "total_evaluated": number
}`;

async function filterTopNews(newsData, options = {}) {
  const { broadcast = null } = options;
  console.log('🎯 Starting news filtering...');
  console.log(`📊 Evaluating ${newsData.news_items.length} news items...`);

  const recentHeadlines = getRecentHeadlines(7);
  if (recentHeadlines.length > 0) {
    console.log(`📋 Found ${recentHeadlines.length} recent headlines to avoid repeating`);
  }

  // Pre-filter: remove obvious duplicates before sending to AI
  const freshItems = newsData.news_items.filter(item => !isDuplicate(item.headline, recentHeadlines));
  const itemsToFilter = freshItems.length >= 3 ? freshItems : newsData.news_items; // Fall back to all if too many filtered

  if (freshItems.length < newsData.news_items.length) {
    console.log(`🔄 Filtered out ${newsData.news_items.length - freshItems.length} duplicate topics`);
    if (broadcast) broadcast({
      type: 'status_update',
      level: 'info',
      message: `🔄 Filtering out ${newsData.news_items.length - freshItems.length} recently covered topic(s) to keep content fresh`
    });
  }

  // Notify about fallback mode
  if (newsData.is_fallback && broadcast) {
    const msg = newsData.api_status === 'api_down'
      ? '⚠️ Gemini AI is temporarily busy — using our curated news library for today\'s content'
      : '⚠️ Using curated news library (live research unavailable right now)';
    broadcast({ type: 'api_warning', level: 'warning', message: msg });
  }

  try {
    const { text } = await callGemini(FILTER_PROMPT(itemsToFilter, recentHeadlines), 'filter');

    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('No JSON in filter response');

    const filterResult = JSON.parse(jsonMatch[0]);
    if (!filterResult.selected_items?.length) throw new Error('No selected_items in filter response');

    const selectedNewsMap = new Map(newsData.news_items.map(item => [item.id, item]));

    const enrichedSelection = filterResult.selected_items.map(selected => {
      const fullItem = selectedNewsMap.get(selected.item_id) ||
        newsData.news_items.find(n => n.headline?.toLowerCase() === selected.headline?.toLowerCase()) ||
        newsData.news_items[0]; // last resort

      // Final duplicate check — if AI still picked a repeat, warn and override
      if (fullItem && isDuplicate(fullItem.headline, recentHeadlines)) {
        console.warn(`⚠️ AI selected a duplicate: "${fullItem.headline}" — overriding with freshest item`);
        if (broadcast) broadcast({
          type: 'status_update', level: 'warning',
          message: `🔄 Overriding duplicate topic — selecting fresher content instead`
        });
        const fresh = itemsToFilter.find(i => !isDuplicate(i.headline, recentHeadlines));
        return { ...(fresh || fullItem), rank: 1, selection_reason: 'Auto-selected fresh topic', instagram_angle: `Breaking: ${(fresh || fullItem).headline}` };
      }

      return {
        ...selected, ...fullItem,
        rank: selected.rank,
        selection_reason: selected.selection_reason,
        instagram_angle: selected.instagram_angle,
        key_teaching_points: selected.key_teaching_points,
        final_score: selected.final_score
      };
    });

    filterResult.selected_items = enrichedSelection;
    filterResult.filter_date = new Date().toISOString();
    filterResult.total_evaluated = itemsToFilter.length;

    console.log('✅ Filtering complete! Today\'s story:');
    enrichedSelection.forEach(item => {
      console.log(`  📰 "${item.headline}" — Score: ${item.final_score?.toFixed(1) || 'N/A'}`);
    });

    return filterResult;

  } catch (error) {
    console.error('❌ Filter agent error:', error.message);

    // Smart fallback: pick highest-scored item that isn't a duplicate
    const scored = itemsToFilter
      .filter(item => !isDuplicate(item.headline, recentHeadlines))
      .map(item => ({
        ...item,
        final_score: ((item.viral_score || 5) + (item.relevance_score || 5) + (item.innovation_score || 5)) / 3
      }))
      .sort((a, b) => b.final_score - a.final_score);

    // If all are duplicates somehow, use all items
    const best = (scored.length > 0 ? scored : itemsToFilter)[0];

    return {
      selected_items: [{
        ...best,
        rank: 1,
        selection_reason: 'Auto-selected based on scores (AI filter temporarily unavailable)',
        instagram_angle: `Breaking: ${best.headline}`
      }],
      filter_date: new Date().toISOString(),
      total_evaluated: itemsToFilter.length
    };
  }
}

if (process.argv.includes('--test')) {
  const { researchAINews } = require('./researchAgent');
  researchAINews()
    .then(data => filterTopNews(data))
    .then(r => {
      console.log('\n🏆 SELECTED:');
      r.selected_items.forEach(i => console.log(`  #${i.rank}: ${i.headline} (${i.final_score})`));
    }).catch(console.error);
}

module.exports = { filterTopNews };
