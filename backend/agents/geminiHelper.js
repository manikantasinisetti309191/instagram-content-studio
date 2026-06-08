/**
 * Gemini AI Helper
 * Handles model fallback chain + retry logic
 * Chain: gemini-2.5-flash → gemini-1.5-flash → gemini-1.5-flash-8b
 */

require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });
const { GoogleGenerativeAI } = require('@google/generative-ai');

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// Model fallback chain — tries each in order if previous is unavailable
const MODEL_CHAIN = [
  'gemini-2.5-flash',
  'gemini-1.5-flash',
  'gemini-1.5-flash-8b'
];

const GENERATION_CONFIGS = {
  research:  { temperature: 0.7, topK: 40, topP: 0.95, maxOutputTokens: 8192 },
  filter:    { temperature: 0.6, topK: 40, topP: 0.95, maxOutputTokens: 4096 },
  content:   { temperature: 0.8, topK: 40, topP: 0.95, maxOutputTokens: 8192 },
};

/**
 * Call Gemini with automatic model fallback + retries
 * @param {string} prompt - The prompt to send
 * @param {string} configType - 'research' | 'filter' | 'content'
 * @returns {string} - The text response
 */
async function callGemini(prompt, configType = 'content') {
  const config = GENERATION_CONFIGS[configType] || GENERATION_CONFIGS.content;
  const errors = [];

  for (const modelName of MODEL_CHAIN) {
    // Try each model up to 2 times
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        console.log(`🤖 Trying model: ${modelName} (attempt ${attempt})...`);
        const model = genAI.getGenerativeModel({ model: modelName, generationConfig: config });
        const result = await model.generateContent(prompt);
        const text = result.response.text();
        console.log(`✅ Success with model: ${modelName}`);
        return { text, model: modelName };
      } catch (err) {
        const msg = err.message || '';
        const is503 = msg.includes('503') || msg.includes('overloaded') || msg.includes('high demand') || msg.includes('Service Unavailable');
        const is429 = msg.includes('429') || msg.includes('quota') || msg.includes('rate limit');
        const is404 = msg.includes('404') || msg.includes('not found');

        errors.push(`${modelName} attempt ${attempt}: ${msg.substring(0, 80)}`);
        console.log(`⚠️  ${modelName} attempt ${attempt} failed: ${is503 ? '503 busy' : is429 ? '429 quota' : is404 ? '404 not found' : 'error'}`);

        if (is404) break; // Model doesn't exist, try next immediately
        if (is503 || is429) {
          if (attempt < 2) {
            const wait = attempt * 8000; // 8s, 16s
            console.log(`⏳ Waiting ${wait/1000}s before retry...`);
            await new Promise(r => setTimeout(r, wait));
          }
        }
      }
    }
    console.log(`🔄 Moving to next model in chain...`);
  }

  console.error('❌ All models failed. Errors:', errors);
  throw new Error(`All Gemini models unavailable: ${errors.slice(-1)[0]}`);
}

module.exports = { callGemini };
