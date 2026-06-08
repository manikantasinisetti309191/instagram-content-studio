/**
 * News Filter Agent
 * Uses AI to score and select the top 5 most viral and valuable
 * AI news items from the researched pool
 */

require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });
const { callGemini } = require('./geminiHelper');

const FILTER_PROMPT = (newsItems) => `You are an elite social media strategist for @learnwithmanii \u2014 an Instagram channel teaching AI to students, employees, engineers and entrepreneurs.

Your job: Select the SINGLE BEST news item for today's Instagram post. This must be the one story that will give maximum value to our audience TODAY.

NEWS ITEMS TO EVALUATE:
${JSON.stringify(newsItems, null, 2)}

AUDIENCE: Students, employees, AI engineers, business owners who want to LEARN and APPLY AI.

SELECTION CRITERIA (score each 1-10):
1. VIRAL_POTENTIAL: Would this trend and get shared widely?
2. LEARNING_VALUE: Does this teach something genuinely useful?
3. CAREER_RELEVANCE: Does this impact jobs, skills, or career growth?
4. VISUAL_APPEAL: Can this make a stunning 10-slide Instagram carousel?
5. HOOK_POWER: Does this headline stop the scroll instantly?
6. ACTIONABILITY: Can the audience use this knowledge immediately?
7. UNIQUENESS: Is this something they haven't seen covered yet?

FINAL SCORE = (viral×0.20) + (learning×0.25) + (career×0.20) + (visual×0.10) + (hook×0.15) + (actionability×0.10)

Rules:
- Select EXACTLY 1 item \u2014 the absolute best one for today
- Prefer topics with depth that can fill 10 educational slides
- Avoid pure funding/acquisition news unless it has major impact
- Strongly prefer: AI tools people can use TODAY, career impact stories, practical how-tos

Return ONLY valid JSON:
{
  "selected_items": [
    {
      "rank": 1,
      "item_id": "string",
      "headline": "string",
      "selection_reason": "Why this will be valuable and engaging for our audience (2-3 sentences)",
      "viral_potential": number,
      "learning_value": number,
      "career_relevance": number,
      "visual_appeal": number,
      "hook_power": number,
      "actionability": number,
      "final_score": number,
      "instagram_angle": "The specific educational angle to take for Instagram (1-2 sentences)",
      "key_teaching_points": ["point1", "point2", "point3", "point4", "point5"]
    }
  ],
  "filter_date": "ISO timestamp",
  "total_evaluated": number
}`;

async function filterTopNews(newsData) {
  console.log('🎯 Starting news filtering...');
  console.log(`📊 Evaluating ${newsData.news_items.length} news items...`);
  
  try {
    const { text } = await callGemini(FILTER_PROMPT(newsData.news_items), 'filter');
    
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('Could not extract JSON from filter response');
    
    const filterResult = JSON.parse(jsonMatch[0]);
    
    // Merge full news data with filter results
    const selectedNewsMap = new Map(newsData.news_items.map(item => [item.id, item]));
    
    const enrichedSelection = filterResult.selected_items.map(selected => {
      const fullItem = selectedNewsMap.get(selected.item_id) || 
        newsData.news_items.find(n => n.headline === selected.headline) ||
        newsData.news_items[filterResult.selected_items.indexOf(selected)];
      
      return {
        ...selected,
        ...fullItem,
        rank: selected.rank,
        selection_reason: selected.selection_reason,
        instagram_angle: selected.instagram_angle,
        final_score: selected.final_score
      };
    });
    
    filterResult.selected_items = enrichedSelection;
    filterResult.filter_date = new Date().toISOString();
    filterResult.total_evaluated = newsData.news_items.length;
    
    console.log('✅ Filtering complete! Top 5 selected:');
    enrichedSelection.forEach((item, i) => {
      console.log(`  ${i + 1}. ${item.emoji || '📰'} ${item.headline} (Score: ${item.final_score?.toFixed(1) || 'N/A'})`);
    });
    
    return filterResult;
    
  } catch (error) {
    console.error('❌ Filter agent error:', error.message);
    
    // Fallback: sort by combined scores and take top 5
    const scored = newsData.news_items.map(item => ({
      ...item,
      final_score: ((item.viral_score || 5) + (item.relevance_score || 5) + (item.innovation_score || 5)) / 3
    })).sort((a, b) => b.final_score - a.final_score).slice(0, 5);
    
    return {
      selected_items: scored.map((item, i) => ({
        ...item,
        rank: i + 1,
        selection_reason: 'Auto-selected based on score',
        instagram_angle: `Breaking: ${item.headline}`
      })),
      filter_date: new Date().toISOString(),
      total_evaluated: newsData.news_items.length
    };
  }
}

// Test mode
if (process.argv.includes('--test')) {
  const { researchAINews } = require('./researchAgent');
  researchAINews().then(filterTopNews).then(result => {
    console.log('\n🏆 TOP 5 SELECTED POSTS:');
    result.selected_items.forEach(item => {
      console.log(`\n#${item.rank}: ${item.headline}`);
      console.log(`   Score: ${item.final_score}`);
      console.log(`   Angle: ${item.instagram_angle}`);
    });
  }).catch(console.error);
}

module.exports = { filterTopNews };
