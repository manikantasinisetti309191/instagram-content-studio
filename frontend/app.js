/**
 * Content Studio — Mobile PWA App Logic
 * Handles all screens, API calls, WebSocket, carousel touch gestures
 */
'use strict';

// ==================== STATE ====================
const S = {
  ws: null,
  wsRetries: 0,
  wsTimer: null,
  currentPost: null,
  allPosts: [],
  currentSlide: 0,
  totalSlides: 0,
  touchStartX: 0,
  touchStartY: 0,
  isGenerating: false,
  isPublishing: false,
  isEditing: false,
};

// ==================== INIT ====================
document.addEventListener('DOMContentLoaded', () => {
  registerServiceWorker();
  connectWebSocket();
  loadLatestPost();
  loadHistory();
  checkStatus();
  setupCarouselTouch();
  setInterval(checkStatus, 30000);
});

function registerServiceWorker() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  }
}

// ==================== SCREEN NAVIGATION ====================
const SCREENS = ['home', 'generating', 'review', 'history', 'settings'];

function showScreen(name) {
  SCREENS.forEach(s => {
    const el = document.getElementById(`screen-${s}`);
    if (el) el.classList.toggle('active', s === name);
  });
  // Update bottom nav
  ['home', 'review', 'history', 'settings'].forEach(s => {
    const btn = document.getElementById(`nav-${s}`);
    if (btn) btn.classList.toggle('active', s === name);
  });
  // Special: review nav active when on generating too
  if (name === 'generating') {
    document.getElementById('nav-home')?.classList.add('active');
  }
}

function goToReview() {
  if (S.currentPost) {
    showScreen('review');
  } else {
    showScreen('home');
    showToast('No post to review yet — tap Generate first', 'error');
  }
}

// ==================== WEBSOCKET ====================
function connectWebSocket() {
  try {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    S.ws = new WebSocket(`${protocol}//${window.location.host}`);
    S.ws.onopen = () => {
      S.wsRetries = 0;
      console.log('WS connected');
    };
    S.ws.onmessage = e => {
      try { handleWS(JSON.parse(e.data)); } catch (_) {}
    };
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
    case 'step_complete':
      updateGenStep(data.step, data.type === 'step_complete' ? 'done' : 'active');
      addGenLog(data.message || `${data.step} ${data.type === 'step_complete' ? 'done' : 'started'}`, 'info');
      break;

    case 'pipeline_complete':
    case 'slides_ready_for_review':
      S.isGenerating = false;
      setStatusPill('done', '✓ Ready');
      addGenLog('🎉 Slides ready! Loading...', 'success');
      document.getElementById('generateBtn')?.removeAttribute('disabled');
      setTimeout(async () => {
        await loadLatestPost();
        if (S.currentPost) {
          showScreen('review');
          showToast('🎉 Slides ready! Review and publish when happy 👇', 'success');
        }
      }, 1200);
      break;

    case 'regenerate_complete':
    case 'edit_complete':
      S.isGenerating = false;
      setStatusPill('done', '✓ Ready');
      addGenLog('✅ Done! New content ready.', 'success');
      setTimeout(async () => {
        await loadLatestPost();
        showScreen('review');
        showToast('✅ Content updated!', 'success');
      }, 1200);
      break;

    case 'publish_complete':
      S.isPublishing = false;
      showToast('🎉 Published to Instagram!', 'success');
      closePublishConfirm();
      const pubBtn = document.getElementById('publishBtn');
      if (pubBtn) {
        pubBtn.innerHTML = '<span>✅</span><span>Published!</span>';
        pubBtn.disabled = true;
        pubBtn.className = 'action-btn secondary';
      }
      const badge = document.getElementById('reviewPostBadge');
      if (badge) { badge.textContent = 'Published'; badge.className = 'review-badge published'; }
      loadLatestPost();
      break;

    case 'publish_error':
    case 'edit_error':
    case 'regenerate_error':
      S.isGenerating = false;
      S.isPublishing = false;
      setStatusPill('error', 'Error');
      showToast('❌ ' + (data.message || 'Something went wrong'), 'error');
      document.getElementById('generateBtn')?.removeAttribute('disabled');
      break;

    case 'pipeline_error':
      S.isGenerating = false;
      setStatusPill('error', 'Error');
      addGenLog('❌ Error: ' + (data.error || 'Unknown'), 'error');
      document.getElementById('generateBtn')?.removeAttribute('disabled');
      break;
  }
}

// ==================== STATUS ====================
async function checkStatus() {
  try {
    const data = await api('/api/status');
    const mode = data.instagram_configured ? 'Live Mode 🟢' : 'Preview Mode 🟡';
    const el = document.getElementById('settings-mode');
    if (el) el.textContent = mode;
    const srv = document.getElementById('settings-server');
    if (srv) { srv.textContent = 'Online ✅'; srv.className = 'settings-val green'; }

    if (data.pipeline?.status === 'running' && !S.isGenerating) {
      S.isGenerating = true;
      setStatusPill('running', 'Running...');
    }
  } catch (_) {
    const srv = document.getElementById('settings-server');
    if (srv) { srv.textContent = 'Offline ⚠️'; srv.className = 'settings-val red'; }
  }
}

// ==================== LOAD LATEST POST ====================
async function loadLatestPost() {
  try {
    const data = await api('/api/latest');
    const posts = data?.content?.posts;
    if (!posts?.length) return;

    const post = posts[0];
    S.currentPost = post;
    S.allPosts = posts;

    // Update last post card on home
    renderLastPostCard(post, data);

    // Update stats
    const allPostFiles = await api('/api/posts').catch(() => ({ posts: [] }));
    const allP = allPostFiles.posts || [];
    const pub = allP.filter(p => p.instagram_post_id && !p.instagram_post_id.startsWith('PREVIEW')).length;
    setEl('stat-generated', allP.length);
    setEl('stat-published', pub);
    setEl('stat-today', post ? '1' : '—');

    // Pre-fill review screen
    populateReviewScreen(post);

    // Load history
    renderHistory(allP);

    return post;
  } catch (_) {}
}

function renderLastPostCard(post, data) {
  const card = document.getElementById('lastPostCard');
  if (!card) return;

  const isPublished = post.instagram_post_id && !post.instagram_post_id.startsWith('PREVIEW');
  const runDate = data.content?.generated_at || '';
  const timeStr = runDate ? new Date(runDate).toLocaleString('en-US', { month:'short', day:'numeric', hour:'2-digit', minute:'2-digit' }) : '';

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

// ==================== POPULATE REVIEW ====================
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

  // Try to load images first
  await loadCarouselImages(post);

  // Caption
  const caption = post.caption;
  if (caption) {
    const captionEl = document.getElementById('captionBox');
    if (captionEl) captionEl.textContent =
      caption.full_caption || [caption.hook, caption.body, caption.engagement_prompt, caption.call_to_action].filter(Boolean).join('\n\n');
  }

  // Hashtags
  const hashtagEl = document.getElementById('hashtagBox');
  if (hashtagEl && post.hashtags?.length) {
    hashtagEl.innerHTML = post.hashtags.map(t =>
      `<span class="h-tag" onclick="copyText('${esc(t)}')">${esc(t)}</span>`
    ).join('');
  }
}

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
          <img src="${img}?t=${Date.now()}" alt="Slide ${i+1}" loading="lazy" />
        </div>`
      ).join('');
      if (dots) dots.innerHTML = data.images.map((_, i) =>
        `<div class="c-dot ${i === 0 ? 'active' : ''}" onclick="goToSlide(${i})"></div>`
      ).join('');
      updateSlideCounter();
      return;
    }
  } catch (_) {}

  // Fallback: text slides
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
    case 3: return `<div class="ts-title" style="font-size:16px">${esc(slide.title||'')}</div>${[slide.use_case_1,slide.use_case_2,slide.use_case_3].filter(Boolean).map((u,i)=>`<div class="ts-bullet"><span style="color:#00ff88;font-weight:700">${i+1}.</span> ${esc(u)}</div>`).join('')}`;
    case 4: return `<div class="ts-title">${esc(slide.title||'')}</div><div class="ts-sub" style="margin-bottom:16px">${esc(slide.summary||'')}</div><div class="ts-cta">${esc(slide.cta_question||'Follow for daily AI insights')}</div>`;
    default: return `<div class="ts-title" style="font-size:15px">${esc(slide.title||`Slide ${num+1}`)}</div><div class="ts-sub">${esc(slide.content||slide.subtitle||slide.detail||'')}</div>`;
  }
}

// ==================== CAROUSEL TOUCH ====================
function setupCarouselTouch() {
  const wrapper = document.querySelector('.carousel-wrapper');
  if (!wrapper) return;

  wrapper.addEventListener('touchstart', e => {
    S.touchStartX = e.touches[0].clientX;
    S.touchStartY = e.touches[0].clientY;
  }, { passive: true });

  wrapper.addEventListener('touchend', e => {
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

function goToSlide(index) {
  changeSlide(index - S.currentSlide);
}

function updateSlideCounter() {
  const slides = document.querySelectorAll('.carousel-slide');
  setEl('slideCounter', `${S.currentSlide + 1} / ${slides.length || S.totalSlides}`);
}

// ==================== GENERATE ====================
window.startGenerate = async function() {
  if (S.isGenerating) { showToast('Already generating...', 'error'); return; }

  try {
    const btn = document.getElementById('generateBtn');
    if (btn) btn.disabled = true;
    S.isGenerating = true;

    showScreen('generating');
    resetGenUI();
    setStatusPill('running', 'Generating...');

    await api('/api/generate', 'POST');
    addGenLog('✅ Pipeline started — this takes 3-5 minutes', 'success');
  } catch (err) {
    S.isGenerating = false;
    showScreen('home');
    setStatusPill('error', 'Error');
    showToast('❌ Failed to start: ' + (err.message || 'Check server'), 'error');
    document.getElementById('generateBtn')?.removeAttribute('disabled');
  }
};

function resetGenUI() {
  setEl('genTitle', 'Researching AI News');
  setEl('genSub', 'Scanning 13+ news sources...');
  setEl('genMainIcon', '🔍');
  ['research','content','quality','render'].forEach(s => {
    const el = document.getElementById(`pstep-${s}`);
    if (el) { el.className = 'p-step'; el.querySelector('.p-step-fill').style.width = '0%'; }
  });
  const doc = document.getElementById('genLogStream');
  if (doc) doc.innerHTML = '<div class="log-line info">⏳ Starting pipeline...</div>';
  const first = document.getElementById('pstep-research');
  if (first) first.className = 'p-step active';
}

function updateGenStep(stepName, state) {
  const map = { research: 0, filter: 0, content: 1, quality: 2, render: 3 };
  const idx = map[stepName];
  if (idx === undefined) return;
  const steps = ['research','content','quality','render'];

  // Mark previous as done
  steps.slice(0, idx).forEach(s => {
    const el = document.getElementById(`pstep-${s}`);
    if (el) { el.className = 'p-step done'; el.querySelector('.p-step-fill').style.width = '100%'; }
  });
  // Update current
  const cur = document.getElementById(`pstep-${steps[idx]}`);
  if (cur) {
    cur.className = `p-step ${state}`;
    cur.querySelector('.p-step-fill').style.width = state === 'done' ? '100%' : '';
  }

  const titles = { research:'Researching AI News', filter:'Picking Best Story', content:'Writing Content', quality:'Quality Check', render:'Rendering Slides' };
  const icons = { research:'🔍', filter:'🎯', content:'✍️', quality:'✅', render:'🎨' };
  const subs = { research:'Scanning 13+ news sources...', filter:'Selecting the most viral story...', content:'Writing 10 slides + caption...', quality:'Checking all slide fields...', render:'Creating 1080×1080 images...' };
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

  try {
    await api('/api/regenerate', 'POST');
    addGenLog('🔄 Fetching a fresh topic...', 'info');
  } catch (err) {
    S.isGenerating = false;
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
  if (el) el.value = text;
};

window.submitEdit = async function() {
  const input = document.getElementById('editInput');
  const instruction = input?.value?.trim();
  if (!instruction) { showToast('Please describe what to change', 'error'); return; }

  const submitBtn = document.getElementById('editSubmitBtn');
  if (submitBtn) { submitBtn.disabled = true; submitBtn.innerHTML = '<span>⏳ Applying changes...</span>'; }

  closeEditPanel();
  S.isGenerating = true;
  setStatusPill('running', 'Editing...');
  showScreen('generating');
  resetGenUI();
  setEl('genTitle', 'Rewriting Content');
  setEl('genSub', `"${instruction.substring(0, 50)}${instruction.length > 50 ? '...' : ''}"`);
  setEl('genMainIcon', '✏️');
  addGenLog(`✏️ Instruction: "${instruction}"`, 'info');

  try {
    await api('/api/edit-content', 'POST', { instruction });
    addGenLog('⏳ AI is rewriting content...', 'info');
  } catch (err) {
    S.isGenerating = false;
    showScreen('review');
    setStatusPill('error', 'Error');
    showToast('❌ Edit failed: ' + err.message, 'error');
  }

  if (submitBtn) { submitBtn.disabled = false; submitBtn.innerHTML = '<span>✨ Apply Changes</span>'; }
  if (input) input.value = '';
};

// ==================== PUBLISH ====================
window.showPublishConfirm = function() {
  if (S.isPublishing) return;
  document.getElementById('publishOverlay').classList.remove('hidden');
};
window.closePublishConfirm = function() {
  document.getElementById('publishOverlay').classList.add('hidden');
};

window.submitPublish = async function() {
  if (!S.currentPost) { showToast('No post selected', 'error'); return; }
  if (S.isPublishing) return;

  const btn = document.getElementById('confirmPublishBtn');
  if (btn) { btn.disabled = true; btn.textContent = '⏳ Publishing...'; }
  S.isPublishing = true;
  setStatusPill('running', 'Publishing...');
  showToast('🚀 Publishing to Instagram...', 'info');

  try {
    await api(`/api/posts/${S.currentPost.post_id}/approve`, 'POST');
    // WS will handle success/error
  } catch (err) {
    S.isPublishing = false;
    closePublishConfirm();
    setStatusPill('error', 'Error');
    showToast('❌ Publish failed: ' + err.message, 'error');
    if (btn) { btn.disabled = false; btn.textContent = 'Yes, Publish Now'; }
  }
};

// ==================== COPY ====================
window.copyCaption = function() {
  const el = document.getElementById('captionBox');
  if (!el) return;
  navigator.clipboard.writeText(el.textContent || '').then(() => showToast('✅ Caption copied!', 'success'));
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
  if (!posts?.length) {
    list.innerHTML = `<div class="empty-state-full"><div class="empty-icon">📜</div><div>No posts yet</div></div>`;
    return;
  }
  list.innerHTML = posts.slice(0, 20).map(post => {
    const isPublished = post.instagram_post_id && !post.instagram_post_id.startsWith('PREVIEW');
    const date = post.published_at || post.generated_at || '';
    const dateStr = date ? new Date(date).toLocaleDateString('en-US', { month:'short', day:'numeric', year:'numeric' }) : '—';
    return `
      <div class="history-item" onclick="selectHistoryPost(${JSON.stringify(JSON.stringify(post)).slice(1,-1)})">
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

window.selectHistoryPost = function(postJson) {
  try {
    const post = JSON.parse(postJson);
    populateReviewScreen(post);
    showScreen('review');
  } catch (_) {}
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
  if (el) el.textContent = text;
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
