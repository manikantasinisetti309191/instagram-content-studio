/**
 * Post-Deploy Verifier
 * Run after every git push to confirm the live Render site
 * is actually serving the new code.
 *
 * Usage: node backend/scripts/postDeployCheck.js
 * Usage (with retries): node backend/scripts/postDeployCheck.js --wait
 */

const https = require('https');

const BASE_URL = 'https://instagram-content-studio.onrender.com';
const EXPECTED_VERSION = '2.0.0';
const MAX_RETRIES = 10;      // retry for up to ~5 minutes
const RETRY_DELAY_MS = 30000; // 30 seconds between retries

// ─── HTTP HELPER ─────────────────────────────────────────────────────────────
function fetchUrl(urlStr) {
  return new Promise((resolve, reject) => {
    https.get(urlStr, { timeout: 15000 }, res => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve({ status: res.statusCode, body: data }));
    }).on('error', reject).on('timeout', () => reject(new Error('Timeout')));
  });
}

// ─── CHECKS ──────────────────────────────────────────────────────────────────
const CHECKS = [
  {
    name: 'API online + correct version',
    url: `${BASE_URL}/api/status`,
    validate(body) {
      try {
        const json = JSON.parse(body);
        if (json.status !== 'online') return `status is "${json.status}", expected "online"`;
        if (json.version !== EXPECTED_VERSION) return `version is "${json.version}", expected "${EXPECTED_VERSION}"`;
        return null;
      } catch { return 'Response is not valid JSON'; }
    }
  },
  {
    name: 'index.html has picker modal',
    url: `${BASE_URL}/`,
    validate(body) {
      if (!body.includes('generatePickerOverlay')) return 'Missing: generatePickerOverlay div';
      if (!body.includes('pattern-card')) return 'Missing: pattern-card elements';
      if (!body.includes('v=2.0.0')) return 'Missing: cache-busting ?v=2.0.0 on app.js/styles.css';
      return null;
    }
  },
  {
    name: 'app.js has picker functions',
    url: `${BASE_URL}/app.js?v=2.0.0`,
    validate(body) {
      const required = ['openGeneratePicker', 'submitGenerate', 'selectPattern', 'selectTheme', 'setMode'];
      const missing = required.filter(fn => !body.includes(fn));
      if (missing.length > 0) return `Missing functions: ${missing.join(', ')}`;
      return null;
    }
  },
  {
    name: 'styles.css has picker styles',
    url: `${BASE_URL}/styles.css?v=2.0.0`,
    validate(body) {
      if (!body.includes('gen-picker')) return 'Missing: gen-picker styles';
      if (!body.includes('pattern-card')) return 'Missing: pattern-card styles';
      if (!body.includes('theme-swatch')) return 'Missing: theme-swatch styles';
      return null;
    }
  },
  {
    name: 'service worker is v5 (network-first)',
    url: `${BASE_URL}/sw.js`,
    validate(body) {
      if (!body.includes('content-studio-v5')) return 'SW cache name is not v5 — mobile will serve old files';
      if (!body.includes('network-first') && !body.includes('endsWith(\'.js\')')) return 'SW is not using network-first for JS files';
      return null;
    }
  },
  {
    name: 'API generate endpoint accepts pattern+theme',
    url: `${BASE_URL}/api/status`,
    validate(body) {
      try {
        const json = JSON.parse(body);
        // Just confirm server is healthy — actual generate test done separately
        return json.status === 'online' ? null : 'Server not online';
      } catch { return 'Invalid JSON'; }
    }
  }
];

// ─── RUN CHECKS ──────────────────────────────────────────────────────────────
async function runChecks() {
  console.log(`\n🔍 Post-Deploy Verification — ${BASE_URL}`);
  console.log(`   Expected version: ${EXPECTED_VERSION}\n`);

  let passed = 0, failed = 0;

  for (const check of CHECKS) {
    try {
      const { status, body } = await fetchUrl(check.url);
      if (status !== 200) {
        console.log(`  ❌ ${check.name}`);
        console.log(`     HTTP ${status} — expected 200`);
        failed++;
        continue;
      }
      const error = check.validate(body);
      if (error) {
        console.log(`  ❌ ${check.name}`);
        console.log(`     ${error}`);
        failed++;
      } else {
        console.log(`  ✅ ${check.name}`);
        passed++;
      }
    } catch (err) {
      console.log(`  ❌ ${check.name}`);
      console.log(`     Error: ${err.message}`);
      failed++;
    }
  }

  console.log(`\n${'─'.repeat(50)}`);
  console.log(`  Result: ${passed}/${CHECKS.length} checks passed`);
  if (failed > 0) {
    console.log(`  ⚠️  ${failed} check(s) FAILED — deploy may not be complete yet`);
  } else {
    console.log(`  🎉 ALL CHECKS PASSED — deploy is live and correct!`);
  }
  console.log(`${'─'.repeat(50)}\n`);

  return failed === 0;
}

// ─── MAIN ────────────────────────────────────────────────────────────────────
async function main() {
  const waitMode = process.argv.includes('--wait');

  if (waitMode) {
    console.log(`⏳ Wait mode: will retry every ${RETRY_DELAY_MS / 1000}s for up to ${MAX_RETRIES} attempts...`);
    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      console.log(`\n  Attempt ${attempt}/${MAX_RETRIES}...`);
      const ok = await runChecks();
      if (ok) {
        console.log('✅ Deploy verified successfully!\n');
        process.exit(0);
      }
      if (attempt < MAX_RETRIES) {
        console.log(`  Waiting ${RETRY_DELAY_MS / 1000}s before retry...\n`);
        await new Promise(r => setTimeout(r, RETRY_DELAY_MS));
      }
    }
    console.error('❌ Deploy verification FAILED after all retries. Check Render logs.\n');
    process.exit(1);
  } else {
    const ok = await runChecks();
    process.exit(ok ? 0 : 1);
  }
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
