/**
 * Shared Pattern Schema Registry
 * ─────────────────────────────────────────────────────────────
 * Single source of truth for ALL pattern field definitions.
 * Imported by: contentAgent, qualityAgent, carouselRenderer, integrationTest.
 * 
 * If a field name changes → change it HERE ONLY. Nothing else breaks.
 */

const PATTERN_NAMES = {
  A: 'Tool Spotlight',
  B: 'Prompt Playbook',
  C: 'Tutorial',
  D: 'Myth Busting',
  E: 'Comparison',
};

const PATTERN_SCHEMAS = {
  A: {
    slide_1:  ['label', 'tool_name', 'tagline', 'subtitle'],
    slide_2:  ['title', 'one_liner', 'analogy', 'key_fact'],
    slide_3:  ['use_case_title', 'who_its_for', 'step_1', 'step_2', 'step_3', 'time_saved'],
    slide_4:  ['use_case_title', 'who_its_for', 'step_1', 'step_2', 'step_3', 'time_saved'],
    slide_5:  ['use_case_title', 'who_its_for', 'step_1', 'step_2', 'step_3', 'time_saved'],
    slide_6:  ['slide_label', 'prompt_name', 'prompt_text', 'expected_output'],
    slide_7:  ['title', 'for_students', 'for_employees', 'for_creators', 'for_business'],
    slide_8:  ['title', 'step_1', 'step_2', 'step_3', 'closing_line'],
    slide_9:  ['title', 'limitation_1', 'limitation_2', 'still_worth_it'],
    slide_10: ['verdict', 'save_cta', 'follow_cta', 'comment_question'],
  },
  B: {
    slide_1:  ['label', 'headline', 'subtitle'],
    slide_2:  ['title', 'context', 'tease'],
    slide_3:  ['prompt_number', 'prompt_name', 'prompt_text', 'use_when', 'output_description'],
    slide_4:  ['prompt_number', 'prompt_name', 'prompt_text', 'use_when', 'output_description'],
    slide_5:  ['prompt_number', 'prompt_name', 'prompt_text', 'use_when', 'output_description'],
    slide_6:  ['prompt_number', 'prompt_name', 'prompt_text', 'use_when', 'output_description'],
    slide_7:  ['prompt_number', 'prompt_name', 'prompt_text', 'use_when', 'output_description'],
    slide_8:  ['prompt_number', 'prompt_name', 'prompt_text', 'use_when', 'output_description'],
    slide_9:  ['title', 'technique', 'before_example', 'after_example'],
    slide_10: ['verdict', 'save_cta', 'follow_cta', 'comment_question'],
  },
  C: {
    slide_1:  ['label', 'headline', 'subtitle'],
    slide_2:  ['deliverable', 'tools_needed', 'time_required', 'skill_level'],
    slide_3:  ['step_number', 'step_title', 'action', 'exact_input', 'expected_output', 'common_mistake'],
    slide_4:  ['step_number', 'step_title', 'action', 'exact_input', 'expected_output', 'common_mistake'],
    slide_5:  ['step_number', 'step_title', 'action', 'exact_input', 'expected_output', 'common_mistake'],
    slide_6:  ['step_number', 'step_title', 'action', 'exact_input', 'expected_output', 'common_mistake'],
    slide_7:  ['step_number', 'step_title', 'action', 'exact_input', 'expected_output', 'common_mistake'],
    slide_8:  ['step_number', 'step_title', 'action', 'exact_input', 'expected_output', 'common_mistake'],
    slide_9:  ['before_state', 'after_state', 'time_saved', 'quality_note'],
    slide_10: ['verdict', 'save_cta', 'follow_cta', 'comment_question'],
  },
  D: {
    slide_1:  ['label', 'headline', 'subtitle'],
    slide_2:  ['myth_text', 'truth_text', 'why_it_matters'],
    slide_3:  ['myth_text', 'truth_text', 'why_it_matters'],
    slide_4:  ['myth_text', 'truth_text', 'why_it_matters'],
    slide_5:  ['myth_text', 'truth_text', 'why_it_matters'],
    slide_6:  ['myth_text', 'truth_text', 'why_it_matters'],
    slide_7:  ['title', 'myth_text', 'truth_text', 'impact'],
    slide_8:  ['title', 'action_1', 'action_2', 'action_3'],
    slide_9:  ['title', 'honest_summary', 'bottom_line'],
    slide_10: ['verdict', 'comment_trigger', 'save_cta', 'follow_cta'],
  },
  E: {
    slide_1:  ['label', 'headline', 'subtitle'],
    slide_2:  ['tool_a', 'tool_b', 'categories_tested', 'disclaimer'],
    slide_3:  ['category', 'winner', 'tool_a_score', 'tool_a_reason', 'tool_b_score', 'tool_b_reason', 'key_difference'],
    slide_4:  ['category', 'winner', 'tool_a_score', 'tool_a_reason', 'tool_b_score', 'tool_b_reason', 'key_difference'],
    slide_5:  ['category', 'winner', 'tool_a_score', 'tool_a_reason', 'tool_b_score', 'tool_b_reason', 'key_difference'],
    slide_6:  ['category', 'winner', 'tool_a_score', 'tool_a_reason', 'tool_b_score', 'tool_b_reason', 'key_difference'],
    slide_7:  ['category', 'winner', 'tool_a_score', 'tool_a_reason', 'tool_b_score', 'tool_b_reason', 'key_difference'],
    slide_8:  ['tool_a_wins_for', 'tool_b_wins_for', 'overall_winner', 'verdict_reason'],
    slide_9:  ['for_students', 'for_professionals', 'for_budget', 'for_power_users'],
    slide_10: ['verdict', 'comment_trigger', 'save_cta', 'follow_cta'],
  },
};

// All valid pattern keys
const VALID_PATTERNS = Object.keys(PATTERN_SCHEMAS);

// Get schema for a pattern (returns null if invalid)
function getSchema(pattern) {
  return PATTERN_SCHEMAS[pattern] || null;
}

// Get required fields for a specific slide in a pattern
function getSlideFields(pattern, slideKey) {
  return (PATTERN_SCHEMAS[pattern] || {})[slideKey] || [];
}

// Validate that a post's slides contain all required fields
function validatePostSchema(post) {
  const schema = PATTERN_SCHEMAS[post.pattern];
  if (!schema) return { valid: true, issues: [] }; // unknown pattern — skip
  const issues = [];
  for (const [slideKey, fields] of Object.entries(schema)) {
    const slide = post.slides?.[slideKey] || {};
    for (const field of fields) {
      if (!slide[field] || String(slide[field]).trim().length < 2) {
        issues.push(`${slideKey}.${field}: missing`);
      }
    }
  }
  return { valid: issues.length === 0, issues };
}

module.exports = { PATTERN_NAMES, PATTERN_SCHEMAS, VALID_PATTERNS, getSchema, getSlideFields, validatePostSchema };
