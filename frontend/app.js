/**
 * Content Studio — Mobile PWA App Logic v2.2
 * Adds: Caption A/B tabs, better error states, topic memory widget,
 *       server wakeup toast with countdown, empty post state
 */
'use strict';

// ==================== STATE ====================
const S = {
  ws: null, wsRetries: 0, wsTimer: null,
  currentPost: null, allPosts: [],
  currentSlide: 0, totalSlides: 0,
  touchStartX: 0, touchStartY: 0,
  isGenerating: false, isPublishing: false,
  pollTimer: null,
  historyPosts: [],   // indexed store to avoid JSON-in-onclick bugs
  serverOnline: false,
  activeCaptionTab: 'A',   // tracks which caption tab is selected
  captionA: '',            // current caption A text
  captionB: '',            // generated caption B text
};

// ==================== INIT ====================
document.addEventListener('DOMContentLoaded', () => {
  registerServiceWorker();
  showSplash();
  connectWebSocket();
  bootLoad();
  setInterval(checkStatus, 30000);
});

function registerServiceWorker() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  }
}

async function bootLoad() {
  // Show "waking up" state if server cold-starts (Render free tier)
  let retries = 0;
  while (retries < 8) {
    try {
      await checkStatus();
      if (S.serverOnline) break;
    } catch (_) {}
    retries++;
    setEl('splashStatus', retries < 3 ? 'Connecting...' : '☕ Waking up server (~20 sec)...');
    await sleep(retries < 3 ? 1500 : 3000);
  }
  hideSplash();
  await loadLatestPost();
  loadHistory();
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// ==================== SPLASH ====================
function showSplash() {
  const el = document.getElementById('splashScreen');
  if (el) el.classList.remove('hidden');
}
function hideSplash() {
  const el = document.getElementById('splashScreen');
  if (el) {
    el.style.opacity = '0';
    setTimeout(() => el.classList.add('hidden'), 400);
  }
}

// ==================== SCREEN NAVIGATION ====================
const SCREENS = ['home', 'generating', 'review', 'history', 'settings'];

function showScreen(name) {
  SCREENS.forEach(s => {
    const el = document.getElementById(`screen-${s}`);
    if (el) el.classList.toggle('active', s === name);
  });
  ['home', 'review', 'history', 'settings'].forEach(s => {
    const btn = document.getElementById(`nav-${s}`);
    if (btn) btn.classList.toggle('active', s === name);
  });
  if (name === 'generating') {
    document.getElementById('nav-home')?.classList.add('active');
  }
}

function goToReview() {
  if (S.currentPost) {
    showScreen('review');
  } else {
    showToast('No post yet — tap Generate first', 'error');
  }
}

// ==================== WEBSOCKET ====================
function connectWebSocket() {
  try {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    S.ws = new WebSocket(`${protocol}//${window.location.host}`);
    S.ws.onopen = () => { S.wsRetries = 0; };
    S.ws.onmessage = e => { try { handleWS(JSON.parse(e.data)); } catch (_) {} };
    S.ws.onclose = () => scheduleWsReconnect();
    S.ws.onerror = () => S.ws.close();
  } catch (_) { scheduleWsReconnect(); }
}

function scheduleWsReconnect() {
  if (S.wsTimer) return;
  const delay = Math.min(1000 * Math.pow(2, S.wsRetries++), 30000);
  S.wsTimer = setTimeout(() => { S.wsTimer = null; connectWebSocket(); }, delay);
}

function handleWS(data) {
  switch (data.type) {
    case 'step_start':
    case 'step_complete': {
      updateGenStep(data.step, data.type === 'step_complete' ? 'done' : 'active');
      addGenLog(data.message || `${data.step} ${data.type === 'step_complete' ? 'done' : 'started'}`, 'info');
      break;
    }
    // API warning — Gemini busy or using curated fallback
    case 'api_warning': {
      addGenLog(data.message || '⚠️ Using curated news library', 'warning');
      showGenBanner(data.message || '⚠️ Live AI news temporarily unavailable — using curated library', 'warning');
      break;
    }
    // General status update (dedup notices, fallback, etc.)
    case 'status_update': {
      const upLvl = data.level || 'info';
      addGenLog(data.message || '', upLvl);
      if (upLvl === 'warning') showGenBanner(data.message, 'warning');
      break;
    }
    case 'pipeline_complete':
    case 'slides_ready_for_review': {
      finishGenerating();
      break;
    }
    case 'regenerate_complete':
    case 'edit_complete': {
      S.isGenerating = false;
      stopPollFallback();
      setStatusPill('done', '✓ Ready');
      addGenLog('✅ Done! New content ready.', 'success');
      setTimeout(async () => {
        await loadLatestPost();
        showScreen('review');
        showToast('✅ Content updated!', 'success');
      }, 1200);
      break;
    }
    case 'publish_complete': {
      S.isPublishing = false;
      closePublishConfirm();
      const igId = data.instagram_post_id || '';
      showPublishSuccess(igId, data.headline || S.currentPost?.headline || '');
      loadLatestPost();
      break;
    }
    case 'publish_error':
    case 'edit_error':
    case 'regenerate_error': {
      S.isGenerating = false;
      S.isPublishing = false;
      stopPollFallback();
      setStatusPill('error', 'Error');
      closePublishConfirm();
      showToast('❌ ' + (data.message || 'Something went wrong'), 'error');
      document.getElementById('generateBtn')?.removeAttribute('disabled');
      break;
    }
    case 'pipeline_error': {
      S.isGenerating = false;
      stopPollFallback();
      setStatusPill('error', 'Failed');
      const peMsg = data.error || 'Unknown error';
      addGenLog('❌ Generation failed: ' + peMsg, 'error');
      addGenLog('💡 Usually temporary — tap Generate to try again', 'info');
      setEl('genTitle', 'Generation Failed');
      setEl('genSub', 'Tap Generate to try again');
      setEl('genMainIcon', '❌');
      showGenBanner('❌ Content generation failed. Please try again.', 'error');
      document.getElementById('generateBtn')?.removeAttribute('disabled');
      showToast('❌ Generation failed — please try again', 'error');
      break;
    }
    case 'quality_failed': {
      S.isGenerating = false;
      stopPollFallback();
      setStatusPill('error', 'Quality Failed');
      addGenLog('❌ Quality check failed — AI content had gaps', 'error');
      addGenLog('💡 Quality failures are usually one-off — tap Generate to retry', 'info');
      setEl('genTitle', 'Quality Check Failed');
      setEl('genSub', 'AI had gaps — tap Generate to retry');
      setEl('genMainIcon', '⚠️');
      showGenBanner('⚠️ Content quality check failed — please regenerate', 'warning');
      document.getElementById('generateBtn')?.removeAttribute('disabled');
      showToast('⚠️ Quality check failed — try generating again', 'error');
      break;
    }
    case 'health_check': {
      // Keep-alive ping — if we were stuck as generating but pipeline is idle, reset
      if (S.isGenerating && data.status === 'ok') {
        // Will be resolved by poll fallback
      }
      break;
    }
  }
}

// ==================== WS POLLING FALLBACK ====================
// If WS drops mid-generation (cell signal, screen lock), poll every 5s
function startPollFallback() {
  stopPollFallback();
  S.pollTimer = setInterval(async () => {
    if (!S.isGenerating && !S.isPublishing) { stopPollFallback(); return; }
    try {
      const data = await api('/api/status');
      if (data.pipeline?.status === 'idle' && S.isGenerating) {
        finishGenerating();
      }
    } catch (_) {}
  }, 5000);
}

function stopPollFallback() {
  if (S.pollTimer) { clearInterval(S.pollTimer); S.pollTimer = null; }
}

async function finishGenerating() {
  S.isGenerating = false;
  stopPollFallback();
  setStatusPill('done', '✓ Ready');
  addGenLog('🎉 Slides ready! Loading...', 'success');
  document.getElementById('generateBtn')?.removeAttribute('disabled');
  await loadLatestPost();
  if (S.currentPost) {
    showScreen('review');
    showToast('🎉 Slides ready! Review & publish when happy 👇', 'success');
  }
}

// ==================== STATUS ====================
async function checkStatus() {
  try {
    const data = await api('/api/status');
    S.serverOnline = true;
    const mode = data.instagram_configured ? 'Live Mode 🟢' : 'Preview Mode 🟡';
    setEl('settings-mode', mode);
    const srv = document.getElementById('settings-server');
    if (srv) { srv.textContent = 'Online ✅'; srv.className = 'settings-val green'; }
    if (data.pipeline?.status === 'running' && !S.isGenerating) {
      S.isGenerating = true;
      setStatusPill('running', 'Running...');
    }
  } catch (_) {
    S.serverOnline = false;
    const srv = document.getElementById('settings-server');
    if (srv) { srv.textContent = 'Offline ⚠️'; srv.className = 'settings-val red'; }
  }
}

// ==================== LOAD LATEST POST ====================
async function loadLatestPost() {
  try {
    const data = await api('/api/latest');
    const posts = data?.content?.posts;
    if (!posts?.length) {
      // Show compelling empty state on the home screen card
      showEmptyPostState();
      return;
    }

    const post = posts[0];
    S.currentPost = post;
    S.allPosts = posts;

    renderLastPostCard(post, data);

    // Stats from /api/posts (now flat list of post objects)
    const allPostFiles = await api('/api/posts').catch(() => ({ posts: [] }));
    const allP = allPostFiles.posts || [];
    const pub = allP.filter(p => p.instagram_post_id && !p.instagram_post_id.startsWith('PREVIEW')).length;
    setEl('stat-generated', allP.length);
    setEl('stat-published', pub);
    setEl('stat-today', post ? '1' : '—');

    renderHistory(allP);
    populateReviewScreen(post);
    return post;
  } catch (err) {
    // Network error — server might be cold-starting
    showServerWakeupToast();
  }
}

/**
 * Shows a premium "Server is waking up" toast with a 30-second countdown
 * progress bar and auto-retries loadLatestPost after 30 seconds.
 */
let _wakeupToastActive = false;
function showServerWakeupToast() {
  if (_wakeupToastActive) return;
  _wakeupToastActive = true;

  const container = document.getElementById('toastContainer');
  if (!container) return;

  const el = document.createElement('div');
  el.className = 'toast server-wakeup-toast';
  el.innerHTML = `
    <div class="swt-icon">🔌</div>
    <div class="swt-body">
      <div class="swt-title">Server is waking up...</div>
      <div class="swt-sub">(Render free tier spins down after 15 min)</div>
      <div class="swt-sub">This takes about 30 seconds. Refreshing automatically...</div>
      <div class="swt-progress-wrap"><div class="swt-progress-bar" id="swtProgressBar"></div></div>
    </div>`;
  container.appendChild(el);

  // Animate progress bar over 30 seconds
  let elapsed = 0;
  const TOTAL = 30;
  const bar = el.querySelector('#swtProgressBar');
  if (bar) bar.style.width = '0%';
  const tick = setInterval(() => {
    elapsed++;
    if (bar) bar.style.width = `${Math.min(100, (elapsed / TOTAL) * 100)}%`;
    if (elapsed >= TOTAL) {
      clearInterval(tick);
      el.remove();
      _wakeupToastActive = false;
      // Auto-retry
      loadLatestPost();
    }
  }, 1000);
}

/**
 * Shows the compelling empty state in the lastPostCard.
 */
function showEmptyPostState() {
  const card = document.getElementById('lastPostCard');
  if (!card) return;
  card.className = 'last-post-card';
  card.onclick = null;
  card.innerHTML = `
    <div class="last-post-empty">
      <div class="empty-icon">✨</div>
      <div class="empty-title">No posts generated yet</div>
      <div class="empty-sub">Tap Generate Post to create your first AI carousel</div>
      <button class="empty-generate-btn" onclick="startGenerate()">Generate Post →</button>
    </div>`;
}

function renderLastPostCard(post, data) {
  const card = document.getElementById('lastPostCard');
  if (!card) return;
  const isPublished = post.instagram_post_id && !post.instagram_post_id.startsWith('PREVIEW');
  const runDate = data.content?.generated_at || '';
  const timeStr = runDate
    ? new Date(runDate).toLocaleString('en-US', { month:'short', day:'numeric', hour:'2-digit', minute:'2-digit' })
    : '';
  card.className = 'last-post-card has-content';
  card.onclick = () => { populateReviewScreen(post); showScreen('review'); };
  card.innerHTML = `
    <div class="last-post-content">
      <div class="last-post-meta">
        <span class="last-post-emoji">${post.emoji || '🤖'}</span>
        <div class="last-post-info">
          <div class="last-post-headline">${esc(post.headline || 'AI Update')}</div>
          <div class="last-post-category">${esc(post.category || 'AI News')}</div>
        </div>
      </div>
      <div class="last-post-status-row">
        <span class="badge ${isPublished ? 'published' : 'preview'}">${isPublished ? '✅ Published' : '🟡 Preview'}</span>
        ${timeStr ? `<span class="last-post-time">${timeStr}</span>` : ''}
      </div>
      <div class="last-post-cta">Tap to review &amp; publish →</div>
    </div>`;
}

async function populateReviewScreen(post) {
  if (!post) return;
  S.currentPost = post;
  S.currentSlide = 0;

  setEl('reviewEmoji', post.emoji || '🤖');
  setEl('reviewHeadline', post.headline || 'AI Update');
  setEl('reviewCategory', post.category || 'AI News');

  const isPublished = post.instagram_post_id && !post.instagram_post_id.startsWith('PREVIEW');
  const badge = document.getElementById('reviewPostBadge');
  if (badge) { badge.textContent = isPublished ? 'Published' : 'Preview'; badge.className = `review-badge ${isPublished ? 'published' : 'preview'}`; }

  const pubBtn = document.getElementById('publishBtn');
  if (pubBtn) {
    if (isPublished) {
      pubBtn.innerHTML = '<span>✅</span><span>Published!</span>';
      pubBtn.disabled = true;
      pubBtn.className = 'action-btn secondary';
    } else {
      pubBtn.innerHTML = '<span>🚀</span><span>Publish</span>';
      pubBtn.disabled = false;
      pubBtn.className = 'action-btn primary';
    }
  }

  await loadCarouselImages(post);

  // Caption A/B setup
  const caption = post.caption;
  if (caption) {
    const fullCaption =
      caption.full_caption ||
      [caption.hook, caption.body, caption.engagement_prompt, caption.call_to_action].filter(Boolean).join('\n\n');

    // Caption A = original
    S.captionA = post.caption_b ? fullCaption : fullCaption;
    const captionElA = document.getElementById('captionBox');
    if (captionElA) captionElA.textContent = S.captionA;

    // Caption B = server-provided or client-generated variant
    if (post.caption_b) {
      S.captionB = post.caption_b;
    } else {
      S.captionB = generateCaptionVariant(fullCaption, caption);
    }
    const captionElB = document.getElementById('captionBoxB');
    if (captionElB) captionElB.textContent = S.captionB;
  }

  // Reset to Caption A tab
  switchCaptionTab('A');

  // Hashtags
  const hashtagEl = document.getElementById('hashtagBox');
  if (hashtagEl && post.hashtags?.length) {
    hashtagEl.innerHTML = post.hashtags.map(t =>
      `<span class="h-tag" onclick="copyText('${esc(t)}')">${esc(t)}</span>`
    ).join('');
  }

  // Re-attach touch events for the newly rendered carousel
  setupCarouselTouch();
}

/**
 * Generates a Caption B variant client-side by:
 * - Swapping the first two lines
 * - Adjusting emoji placement
 */
function generateCaptionVariant(original, captionObj) {
  // Strategy 1: if structured caption parts exist, rearrange them
  if (captionObj && captionObj.hook && captionObj.body) {
    const hook = captionObj.hook || '';
    const body = captionObj.body || '';
    const engagement = captionObj.engagement_prompt || '';
    const cta = captionObj.call_to_action || '';

    // Swap hook with a version that leads with the engagement question
    const newHook = engagement
      ? engagement + '\n\n' + hook
      : hook.split(' ').reverse().slice(0, 6).join(' ') + '...';
    const parts = [newHook, body, cta].filter(Boolean);
    return parts.join('\n\n');
  }

  // Strategy 2: swap first two lines of the raw caption
  const lines = original.split('\n');
  if (lines.length >= 2) {
    // Swap line 0 and line 1
    const swapped = [lines[1], lines[0], ...lines.slice(2)].join('\n');
    // Move trailing emojis to front
    const emojiRegex = /([\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]+)$/u;
    const match = swapped.match(emojiRegex);
    if (match) {
      return match[1] + ' ' + swapped.replace(emojiRegex, '').trim();
    }
    return swapped;
  }
  return original + '\n\n💡 Save this for later!';
}

// Caption tab switching
window.switchCaptionTab = function(tab) {
  S.activeCaptionTab = tab;
  const tabA = document.getElementById('captionTabA');
  const tabB = document.getElementById('captionTabB');
  const panelA = document.getElementById('captionPanelA');
  const panelB = document.getElementById('captionPanelB');
  if (tabA) tabA.classList.toggle('active', tab === 'A');
  if (tabB) tabB.classList.toggle('active', tab === 'B');
  if (panelA) panelA.classList.toggle('hidden', tab !== 'A');
  if (panelB) panelB.classList.toggle('hidden', tab !== 'B');
};

// Use caption — copies the active one to clipboard and marks it chosen
window.useCaption = function(variant) {
  const text = variant === 'B' ? S.captionB : S.captionA;
  if (!text) return;
  navigator.clipboard.writeText(text).then(() => {
    showToast(`✅ Caption ${variant} copied & ready to use!`, 'success');
  });
};

async function loadCarouselImages(post) {
  const track = document.getElementById('carouselTrack');
  const dots = document.getElementById('carouselDots');
  if (!track) return;

  try {
    const data = await api(`/api/posts/${post.post_id}/images`);
    if (data.images?.length > 0) {
      S.totalSlides = data.images.length;
      track.innerHTML = data.images.map((img, i) =>
        `<div class="carousel-slide ${i === 0 ? 'active' : ''}">
          <img src="${img}?t=${Date.now()}" alt="Slide ${i+1}" loading="lazy" onclick="openFullScreen('${img}')" />
        </div>`
      ).join('');
      if (dots) dots.innerHTML = data.images.map((_, i) =>
        `<div class="c-dot ${i === 0 ? 'active' : ''}" onclick="goToSlide(${i})"></div>`
      ).join('');
      updateSlideCounter();
      return;
    }
  } catch (_) {}

  renderTextSlides(post);
}

function renderTextSlides(post) {
  const track = document.getElementById('carouselTrack');
  const dots = document.getElementById('carouselDots');
  if (!post?.slides) {
    if (track) track.innerHTML = `<div class="carousel-slide active" style="background:#111;display:flex;align-items:center;justify-content:center;"><div style="text-align:center;color:#555;padding:30px"><div style="font-size:36px;margin-bottom:12px">🎨</div><div>Generating slides...</div></div></div>`;
    if (dots) dots.innerHTML = '';
    S.totalSlides = 1;
    updateSlideCounter();
    return;
  }

  const bgColors = ['#0a1628','#14082a','#1a0812','#081a10','#0a1828','#14101a','#0f1a20','#1a0a14','#0a1820','#14082a'];
  const accents = ['#00d4ff','#7c3aed','#ff006e','#00ff88','#00d4ff','#7c3aed','#ff006e','#00ff88','#00d4ff','#7c3aed'];
  const labels = ['BREAKING','EXPLAINER','WHY IT MATTERS','HOW TO USE','BOTTOM LINE','DEEP DIVE','IMPACT','STRATEGY','KEY INSIGHT','TAKE ACTION'];
  const slides = Object.entries(post.slides);
  S.totalSlides = slides.length;

  track.innerHTML = slides.map(([, slide], i) => `
    <div class="carousel-slide text-slide ${i === 0 ? 'active' : ''}"
         style="background:linear-gradient(135deg,${bgColors[i % bgColors.length]},#050510);">
      <div style="position:absolute;top:0;left:0;right:0;height:2px;background:linear-gradient(90deg,${accents[i % accents.length]},transparent);"></div>
      <div class="ts-label" style="color:${accents[i % accents.length]}">${labels[i] || `SLIDE ${i+1}`}</div>
      ${formatTextSlide(i, slide, post)}
      <div class="ts-slide-num">${i+1} / ${slides.length}</div>
    </div>`
  ).join('');

  if (dots) dots.innerHTML = slides.map((_, i) =>
    `<div class="c-dot ${i === 0 ? 'active' : ''}" onclick="goToSlide(${i})"></div>`
  ).join('');

  updateSlideCounter();
}

function formatTextSlide(num, slide, post) {
  switch (num) {
    case 0: return `<div style="font-size:28px;margin-bottom:12px">${post.emoji||'🤖'}</div><div class="ts-title">${esc(slide.title||'')}</div><div class="ts-sub">${esc(slide.subtitle||'')}</div>`;
    case 1: return `<div class="ts-title" style="font-size:16px">${esc(slide.title||'')}</div>${[slide.bullet_1,slide.bullet_2,slide.bullet_3].filter(Boolean).map(b=>`<div class="ts-bullet" style="border-left:2px solid #7c3aed">${esc(b)}</div>`).join('')}`;
    case 2: return `<div class="ts-title" style="font-size:16px">${esc(slide.title||'')}</div><div class="ts-accent" style="color:#ff006e">${esc(slide.impact_statement||'')}</div><div class="ts-sub">${esc(slide.detail||'')}</div>`;
    case 3: return `<div class="ts-title" style="font-size:16px">${esc(slide.title||'')}</div>${[slide.use_case_1,slide.use_case_2,slide.use_case_3].filter(Boolean).map((u,i2)=>`<div class="ts-bullet"><span style="color:#00ff88;font-weight:700">${i2+1}.</span> ${esc(u)}</div>`).join('')}`;
    case 4: return `<div class="ts-title">${esc(slide.title||'')}</div><div class="ts-sub" style="margin-bottom:16px">${esc(slide.summary||'')}</div><div class="ts-cta">${esc(slide.cta_question||'Follow for daily AI insights')}</div>`;
    default: return `<div class="ts-title" style="font-size:15px">${esc(slide.title||`Slide ${num+1}`)}</div><div class="ts-sub">${esc(slide.content||slide.subtitle||slide.detail||'')}</div>`;
  }
}

// ==================== CAROUSEL TOUCH ====================
function setupCarouselTouch() {
  const wrapper = document.querySelector('.carousel-wrapper');
  if (!wrapper) return;
  // Remove old listeners by cloning
  const newWrapper = wrapper.cloneNode(true);
  wrapper.parentNode.replaceChild(newWrapper, wrapper);

  newWrapper.addEventListener('touchstart', e => {
    S.touchStartX = e.touches[0].clientX;
    S.touchStartY = e.touches[0].clientY;
  }, { passive: true });

  newWrapper.addEventListener('touchend', e => {
    const dx = e.changedTouches[0].clientX - S.touchStartX;
    const dy = e.changedTouches[0].clientY - S.touchStartY;
    if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 40) {
      changeSlide(dx < 0 ? 1 : -1);
    }
  }, { passive: true });
}

function changeSlide(dir) {
  const slides = document.querySelectorAll('.carousel-slide');
  const cdots = document.querySelectorAll('.c-dot');
  if (!slides.length) return;
  slides[S.currentSlide].classList.remove('active');
  cdots[S.currentSlide]?.classList.remove('active');
  S.currentSlide = (S.currentSlide + dir + slides.length) % slides.length;
  slides[S.currentSlide].classList.add('active');
  cdots[S.currentSlide]?.classList.add('active');
  updateSlideCounter();
}

function goToSlide(index) { changeSlide(index - S.currentSlide); }

function updateSlideCounter() {
  const slides = document.querySelectorAll('.carousel-slide');
  setEl('slideCounter', `${S.currentSlide + 1} / ${slides.length || S.totalSlides}`);
}

// ==================== FULLSCREEN SLIDE ====================
window.openFullScreen = function(imgSrc) {
  let overlay = document.getElementById('fullscreenOverlay');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'fullscreenOverlay';
    overlay.style.cssText = 'position:fixed;inset:0;z-index:500;background:rgba(0,0,0,0.95);display:flex;align-items:center;justify-content:center;cursor:zoom-out;';
    overlay.onclick = () => overlay.remove();
    document.body.appendChild(overlay);
  }
  overlay.innerHTML = `<img src="${imgSrc}" style="max-width:100%;max-height:100%;object-fit:contain;" />`;
};

// ==================== GENERATE (opens picker) ====================
window.startGenerate = function() {
  if (S.isGenerating) { showToast('Already generating...', 'error'); return; }
  openGeneratePicker();
};

// Executes the actual pipeline after picker submit
async function _runGenerate(pattern, theme, mode, topic) {
  if (S.isGenerating) return;
  const btn = document.getElementById('generateBtn');
  if (btn) btn.disabled = true;
  S.isGenerating = true;
  showScreen('generating');
  resetGenUI();
  setStatusPill('running', 'Generating...');
  startPollFallback();

  const endpoint = mode === 'evergreen' ? '/api/generate/evergreen' : '/api/generate';
  const body = { pattern: pattern || 'auto', theme: theme || 'cyber_dark' };
  if (mode === 'evergreen' && topic) body.topic = topic;

  try {
    await api(endpoint, 'POST', body);
    addGenLog(`✅ Pipeline started — Pattern: ${pattern || 'AI Pick'} | Theme: ${theme} | Mode: ${mode}`, 'success');
  } catch (err) {
    S.isGenerating = false;
    stopPollFallback();
    showScreen('home');
    setStatusPill('error', 'Error');
    // Generation failed error state
    showGenerationFailedError(err.message || 'Check server');
    document.getElementById('generateBtn')?.removeAttribute('disabled');
  }
}

function resetGenUI() {
  setEl('genTitle', 'Researching AI News');
  setEl('genSub', 'Scanning 13+ news sources...');
  setEl('genMainIcon', '🔍');
  ['research','content','quality','render'].forEach(s => {
    const el = document.getElementById(`pstep-${s}`);
    if (el) { el.className = 'p-step'; el.querySelector('.p-step-fill').style.width = '0%'; }
  });
  const logEl = document.getElementById('genLogStream');
  if (logEl) logEl.innerHTML = '<div class="log-line info">⏳ Starting pipeline...</div>';
  const first = document.getElementById('pstep-research');
  if (first) first.className = 'p-step active';
}

function updateGenStep(stepName, state) {
  const map = { research: 0, filter: 0, content: 1, quality: 2, render: 3 };
  const idx = map[stepName];
  if (idx === undefined) return;
  const steps = ['research','content','quality','render'];
  steps.slice(0, idx).forEach(s => {
    const el = document.getElementById(`pstep-${s}`);
    if (el) { el.className = 'p-step done'; el.querySelector('.p-step-fill').style.width = '100%'; }
  });
  const cur = document.getElementById(`pstep-${steps[idx]}`);
  if (cur) {
    cur.className = `p-step ${state}`;
    cur.querySelector('.p-step-fill').style.width = state === 'done' ? '100%' : '';
  }
  const titles = { research:'Researching AI News', filter:'Picking Best Story', content:'Writing Content', quality:'Quality Check', render:'Rendering Slides' };
  const icons  = { research:'🔍', filter:'🎯', content:'✍️', quality:'✅', render:'🎨' };
  const subs   = { research:'Scanning 13+ news sources...', filter:'Selecting the most viral story...', content:'Writing 10 slides + caption...', quality:'Checking all slide fields...', render:'Creating 1080×1080 images...' };
  if (titles[stepName]) {
    setEl('genTitle', titles[stepName]);
    setEl('genSub', subs[stepName]);
    setEl('genMainIcon', icons[stepName]);
  }
}

function addGenLog(msg, type = 'info') {
  const el = document.getElementById('genLogStream');
  if (!el) return;
  const div = document.createElement('div');
  div.className = `log-line ${type}`;
  div.textContent = msg;
  el.insertBefore(div, el.firstChild);
  if (el.children.length > 40) el.removeChild(el.lastChild);
}

// Cancel goes home but KEEPS the generating state visible in status pill
window.cancelGenerate = function() {
  showScreen('home');
  if (S.isGenerating) {
    setStatusPill('running', 'Running in BG...');
    showToast('Pipeline still running in background', 'info');
  }
};

// ==================== REGENERATE ====================
window.showRegenerateConfirm = function() {
  document.getElementById('regenOverlay').classList.remove('hidden');
};
window.closeRegenConfirm = function() {
  document.getElementById('regenOverlay').classList.add('hidden');
};

window.triggerRegenerate = async function() {
  closeRegenConfirm();
  if (S.isGenerating) return;
  S.isGenerating = true;
  setStatusPill('running', 'Regenerating...');
  showScreen('generating');
  resetGenUI();
  setEl('genTitle', 'Getting New Topic');
  setEl('genSub', 'Picking a completely different story...');
  setEl('genMainIcon', '🔄');
  startPollFallback();
  try {
    await api('/api/regenerate', 'POST');
    addGenLog('🔄 Fetching a fresh topic...', 'info');
  } catch (err) {
    S.isGenerating = false;
    stopPollFallback();
    showScreen('review');
    setStatusPill('error', 'Error');
    showToast('❌ Regenerate failed: ' + err.message, 'error');
  }
};

// ==================== EDIT ====================
window.showEditPanel = function() {
  document.getElementById('editOverlay').classList.remove('hidden');
  setTimeout(() => document.getElementById('editInput')?.focus(), 400);
};
window.closeEditPanel = function() {
  document.getElementById('editOverlay').classList.add('hidden');
};
window.setEditText = function(text) {
  const el = document.getElementById('editInput');
  if (el) { el.value = text; el.focus(); }
};

window.submitEdit = async function() {
  const input = document.getElementById('editInput');
  const instruction = input?.value?.trim();
  if (!instruction) { showToast('Please describe what to change', 'error'); return; }

  const submitBtn = document.getElementById('editSubmitBtn');
  if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = '⏳ Applying...'; }

  closeEditPanel();
  S.isGenerating = true;
  setStatusPill('running', 'Editing...');
  showScreen('generating');
  resetGenUI();
  setEl('genTitle', 'Rewriting Content');
  setEl('genSub', `"${instruction.substring(0, 50)}${instruction.length > 50 ? '...' : ''}"`);
  setEl('genMainIcon', '✏️');
  addGenLog(`✏️ Instruction: "${instruction}"`, 'info');
  startPollFallback();

  try {
    await api('/api/edit-content', 'POST', { instruction });
    addGenLog('⏳ AI is rewriting content...', 'info');
  } catch (err) {
    S.isGenerating = false;
    stopPollFallback();
    showScreen('review');
    setStatusPill('error', 'Error');
    showToast('❌ Edit failed: ' + err.message, 'error');
  }

  if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = '✨ Apply Changes'; }
  if (input) input.value = '';
};

// ==================== PUBLISH ====================
window.showPublishConfirm = function() {
  if (S.isPublishing) return;
  document.getElementById('publishOverlay').classList.remove('hidden');
};
window.closePublishConfirm = function() {
  document.getElementById('publishOverlay').classList.add('hidden');
  const btn = document.getElementById('confirmPublishBtn');
  if (btn) { btn.disabled = false; btn.textContent = 'Yes, Publish Now'; }
};

window.submitPublish = async function() {
  if (!S.currentPost || S.isPublishing) return;
  const btn = document.getElementById('confirmPublishBtn');
  if (btn) { btn.disabled = true; btn.textContent = '⏳ Publishing...'; }
  S.isPublishing = true;
  setStatusPill('running', 'Publishing...');
  try {
    await api(`/api/posts/${S.currentPost.post_id}/approve`, 'POST');
    // WS will call showPublishSuccess on success
  } catch (err) {
    S.isPublishing = false;
    closePublishConfirm();
    setStatusPill('error', 'Error');
    showToast('❌ Publish failed: ' + err.message, 'error');
  }
};

// ==================== PUBLISH SUCCESS SCREEN ====================
function showPublishSuccess(igPostId, headline) {
  setStatusPill('done', '✓ Published!');
  const overlay = document.getElementById('successOverlay');
  if (!overlay) return;
  setEl('successHeadline', headline || 'Your post is live!');
  setEl('successPostId', igPostId ? `Instagram ID: ${igPostId}` : '');
  // Show link button only if we have a real post ID
  const linkBtn = document.getElementById('successLinkBtn');
  if (linkBtn) {
    if (igPostId && !igPostId.startsWith('PREVIEW')) {
      linkBtn.style.display = '';
      linkBtn.href = `https://www.instagram.com/p/${igPostId}/`;
    } else {
      linkBtn.style.display = 'none';
    }
  }
  overlay.classList.remove('hidden');
  // Update publish btn
  const pubBtn = document.getElementById('publishBtn');
  if (pubBtn) { pubBtn.innerHTML = '<span>✅</span><span>Published!</span>'; pubBtn.disabled = true; pubBtn.className = 'action-btn secondary'; }
  const badge = document.getElementById('reviewPostBadge');
  if (badge) { badge.textContent = 'Published'; badge.className = 'review-badge published'; }
}

window.closeSuccessOverlay = function() {
  document.getElementById('successOverlay')?.classList.add('hidden');
  showScreen('home');
  loadLatestPost();
};

// ==================== COPY ====================
window.copyCaption = function(variant) {
  // Support both old signature (no arg) and new (variant = 'A' | 'B')
  let text;
  if (variant === 'B') {
    text = S.captionB;
  } else {
    // A or no arg — read from the DOM element for backward compat
    const el = document.getElementById('captionBox');
    text = el ? (el.textContent || S.captionA) : S.captionA;
  }
  if (!text) return;
  navigator.clipboard.writeText(text).then(() => showToast('✅ Caption copied!', 'success'));
};
window.copyHashtags = function() {
  const tags = [...document.querySelectorAll('.h-tag')].map(el => el.textContent).join(' ');
  navigator.clipboard.writeText(tags).then(() => showToast('✅ Hashtags copied!', 'success'));
};
window.copyText = function(text) {
  navigator.clipboard.writeText(text).then(() => showToast('Copied!', 'success'));
};

// ==================== HISTORY ====================
async function loadHistory() {
  try {
    const data = await api('/api/posts');
    renderHistory(data.posts || []);
  } catch (_) {}
}

function renderHistory(posts) {
  const list = document.getElementById('historyList');
  if (!list) return;
  S.historyPosts = posts; // store indexed, avoid JSON-in-onclick
  if (!posts?.length) {
    list.innerHTML = `<div class="empty-state-full"><div class="empty-icon">📜</div><div>No posts yet</div></div>`;
    return;
  }
  list.innerHTML = posts.slice(0, 20).map((post, idx) => {
    const isPublished = post.instagram_post_id && !post.instagram_post_id.startsWith('PREVIEW');
    const date = post.published_at || post.generated_at || post.generated_date || '';
    const dateStr = date ? new Date(date).toLocaleDateString('en-US', { month:'short', day:'numeric', year:'numeric' }) : '—';
    return `
      <div class="history-item" onclick="selectHistoryPost(${idx})">
        <span class="history-emoji">${post.emoji || '🤖'}</span>
        <div class="history-info">
          <div class="history-headline">${esc(post.headline || 'AI Update')}</div>
          <div class="history-meta">
            <span class="badge ${isPublished ? 'published' : 'preview'}">${isPublished ? '✅ Published' : '🟡 Draft'}</span>
            <span class="history-date">${dateStr}</span>
          </div>
        </div>
      </div>`;
  }).join('');
}

window.selectHistoryPost = function(idx) {
  const post = S.historyPosts[idx];
  if (!post) return;
  populateReviewScreen(post);
  showScreen('review');
};

// ==================== STATUS PILL ====================
function setStatusPill(state, text) {
  const pill = document.getElementById('statusPill');
  const pillText = document.getElementById('statusPillText');
  if (!pill) return;
  pill.className = `status-pill ${state}`;
  if (pillText) pillText.textContent = text;
}

// ==================== UTILS ====================
async function api(path, method = 'GET', body = null) {
  const opts = { method, headers: { 'Content-Type': 'application/json' } };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(path, opts);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `HTTP ${res.status}`);
  }
  return res.json();
}

function setEl(id, text) {
  const el = document.getElementById(id);
  if (el) el.textContent = String(text);
}

function esc(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g,'&amp;')
    .replace(/</g,'&lt;')
    .replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;');
}

function showToast(msg, type = 'info') {
  const container = document.getElementById('toastContainer');
  if (!container) return;
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.textContent = msg;
  container.appendChild(el);
  setTimeout(() => {
    el.style.animation = 'toastOut 0.3s ease forwards';
    setTimeout(() => el.remove(), 350);
  }, 3000);
}

// Shows a persistent banner inside the generating screen (warnings, API down, duplicates, etc.)
function showGenBanner(msg, type) {
  type = type || 'warning';
  document.getElementById('genBanner') && document.getElementById('genBanner').remove();
  var screen = document.getElementById('screen-generating');
  if (!screen || !msg) return;
  var banner = document.createElement('div');
  banner.id = 'genBanner';
  var bgMap = { warning:'linear-gradient(135deg,#7c3a00,#b85c00)', error:'linear-gradient(135deg,#4a0000,#8b0000)', info:'linear-gradient(135deg,#001a3a,#003366)' };
  var borderMap = { warning:'#ff8c00', error:'#ff4444', info:'#0099ff' };
  var iconMap = { warning:'??', error:'?', info:'??' };
  banner.style.cssText = 'background:' + (bgMap[type]||bgMap.warning) + ';border:1px solid ' + (borderMap[type]||borderMap.warning) + ';color:#fff;padding:10px 14px;margin:12px 16px 0;border-radius:10px;font-size:13px;line-height:1.5;display:flex;gap:8px;align-items:flex-start;position:relative';
  banner.innerHTML = '<span style="font-size:16px;flex-shrink:0">' + (iconMap[type]||'??') + '</span><span style="flex:1">' + msg + '</span><button onclick="this.parentElement.remove()" style="background:none;border:none;color:#fff;font-size:20px;cursor:pointer;padding:0;line-height:1;flex-shrink:0;opacity:0.7">&times;</button>';
  var genLog = document.getElementById('genLogStream');
  if (genLog) screen.insertBefore(banner, genLog); else screen.prepend(banner);
  setTimeout(function() { banner && banner.remove(); }, 10000);
}

/**
 * Shows a "Generation failed" error state with a Try Again button.
 */
function showGenerationFailedError(errorMsg) {
  const container = document.getElementById('toastContainer');
  if (!container) return;

  // Remove any existing failure toast
  const old = document.getElementById('genFailedToast');
  if (old) old.remove();

  const el = document.createElement('div');
  el.id = 'genFailedToast';
  el.className = 'toast gen-failed-toast';
  el.innerHTML = `
    <div class="gft-icon">⚠️</div>
    <div class="gft-body">
      <div class="gft-title">Generation failed</div>
      <div class="gft-msg">${esc(errorMsg)}</div>
      <button class="gft-retry-btn" onclick="document.getElementById('genFailedToast')?.remove(); startGenerate();">Try Again</button>
    </div>
    <button class="gft-close" onclick="document.getElementById('genFailedToast')?.remove();">✕</button>`;
  container.appendChild(el);
  // Auto-dismiss after 15 seconds
  setTimeout(() => el.remove(), 15000);
}

// ==================== GENERATE PICKER MODAL ====================
const pickerState = {
  pattern: 'auto',
  theme: 'cyber_dark',
  mode: 'news',
  topic: ''
};

window.openGeneratePicker = function() {
  const overlay = document.getElementById('generatePickerOverlay');
  if (!overlay) return;
  // Reset to defaults
  pickerState.pattern = 'auto';
  pickerState.theme = 'cyber_dark';
  pickerState.mode = 'news';
  pickerState.topic = '';
  _syncPickerUI();
  overlay.classList.remove('hidden');
  // Animate sheet in
  const sheet = document.getElementById('genPickerSheet');
  if (sheet) {
    sheet.style.transform = 'translateY(100%)';
    requestAnimationFrame(() => {
      sheet.style.transition = 'transform 0.35s cubic-bezier(0.32,0.72,0,1)';
      sheet.style.transform = 'translateY(0)';
    });
  }
  document.body.style.overflow = 'hidden';
  // Fetch and render topic memory
  _loadTopicMemory();
};

window.closeGeneratePicker = function() {
  const sheet = document.getElementById('genPickerSheet');
  if (sheet) {
    sheet.style.transform = 'translateY(100%)';
    setTimeout(() => {
      const overlay = document.getElementById('generatePickerOverlay');
      if (overlay) overlay.classList.add('hidden');
      document.body.style.overflow = '';
    }, 320);
  } else {
    document.getElementById('generatePickerOverlay')?.classList.add('hidden');
    document.body.style.overflow = '';
  }
};

window.setMode = function(mode) {
  pickerState.mode = mode;
  const newsBtn = document.getElementById('modeNewsBtn');
  const evBtn = document.getElementById('modeEvergreenBtn');
  const evWrap = document.getElementById('evergreenTopicWrap');
  if (newsBtn) { newsBtn.classList.toggle('active', mode === 'news'); newsBtn.setAttribute('aria-pressed', mode === 'news'); }
  if (evBtn)   { evBtn.classList.toggle('active', mode === 'evergreen'); evBtn.setAttribute('aria-pressed', mode === 'evergreen'); }
  if (evWrap)  { evWrap.classList.toggle('hidden', mode !== 'evergreen'); }
};

window.selectPattern = function(pattern) {
  pickerState.pattern = pattern;
  // Deselect all, select chosen
  document.querySelectorAll('.pattern-card').forEach(card => {
    const isSelected = card.dataset.pattern === pattern;
    card.classList.toggle('selected', isSelected);
    card.setAttribute('aria-checked', isSelected);
  });
};

window.selectTheme = function(themeKey) {
  pickerState.theme = themeKey;
  document.querySelectorAll('.theme-swatch').forEach(btn => {
    const isSelected = btn.dataset.theme === themeKey;
    btn.classList.toggle('selected', isSelected);
    btn.setAttribute('aria-checked', isSelected);
  });
};

window.setEvergreenTopic = function(topic) {
  pickerState.topic = topic;
  const input = document.getElementById('evergreenTopicInput');
  if (input) input.value = topic;
};

window.submitGenerate = async function() {
  // Collect state
  pickerState.topic = (document.getElementById('evergreenTopicInput')?.value || '').trim();

  // Validate evergreen mode has at minimum auto-selection available
  // (no topic = auto-pick from 30+ evergreen topics, which is valid)

  // Disable button to prevent double-submit
  const btn = document.getElementById('pickerGenerateBtn');
  if (btn) { btn.disabled = true; btn.querySelector('#pickerGenerateBtnText').textContent = 'Starting...'; }

  closeGeneratePicker();

  // Small delay for animation
  await new Promise(r => setTimeout(r, 150));

  await _runGenerate(
    pickerState.pattern,
    pickerState.theme,
    pickerState.mode,
    pickerState.topic
  );
};

function _syncPickerUI() {
  // Sync pattern
  document.querySelectorAll('.pattern-card').forEach(card => {
    const isSelected = card.dataset.pattern === pickerState.pattern;
    card.classList.toggle('selected', isSelected);
    card.setAttribute('aria-checked', isSelected);
  });
  // Sync theme
  document.querySelectorAll('.theme-swatch').forEach(btn => {
    const isSelected = btn.dataset.theme === pickerState.theme;
    btn.classList.toggle('selected', isSelected);
    btn.setAttribute('aria-checked', isSelected);
  });
  // Sync mode
  setMode(pickerState.mode);
  // Reset picker button
  const btn = document.getElementById('pickerGenerateBtn');
  if (btn) {
    btn.disabled = false;
    const t = document.getElementById('pickerGenerateBtnText');
    if (t) t.textContent = 'Generate Post';
  }
  // Reset evergreen input
  const input = document.getElementById('evergreenTopicInput');
  if (input) input.value = '';
}

// Close picker on back-swipe/Android back
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    const overlay = document.getElementById('generatePickerOverlay');
    if (overlay && !overlay.classList.contains('hidden')) closeGeneratePicker();
  }
});

// ==================== TOPIC MEMORY WIDGET ====================
async function _loadTopicMemory() {
  const listEl = document.getElementById('recentTopicsList');
  if (!listEl) return;

  listEl.innerHTML = '<span class="recent-topic-chip recent-topic-loading">Loading...</span>';

  try {
    const data = await api('/api/topic-memory');
    const topics = data.topics || data.recent || data || [];

    if (!Array.isArray(topics) || topics.length === 0) {
      listEl.innerHTML = '<span class="recent-topic-empty">Fresh start — no repeated topics</span>';
      return;
    }

    const now = Date.now();
    listEl.innerHTML = topics.slice(0, 5).map(t => {
      const topic = t.topic || t.title || t.headline || String(t);
      let agoStr = '';
      if (t.generated_at || t.date || t.created_at) {
        const ms = new Date(t.generated_at || t.date || t.created_at).getTime();
        const days = Math.round((now - ms) / 86400000);
        agoStr = days === 0 ? 'today' : days === 1 ? '1 day ago' : `${days} days ago`;
      }
      return `<span class="recent-topic-chip">${esc(topic)}${agoStr ? ' • ' + agoStr : ''}</span>`;
    }).join('');
  } catch (_) {
    const listEl2 = document.getElementById('recentTopicsList');
    if (listEl2) listEl2.innerHTML = '<span class="recent-topic-empty">Topic memory unavailable</span>';
  }
}

// ==================== POPULATE REVIEW (section header) ====================
// (already defined above — this comment keeps section markers consistent)
