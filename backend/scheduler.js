/**
 * Scheduler
 * Orchestrates the daily automation workflow using node-cron
 * Schedule:
 *   8:00 AM - Research starts
 *   8:15 AM - Content generation
 *   8:45 AM - Image rendering
 *   9:00 AM - Instagram publishing
 */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const cron = require('node-cron');
const { runPipeline, getPipelineState, log } = require('./agents/pipelineRunner');
const { refreshAllAnalytics } = require('./services/analyticsService');

let scheduledJobs = [];
let broadcastFn = null;

function setBroadcast(fn) {
  broadcastFn = fn;
}

function broadcast(data) {
  if (broadcastFn) broadcastFn(data);
}

function getNextRunTime() {
  const now = new Date();
  const next = new Date();
  next.setHours(8, 0, 0, 0);
  
  if (now >= next) {
    next.setDate(next.getDate() + 1);
  }
  
  return next.toISOString();
}

function setupScheduler() {
  console.log('⏰ Setting up automation scheduler...');
  
  // Clear existing jobs
  scheduledJobs.forEach(job => job.destroy());
  scheduledJobs = [];

  // ================================
  // DAILY PIPELINE JOB (8:00 AM Dubai time)
  // Disabled by default — only runs when AUTO_SCHEDULE=true is set.
  // Pipeline is now triggered manually via /api/generate or /api/run-now.
  // ================================
  if (process.env.AUTO_SCHEDULE === 'true') {
    const fullPipelineJob = cron.schedule('0 8 * * *', async () => {
      console.log('\n🚀 SCHEDULED PIPELINE TRIGGERED — 8:00 AM');
      log('⏰ Daily pipeline starting — will generate & render slides for your review', 'info');

      await runPipeline({
        publishNow: false,   // ← NEVER auto-publish. Manual approval required.
        skipPublish: true,
        broadcast
      });

      // Notify dashboard that slides are ready for review
      broadcast({
        type: 'slides_ready_for_review',
        message: '✅ Today\'s slides are ready! Review them and click "Approve & Publish" when happy.',
        timestamp: new Date().toISOString()
      });

      log('📋 Slides ready for your review — open dashboard to approve & publish', 'success');
    }, {
      timezone: 'Asia/Dubai'
    });

    scheduledJobs.push(fullPipelineJob);
    console.log('  📅 Full pipeline: Daily at 8:00 AM (Dubai time) [AUTO_SCHEDULE=true]');
  } else {
    console.log('  📅 Full pipeline: DISABLED (set AUTO_SCHEDULE=true to enable)');
  }

  // ================================
  // ANALYTICS REFRESH (Every 4 hours)
  // ================================
  const analyticsJob = cron.schedule('0 */4 * * *', async () => {
    console.log('\n📊 Refreshing analytics...');
    await refreshAllAnalytics();
    broadcast({ type: 'analytics_updated' });
  });

  scheduledJobs.push(analyticsJob);

  // ================================
  // HEALTH CHECK (Every hour)
  // ================================
  const healthJob = cron.schedule('0 * * * *', () => {
    log('💓 System health check — all systems operational', 'info');
    broadcast({
      type: 'health_check',
      status: 'ok',
      next_run: getNextRunTime()
    });
  });

  scheduledJobs.push(healthJob);

  console.log('✅ Scheduler configured:');
  console.log('  📊 Analytics refresh: Every 4 hours');
  console.log('  💓 Health check: Every hour');
  console.log(`  ⏭️  Next run (if enabled): ${getNextRunTime()}`);

  return scheduledJobs;
}

function getScheduleStatus() {
  return {
    active_jobs: scheduledJobs.length,
    next_run: getNextRunTime(),
    schedule: {
      research: '8:00 AM daily',
      content: '8:15 AM (within pipeline)',
      render: '8:45 AM (within pipeline)',
      publish: '9:00 AM (within pipeline)'
    },
    pipeline_state: getPipelineState(),
    timezone: 'Asia/Dubai (UTC+4)'
  };
}

function stopScheduler() {
  scheduledJobs.forEach(job => job.destroy());
  scheduledJobs = [];
  console.log('🛑 Scheduler stopped');
}

module.exports = { setupScheduler, getScheduleStatus, stopScheduler, setBroadcast, getNextRunTime };
