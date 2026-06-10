/**
 * Carousel Renderer Service
 * Generates premium 1080x1080px PNG carousel slides using HTML Canvas
 * with futuristic AI-themed design aesthetics
 */

require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });
const { createCanvas, GlobalFonts } = require('@napi-rs/canvas');

const fs = require('fs');
const path = require('path');

const OUTPUT_DIR = path.join(__dirname, '../data/images');
const WIDTH = 1080;
const HEIGHT = 1080;

// Ensure output directory exists
if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

// Color palette - ultra premium dark AI aesthetic
const COLORS = {
  bg_dark: '#050510',
  bg_card: '#0a0a1a',
  accent_blue: '#00d4ff',
  accent_purple: '#7c3aed',
  accent_pink: '#ff006e',
  accent_green: '#00ff88',
  text_primary: '#ffffff',
  text_secondary: '#a0aec0',
  text_muted: '#4a5568',
  glass_bg: 'rgba(255,255,255,0.05)',
  glass_border: 'rgba(255,255,255,0.1)',
  glow_blue: 'rgba(0,212,255,0.3)',
  glow_purple: 'rgba(124,58,237,0.3)',
};

// Strip all emoji / non-BMP characters that node-canvas can't render
function stripEmoji(text) {
  if (!text) return '';
  return String(text)
    // Remove emoji and supplementary Unicode (U+1F000–U+10FFFF)
    .replace(/[\u{1F000}-\u{10FFFF}]/gu, '')
    // Remove common symbol blocks (arrows, dingbats, misc symbols)
    .replace(/[\u{2600}-\u{27BF}]/gu, '')
    // Collapse double spaces left behind
    .replace(/  +/g, ' ')
    .trim();
}

// Slide theme configurations
const SLIDE_THEMES = {
  1: { accent: COLORS.accent_blue,   glow: COLORS.glow_blue,             gradient: ['#050510', '#0a1628', '#050510'] },
  2: { accent: COLORS.accent_purple, glow: COLORS.glow_purple,           gradient: ['#050510', '#14082a', '#050510'] },
  3: { accent: COLORS.accent_pink,   glow: 'rgba(255,0,110,0.3)',        gradient: ['#050510', '#1a0812', '#050510'] },
  4: { accent: COLORS.accent_green,  glow: 'rgba(0,255,136,0.3)',        gradient: ['#050510', '#081a10', '#050510'] },
  5: { accent: COLORS.accent_blue,   glow: COLORS.glow_blue,             gradient: ['#050510', '#0a1628', '#050510'] },
  6: { accent: COLORS.accent_purple, glow: COLORS.glow_purple,           gradient: ['#050510', '#14082a', '#050510'] },
  7: { accent: COLORS.accent_pink,   glow: 'rgba(255,0,110,0.3)',        gradient: ['#050510', '#1a0812', '#050510'] },
  8: { accent: COLORS.accent_green,  glow: 'rgba(0,255,136,0.3)',        gradient: ['#050510', '#081a10', '#050510'] },
  9: { accent: COLORS.accent_blue,   glow: COLORS.glow_blue,             gradient: ['#050510', '#0a1628', '#050510'] },
  10:{ accent: COLORS.accent_purple, glow: COLORS.glow_purple,           gradient: ['#050510', '#14082a', '#050510'] },
};

function drawBackground(ctx, slideNum) {
  const theme = SLIDE_THEMES[slideNum] || SLIDE_THEMES[1];
  
  // Main gradient background
  const bgGradient = ctx.createLinearGradient(0, 0, WIDTH, HEIGHT);
  bgGradient.addColorStop(0, theme.gradient[0]);
  bgGradient.addColorStop(0.5, theme.gradient[1]);
  bgGradient.addColorStop(1, theme.gradient[2]);
  ctx.fillStyle = bgGradient;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);
  
  // Grid lines (subtle)
  ctx.strokeStyle = 'rgba(255,255,255,0.03)';
  ctx.lineWidth = 1;
  for (let x = 0; x < WIDTH; x += 60) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, HEIGHT);
    ctx.stroke();
  }
  for (let y = 0; y < HEIGHT; y += 60) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(WIDTH, y);
    ctx.stroke();
  }
  
  // Large glow circles
  const glow1 = ctx.createRadialGradient(200, 200, 0, 200, 200, 400);
  glow1.addColorStop(0, theme.glow);
  glow1.addColorStop(1, 'transparent');
  ctx.fillStyle = glow1;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);
  
  const glow2 = ctx.createRadialGradient(880, 880, 0, 880, 880, 350);
  glow2.addColorStop(0, theme.glow);
  glow2.addColorStop(1, 'transparent');
  ctx.fillStyle = glow2;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);
  
  // Decorative circles
  ctx.strokeStyle = `${theme.accent}20`;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(WIDTH - 100, 100, 180, 0, Math.PI * 2);
  ctx.stroke();
  
  ctx.strokeStyle = `${theme.accent}15`;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(WIDTH - 100, 100, 250, 0, Math.PI * 2);
  ctx.stroke();
  
  // Corner accent line
  ctx.strokeStyle = `${theme.accent}40`;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(120, 0);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(0, 120);
  ctx.stroke();
}

function drawBrandBar(ctx, postNumber, totalPosts, theme) {
  // Top brand stripe
  const barGradient = ctx.createLinearGradient(0, 0, WIDTH, 0);
  barGradient.addColorStop(0, `${theme.accent}80`);
  barGradient.addColorStop(0.5, `${theme.accent}40`);
  barGradient.addColorStop(1, 'transparent');
  ctx.fillStyle = barGradient;
  ctx.fillRect(0, 0, WIDTH, 4);
  
  // Bottom slide counter
  const dotY = HEIGHT - 40;
  for (let i = 0; i < totalPosts; i++) {
    const dotX = WIDTH / 2 - (totalPosts * 20) / 2 + i * 20 + 6;
    ctx.beginPath();
    ctx.arc(dotX, dotY, i === postNumber - 1 ? 5 : 3, 0, Math.PI * 2);
    ctx.fillStyle = i === postNumber - 1 ? theme.accent : 'rgba(255,255,255,0.3)';
    ctx.fill();
  }
  
  // Slide number text
  ctx.fillStyle = 'rgba(255,255,255,0.3)';
  ctx.font = '400 22px Arial';
  ctx.textAlign = 'right';
  ctx.fillText(`${postNumber} / ${totalPosts}`, WIDTH - 50, HEIGHT - 30);
}

// Draw a rounded rect manually (avoids roundRect compat issues on some node-canvas builds)
function roundRectPath(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.arcTo(x + w, y, x + w, y + r, r);
  ctx.lineTo(x + w, y + h - r);
  ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
  ctx.lineTo(x + r, y + h);
  ctx.arcTo(x, y + h, x, y + h - r, r);
  ctx.lineTo(x, y + r);
  ctx.arcTo(x, y, x + r, y, r);
  ctx.closePath();
}

function drawGlassCard(ctx, x, y, w, h, radius = 20) {
  ctx.save();
  roundRectPath(ctx, x, y, w, h, radius);
  ctx.fillStyle = 'rgba(255,255,255,0.04)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.08)';
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.restore();
}

function drawGlowText(ctx, text, x, y, fontSize, color, glow, align = 'left') {
  ctx.save();
  ctx.textAlign = align;
  ctx.shadowColor = glow;
  ctx.shadowBlur = 20;
  ctx.fillStyle = color;
  ctx.font = `700 ${fontSize}px Arial`;
  ctx.fillText(text, x, y);
  ctx.shadowBlur = 0;
  ctx.restore();
}

function wrapText(ctx, text, maxWidth) {
  const words = text.split(' ');
  const lines = [];
  let currentLine = '';
  for (const word of words) {
    const testLine = currentLine ? `${currentLine} ${word}` : word;
    if (ctx.measureText(testLine).width <= maxWidth) {
      currentLine = testLine;
    } else {
      if (currentLine) lines.push(currentLine);
      currentLine = word;
    }
  }
  if (currentLine) lines.push(currentLine);
  return lines;
}

/**
 * fitTitle — cross-platform title renderer.
 * Uses a conservative inner wrap width (WRAP_FACTOR of safeWidth) so that
 * Linux/Skia font metrics (which can differ from Windows GDI) never cause
 * visual overflow on the right edge of the canvas.
 */
function fitTitle(ctx, text, weight, maxSize, minSize, safeWidth, maxLines) {
  // Wrap conservatively: Skia/Linux can render ~10-15% wider than it measures.
  // Using 82% gives enough margin without making text too small.
  const wrapWidth = Math.round(safeWidth * 0.82);
  let fontSize = maxSize;
  while (fontSize >= minSize) {
    ctx.font = `${weight} ${fontSize}px Arial`;
    const lines = wrapText(ctx, text, wrapWidth);
    if (lines.length <= maxLines) {
      return { lines, fontSize, lineHeight: Math.round(fontSize * 1.2) };
    }
    fontSize -= 4;
  }
  ctx.font = `${weight} ${minSize}px Arial`;
  const lines = wrapText(ctx, text, wrapWidth);
  return { lines, fontSize: minSize, lineHeight: Math.round(minSize * 1.2) };
}


/**
 * PERMANENT HELPER — Draws a numbered circle row inside a card.
 * Guarantees circle and text are ALWAYS vertically centered,
 * regardless of font size, card height, or text wrapping.
 *
 * @param {CanvasRenderingContext2D} ctx
 * @param {string} num      - e.g. '01', '02', '03'
 * @param {string} text     - the tip/step text
 * @param {number} cardX    - card left X
 * @param {number} cardY    - card top Y
 * @param {number} cardW    - card width
 * @param {number} cardH    - card height
 * @param {string} accent   - theme accent color
 * @param {number} [circleR=28] - circle radius
 * @param {number} [fontSize=26] - text font size
 */
function drawNumberedRow(ctx, num, text, cardX, cardY, cardW, cardH, accent, circleR = 28, fontSize = 26) {
  const circleX = cardX + 60;          // circle center X
  const circleY = cardY + cardH / 2;   // circle center Y = card vertical center

  // Draw glowing circle
  ctx.beginPath();
  ctx.arc(circleX, circleY, circleR, 0, Math.PI * 2);
  const grad = ctx.createRadialGradient(circleX, circleY, 0, circleX, circleY, circleR);
  grad.addColorStop(0, `${accent}55`);
  grad.addColorStop(1, `${accent}10`);
  ctx.fillStyle = grad;
  ctx.fill();
  ctx.strokeStyle = accent;
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // Number — centered inside circle
  // Canvas fillText baseline is approx 0.35 * fontSize below center,
  // so we shift down by circleR * 0.32 for optical center
  ctx.fillStyle = accent;
  ctx.font = `800 ${Math.round(circleR * 0.75)}px Arial`;
  ctx.textAlign = 'center';
  ctx.fillText(num, circleX, circleY + circleR * 0.32);

  // Text — vertically centered next to circle
  const textX = cardX + 60 + circleR + 20;    // start after circle + gap
  const maxW  = cardX + cardW - textX - 20;    // right edge margin
  ctx.fillStyle = '#ffffff';
  ctx.font = `500 ${fontSize}px Arial`;
  ctx.textAlign = 'left';
  const lines = wrapText(ctx, text, maxW);
  const lineH = fontSize * 1.35;
  const totalTextH = lines.length * lineH;
  // Position so the block of text is centered on circleY
  let textY = circleY - totalTextH / 2 + lineH * 0.8;
  lines.slice(0, 2).forEach(line => {
    ctx.fillText(line, textX, textY);
    textY += lineH;
  });
}

function drawSlide1(ctx, slideData, postData) {
  const theme = SLIDE_THEMES[1];
  drawBackground(ctx, 1);
  
  // ─── BADGE: label (MUST KNOW / BREAKING / etc.) — 18px font, bigger pill
  const label = stripEmoji(slideData.label || 'BREAKING');
  ctx.save();
  ctx.font = '700 18px Arial';
  const badgeX = 60;
  const badgeY = 96;
  const badgeW = ctx.measureText(label.toUpperCase()).width + 36;
  roundRectPath(ctx, badgeX, badgeY, badgeW, 40, 20);
  ctx.fillStyle = `${theme.accent}25`;
  ctx.fill();
  ctx.strokeStyle = `${theme.accent}70`;
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.fillStyle = theme.accent;
  ctx.fillText(label.toUpperCase(), badgeX + 18, badgeY + 27);
  ctx.restore();

  // ─── BADGE: "AI LATEST NEWS" — 17px font, frosted pill
  ctx.save();
  ctx.font = '600 17px Arial';
  const catLabel = 'AI LATEST NEWS';
  const catX = badgeX + badgeW + 14;
  const catW = ctx.measureText(catLabel).width + 36;
  roundRectPath(ctx, catX, badgeY, catW, 40, 20);
  ctx.fillStyle = 'rgba(255,255,255,0.08)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.25)';
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,0.82)';
  ctx.fillText(catLabel, catX + 18, badgeY + 27);
  ctx.restore();

  // ─── EMOJI
  ctx.font = '900 72px Arial';
  ctx.textAlign = 'left';
  ctx.fillText(postData.emoji || '🤖', 60, 258);

  // ─── MAIN TITLE — fitTitle() auto-adjusts font size on THIS server
  // safeWidth=880 (WIDTH-200) gives generous padding so no char touches edge
  const rawTitle = stripEmoji(slideData.title || postData.headline || '');
  const t1 = fitTitle(ctx, rawTitle, '900', 68, 32, WIDTH - 200, 4);
  ctx.textAlign = 'left';
  let titleY = 368;
  t1.lines.forEach(line => {
    ctx.save();
    ctx.font = `900 ${t1.fontSize}px Arial`;
    ctx.shadowColor = theme.accent;
    ctx.shadowBlur = 30;
    ctx.fillStyle = COLORS.text_primary;
    ctx.fillText(line, 60, titleY);
    ctx.restore();
    titleY += t1.lineHeight;
  });

  // ─── SUBTITLE
  const subtitleY = Math.min(titleY + 24, 730);
  ctx.font = '400 32px Arial';
  ctx.fillStyle = COLORS.text_secondary;
  ctx.textAlign = 'left';
  const subLines = wrapText(ctx, stripEmoji(slideData.subtitle || ''), WIDTH - 140);
  subLines.slice(0, 2).forEach((line, i) => {
    ctx.fillText(line, 60, subtitleY + i * 44);
  });

  // ─── BOTTOM ACCENT LINE
  const lineGrad = ctx.createLinearGradient(60, 0, 500, 0);
  lineGrad.addColorStop(0, theme.accent);
  lineGrad.addColorStop(1, 'transparent');
  ctx.fillStyle = lineGrad;
  ctx.fillRect(60, HEIGHT - 130, 440, 3);

  // ─── SWIPE PROMPT
  ctx.fillStyle = 'rgba(255,255,255,0.4)';
  ctx.font = '400 22px Arial';
  ctx.textAlign = 'left';
  ctx.fillText('Swipe for more \u2192', 60, HEIGHT - 100);

  drawBrandBar(ctx, 1, 10, theme);
}


function drawSlide2(ctx, slideData, postData) {
  const theme = SLIDE_THEMES[2];
  drawBackground(ctx, 2);
  
  // Section label — pure fillRect, no arcs
  ctx.fillStyle = `${theme.accent}20`;
  ctx.fillRect(60, 80, WIDTH - 120, 60);
  ctx.fillStyle = theme.accent;
  ctx.fillRect(60, 80, 3, 60);
  ctx.fillStyle = theme.accent;
  ctx.font = '700 13px Arial';
  ctx.textAlign = 'left';
  ctx.fillText('EXPLAINER', 80, 117);
  
  // Title — fitTitle() OS-agnostic
  const rawTitle2 = stripEmoji(slideData.title || 'What Is This?');
  const t2 = fitTitle(ctx, rawTitle2, '900', 60, 28, WIDTH - 200, 3);
  ctx.fillStyle = COLORS.text_primary;
  let yPos = 230;
  t2.lines.forEach(line => {
    ctx.font = `900 ${t2.fontSize}px Arial`;
    ctx.fillText(line, 60, yPos);
    yPos += t2.lineHeight;
  });
  
  // Divider
  const divGrad = ctx.createLinearGradient(60, 0, WIDTH - 60, 0);
  divGrad.addColorStop(0, theme.accent);
  divGrad.addColorStop(1, 'transparent');
  ctx.fillStyle = divGrad;
  ctx.fillRect(60, yPos + 10, WIDTH - 120, 2);
  
  yPos += 60;
  
  // Bullet points — simple rect-only rendering (no path/stroke to avoid state bleed)
  const bullets = [
    slideData.bullet_1 || '',
    slideData.bullet_2 || '',
    slideData.bullet_3 || '',
  ];
  
  bullets.forEach((bulletText) => {
    if (!bulletText) return;
    const cleanText = stripEmoji(bulletText);
    
    // Card tint — simple fillRect, no path needed
    ctx.fillStyle = 'rgba(255,255,255,0.04)';
    ctx.fillRect(60, yPos - 10, WIDTH - 120, 90);
    
    // Accent left bar
    ctx.fillStyle = theme.accent;
    ctx.fillRect(60, yPos - 10, 4, 90);
    
    // Text
    ctx.fillStyle = COLORS.text_primary;
    ctx.font = '500 28px Arial';
    ctx.textAlign = 'left';
    const bLines = wrapText(ctx, cleanText, WIDTH - 200);
    bLines.slice(0, 2).forEach((line, i) => {
      ctx.fillText(line, 88, yPos + 42 + i * 34);
    });
    
    yPos += 108;
  });
  
  drawBrandBar(ctx, 2, 10, theme);
}

function drawSlide3(ctx, slideData, postData) {
  const theme = SLIDE_THEMES[3];
  drawBackground(ctx, 3);

  // Section header
  ctx.fillStyle = theme.accent;
  ctx.font = '700 15px Arial';
  ctx.textAlign = 'left';
  ctx.fillText('EXPLAIN IT SIMPLY', 60, 110);

  // Title — fitTitle() OS-agnostic
  const rawTitle3 = stripEmoji(slideData.title || 'What Does This Actually Mean?');
  const t3 = fitTitle(ctx, rawTitle3, '900', 60, 28, WIDTH - 200, 3);
  ctx.fillStyle = COLORS.text_primary;
  let yPos = 210;
  t3.lines.forEach(line => {
    ctx.font = `900 ${t3.fontSize}px Arial`;
    ctx.fillText(line, 60, yPos);
    yPos += t3.lineHeight;
  });

  yPos += 30;

  // Simple explanation card
  const explanation = stripEmoji(slideData.simple_explanation || slideData.impact_statement || 'This is a major AI breakthrough that makes powerful tools accessible to everyone.');
  drawGlassCard(ctx, 60, yPos, WIDTH - 120, 200, 16);

  // Accent left bar
  ctx.fillStyle = theme.accent;
  ctx.fillRect(60, yPos, 4, 200);

  ctx.fillStyle = theme.accent;
  ctx.font = '700 14px Arial';
  ctx.textAlign = 'left';
  ctx.fillText('IN SIMPLE WORDS', 88, yPos + 30);

  ctx.fillStyle = COLORS.text_primary;
  ctx.font = '500 28px Arial';
  const explLines = wrapText(ctx, explanation, WIDTH - 160);
  explLines.slice(0, 4).forEach((line, i) => {
    ctx.fillText(line, 88, yPos + 70 + i * 38);
  });

  yPos += 220;

  // Analogy card
  const analogy = stripEmoji(slideData.analogy || slideData.detail || 'Think of it like having a brilliant assistant available 24/7 for free.');
  drawGlassCard(ctx, 60, yPos, WIDTH - 120, 140, 16);

  ctx.fillStyle = theme.accent;
  ctx.font = '700 14px Arial';
  ctx.fillText('REAL-WORLD ANALOGY', 88, yPos + 30);

  ctx.fillStyle = COLORS.text_secondary;
  ctx.font = '400 26px Arial';
  const analogyLines = wrapText(ctx, analogy, WIDTH - 160);
  analogyLines.slice(0, 3).forEach((line, i) => {
    ctx.fillText(line, 88, yPos + 66 + i * 36);
  });

  drawBrandBar(ctx, 3, 10, theme);
}

function drawSlide4(ctx, slideData, postData) {
  const theme = SLIDE_THEMES[4];
  drawBackground(ctx, 4);

  // Section header
  ctx.fillStyle = theme.accent;
  ctx.font = '700 15px Arial';
  ctx.textAlign = 'left';
  ctx.fillText('WHY IT MATTERS', 60, 110);

  // Title — fitTitle() OS-agnostic
  const rawTitle4 = stripEmoji(slideData.title || 'Why YOU Should Care');
  const t4 = fitTitle(ctx, rawTitle4, '900', 60, 28, WIDTH - 200, 3);
  ctx.fillStyle = COLORS.text_primary;
  let yPos = 210;
  t4.lines.forEach(line => {
    ctx.font = `900 ${t4.fontSize}px Arial`;
    ctx.fillText(line, 60, yPos);
    yPos += t4.lineHeight;
  });

  yPos += 10;

  // Impact statement — full width highlight card
  const impact = stripEmoji(slideData.impact_statement || slideData.use_case_1 || 'This AI update changes how we work, learn and create forever.');
  drawGlassCard(ctx, 60, yPos, WIDTH - 120, 100, 14);
  ctx.fillStyle = theme.accent;
  ctx.fillRect(60, yPos, 4, 100);
  ctx.fillStyle = COLORS.text_primary;
  ctx.font = '600 26px Arial';
  const impLines = wrapText(ctx, impact, WIDTH - 160);
  impLines.slice(0, 2).forEach((line, i) => ctx.fillText(line, 88, yPos + 40 + i * 36));
  yPos += 120;

  // Who benefits — 3 cards: students / employees / business
  const roles = [
    { label: 'STUDENTS', text: slideData.for_students || slideData.use_case_2 || 'Write essays, research faster, ace assignments' },
    { label: 'EMPLOYEES', text: slideData.for_employees || slideData.use_case_3 || 'Draft reports, automate tasks, work smarter' },
    { label: 'BUSINESS', text: slideData.for_business || slideData.use_case_1 || 'Cut costs, scale operations, boost productivity' },
  ];

  roles.forEach(role => {
    drawGlassCard(ctx, 60, yPos, WIDTH - 120, 90, 12);
    ctx.fillStyle = theme.accent;
    ctx.font = '700 13px Arial';
    ctx.textAlign = 'left';
    ctx.fillText(role.label, 88, yPos + 26);
    ctx.fillStyle = COLORS.text_primary;
    ctx.font = '500 24px Arial';
    const rLines = wrapText(ctx, stripEmoji(role.text), WIDTH - 160);
    rLines.slice(0, 2).forEach((line, i) => ctx.fillText(line, 88, yPos + 56 + i * 28));
    yPos += 108;
  });

  drawBrandBar(ctx, 4, 10, theme);
}

function drawSlide5(ctx, slideData, postData) {
  const theme = SLIDE_THEMES[5];
  drawBackground(ctx, 5);

  // Section header
  ctx.fillStyle = theme.accent;
  ctx.font = '700 15px Arial';
  ctx.textAlign = 'left';
  ctx.fillText('HOW IT WORKS', 60, 110);

  // Title — fitTitle() OS-agnostic
  const rawTitle5 = stripEmoji(slideData.title || 'How It Actually Works');
  const t5 = fitTitle(ctx, rawTitle5, '900', 60, 28, WIDTH - 200, 3);
  ctx.fillStyle = COLORS.text_primary;
  let yPos = 210;
  t5.lines.forEach(line => {
    ctx.font = `900 ${t5.fontSize}px Arial`;
    ctx.fillText(line, 60, yPos);
    yPos += t5.lineHeight;
  });

  yPos += 20;

  // 3 Steps
  const steps = [
    { num: '01', text: slideData.step_1 || slideData.use_case_1 || 'Input your request in plain simple language' },
    { num: '02', text: slideData.step_2 || slideData.use_case_2 || 'The AI processes it using advanced trained models' },
    { num: '03', text: slideData.step_3 || slideData.use_case_3 || 'You get accurate results in seconds, ready to use' },
  ];

  const STEP_CARD_H = 108;
  steps.forEach(step => {
    drawGlassCard(ctx, 60, yPos, WIDTH - 120, STEP_CARD_H, 14);
    drawNumberedRow(ctx, step.num, stripEmoji(step.text), 60, yPos, WIDTH - 120, STEP_CARD_H, theme.accent);
    yPos += STEP_CARD_H + 14;
  });

  // Fun fact
  const funFact = stripEmoji(slideData.fun_fact || slideData.summary || 'The AI was trained on billions of examples to help you.');
  yPos += 8;
  drawGlassCard(ctx, 60, yPos, WIDTH - 120, 100, 14);
  ctx.fillStyle = theme.accent;
  ctx.font = '700 13px Arial';
  ctx.textAlign = 'left';
  ctx.fillText('FUN FACT', 88, yPos + 28);
  ctx.fillStyle = COLORS.text_secondary;
  ctx.font = '400 24px Arial';
  const ffLines = wrapText(ctx, funFact, WIDTH - 160);
  ffLines.slice(0, 2).forEach((line, i) => ctx.fillText(line, 88, yPos + 58 + i * 32));

  drawBrandBar(ctx, 5, 10, theme);
}



// ─── SLIDE 6: HOW TO USE IT NOW ─────────────────────────────────────────────
function drawSlide6(ctx, slideData, post) {
  const theme = SLIDE_THEMES[6];
  drawBackground(ctx, 6);
  ctx.textAlign = 'center';

  // Slide 6 title — wrap if too long
  const s6title = stripEmoji(slideData.title || 'How YOU Can Use This');
  const s6sz = s6title.length > 30 ? 34 : 42;
  ctx.font = `700 ${s6sz}px Arial`;
  const s6lines = wrapText(ctx, s6title, WIDTH - 100);
  let s6y = 170;
  s6lines.slice(0, 2).forEach(l => {
    ctx.save(); ctx.textAlign = 'center'; ctx.shadowColor = theme.glow; ctx.shadowBlur = 20;
    ctx.fillStyle = theme.accent; ctx.fillText(l, WIDTH/2, s6y); ctx.restore();
    s6y += s6sz * 1.3;
  });

  const cases = [
    { label: 'Student',  val: slideData.use_case_1 },
    { label: 'Employee', val: slideData.use_case_2 },
    { label: 'Business', val: slideData.use_case_3 },
    { label: 'Creator',  val: slideData.use_case_4 },
  ];

  cases.forEach((c, i) => {
    const cardY = 250 + i * 165;
    drawGlassCard(ctx, 80, cardY, WIDTH - 160, 145, 16);
    ctx.fillStyle = theme.accent;
    ctx.font = '700 22px Arial';
    ctx.textAlign = 'left';
    ctx.fillText(c.label.toUpperCase(), 120, cardY + 38);
    ctx.fillStyle = COLORS.text_primary;
    ctx.font = '500 26px Arial';
    const lines = wrapText(ctx, stripEmoji(c.val || ''), WIDTH - 200);
    lines.slice(0, 2).forEach((line, li) => ctx.fillText(line, 120, cardY + 75 + li * 34));
    ctx.textAlign = 'center';
  });

  drawBrandBar(ctx, 6, 10, theme);
}

// ─── SLIDE 7: PROS & CONS ────────────────────────────────────────────────────
function drawSlide7(ctx, slideData, post) {
  const theme = SLIDE_THEMES[7];
  drawBackground(ctx, 7);
  ctx.textAlign = 'center';

  drawGlowText(ctx, stripEmoji(slideData.title || 'The Good & The Not-So-Good'), WIDTH/2, 160, 40, theme.accent, theme.glow, 'center');

  // PROS box
  drawGlassCard(ctx, 60, 210, 455, 330, 18);
  ctx.fillStyle = COLORS.accent_green;
  ctx.font = '700 26px Arial';
  ctx.fillText('PROS', 285, 258);
  [[slideData.pro_1, 300], [slideData.pro_2, 400]].forEach(([txt, y]) => {
    ctx.fillStyle = COLORS.accent_green;
    ctx.font = '700 26px Arial';
    ctx.fillText('+', 90, y);
    ctx.fillStyle = COLORS.text_primary;
    ctx.font = '500 22px Arial';
    ctx.textAlign = 'left';
    const lines = wrapText(ctx, stripEmoji(txt || ''), 370);
    lines.slice(0, 3).forEach((l, li) => ctx.fillText(l, 115, y + li * 28));
    ctx.textAlign = 'center';
  });

  // CONS box
  drawGlassCard(ctx, 565, 210, 455, 330, 18);
  ctx.fillStyle = COLORS.accent_pink;
  ctx.font = '700 26px Arial';
  ctx.fillText('CONS', 790, 258);
  [[slideData.con_1, 300], [slideData.con_2, 400]].forEach(([txt, y]) => {
    ctx.fillStyle = COLORS.accent_pink;
    ctx.font = '700 26px Arial';
    ctx.fillText('-', 595, y);
    ctx.fillStyle = COLORS.text_primary;
    ctx.font = '500 22px Arial';
    ctx.textAlign = 'left';
    const lines = wrapText(ctx, stripEmoji(txt || ''), 370);
    lines.slice(0, 3).forEach((l, li) => ctx.fillText(l, 620, y + li * 28));
    ctx.textAlign = 'center';
  });

  // Balanced view note
  ctx.fillStyle = 'rgba(255,255,255,0.35)';
  ctx.font = '400 22px Arial';
  ctx.fillText('A balanced view helps you decide what\'s right for you', WIDTH/2, 620);

  drawBrandBar(ctx, 7, 10, theme);
}

// ─── SLIDE 8: COMPARE / CONTEXT ──────────────────────────────────────────────
function drawSlide8(ctx, slideData, post) {
  const theme = SLIDE_THEMES[8];
  drawBackground(ctx, 8);
  ctx.textAlign = 'center';

  drawGlowText(ctx, stripEmoji(slideData.title || 'The Bigger Picture'), WIDTH/2, 160, 42, theme.accent, theme.glow, 'center');

  // Context paragraph
  drawGlassCard(ctx, 80, 200, WIDTH-160, 180, 16);
  ctx.fillStyle = COLORS.text_secondary;
  ctx.font = '400 26px Arial';
  const ctxLines = wrapText(ctx, stripEmoji(slideData.context || ''), WIDTH - 200);
  ctxLines.slice(0, 4).forEach((l, i) => ctx.fillText(l, WIDTH/2, 255 + i * 38));

  // Before / Now
  const labelY = 440;
  [[60, 'BEFORE', slideData.vs_before, COLORS.accent_pink], [WIDTH/2 + 20, 'NOW', slideData.vs_now, COLORS.accent_green]].forEach(([x, label, text, color]) => {
    drawGlassCard(ctx, x, labelY, 460, 230, 16);
    ctx.fillStyle = color;
    ctx.font = '700 26px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(label, x + 230, labelY + 48);
    ctx.fillStyle = COLORS.text_primary;
    ctx.font = '500 24px Arial';
    const lines = wrapText(ctx, stripEmoji(text || ''), 400);
    lines.slice(0, 3).forEach((l, li) => ctx.fillText(l, x + 230, labelY + 100 + li * 38));
  });
  ctx.textAlign = 'center';

  drawBrandBar(ctx, 8, 10, theme);
}

// ─── SLIDE 9: PRO TIPS ───────────────────────────────────────────────────────
function drawSlide9(ctx, slideData, post) {
  const theme = SLIDE_THEMES[9];
  drawBackground(ctx, 9);

  // Section label
  ctx.fillStyle = theme.accent;
  ctx.font = '700 15px Arial';
  ctx.textAlign = 'left';
  ctx.fillText('EXPERT TIPS', 60, 110);

  // Title centered
  ctx.textAlign = 'center';
  // Slide 9 title — wrap if too long
  const s9title = stripEmoji(slideData.title || 'Pro Tips to Get Started');
  const s9sz = s9title.length > 30 ? 36 : 44;
  ctx.font = `700 ${s9sz}px Arial`;
  const s9lines = wrapText(ctx, s9title, WIDTH - 120);
  let s9y = 168;
  s9lines.slice(0, 2).forEach(l => {
    ctx.save(); ctx.textAlign = 'center'; ctx.shadowColor = theme.glow; ctx.shadowBlur = 20;
    ctx.fillStyle = theme.accent; ctx.fillText(l, WIDTH/2, s9y); ctx.restore();
    s9y += s9sz * 1.25;
  });

  const tips = [
    { num: '01', txt: slideData.tip_1 },
    { num: '02', txt: slideData.tip_2 },
    { num: '03', txt: slideData.tip_3 },
  ];

  const CARD_H = 120;
  const CARD_GAP = 16;
  const START_Y = 220;

  tips.forEach((tip, i) => {
    const cardY = START_Y + i * (CARD_H + CARD_GAP);
    drawGlassCard(ctx, 60, cardY, WIDTH - 120, CARD_H, 14);
    drawNumberedRow(ctx, tip.num, stripEmoji(tip.txt || ''), 60, cardY, WIDTH - 120, CARD_H, theme.accent);
  });

  // Bonus tip card
  const bonusY = START_Y + tips.length * (CARD_H + CARD_GAP) + 10;
  drawGlassCard(ctx, 60, bonusY, WIDTH - 120, 110, 14);

  // Star accent bar
  ctx.fillStyle = COLORS.accent_green;
  ctx.fillRect(60, bonusY, 4, 110);

  ctx.fillStyle = COLORS.accent_green;
  ctx.font = '700 13px Arial';
  ctx.textAlign = 'left';
  ctx.fillText('BONUS TIP', 84, bonusY + 32);

  ctx.fillStyle = COLORS.text_secondary;
  ctx.font = '400 24px Arial';
  const bLines = wrapText(ctx, stripEmoji(slideData.bonus_tip || ''), WIDTH - 160);
  bLines.slice(0, 2).forEach((l, li) => ctx.fillText(l, 84, bonusY + 64 + li * 32));

  drawBrandBar(ctx, 9, 10, theme);
}

// ─── SLIDE 10: BRANDING + CTA ────────────────────────────────────────────────
function drawSlide10(ctx, slideData, post) {
  const theme = SLIDE_THEMES[10];
  drawBackground(ctx, 10);
  ctx.textAlign = 'center';

  // Large bottom line header
  drawGlowText(ctx, 'The Bottom Line', WIDTH/2, 200, 52, theme.accent, theme.glow, 'center');

  // Summary
  drawGlassCard(ctx, 80, 240, WIDTH - 160, 170, 20);
  ctx.fillStyle = COLORS.text_primary;
  ctx.font = '600 30px Arial';
  const sumLines = wrapText(ctx, stripEmoji(slideData.summary || ''), WIDTH - 200);
  sumLines.slice(0, 3).forEach((l, i) => ctx.fillText(l, WIDTH/2, 300 + i * 44));

  // CTA Question
  ctx.fillStyle = theme.accent;
  ctx.font = '700 30px Arial';
  ctx.fillText(stripEmoji(slideData.cta_question || 'What will you try first?'), WIDTH/2, 480);

  // Divider
  ctx.strokeStyle = 'rgba(255,255,255,0.1)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(120, 510);
  ctx.lineTo(WIDTH - 120, 510);
  ctx.stroke();

  // @learnwithmanii branding block
  drawGlassCard(ctx, 120, 535, WIDTH - 240, 180, 18);

  // Logo circle
  ctx.beginPath();
  ctx.arc(WIDTH/2, 615, 42, 0, Math.PI * 2);
  const logoGrad = ctx.createRadialGradient(WIDTH/2, 615, 0, WIDTH/2, 615, 42);
  logoGrad.addColorStop(0, theme.accent);
  logoGrad.addColorStop(1, `${theme.accent}40`);
  ctx.fillStyle = logoGrad;
  ctx.fill();
  ctx.fillStyle = COLORS.bg_dark;
  ctx.font = '800 28px Arial';
  ctx.fillText('LM', WIDTH/2, 626);

  ctx.fillStyle = COLORS.text_primary;
  ctx.font = '700 26px Arial';
  ctx.fillText('@learnwithmanii', WIDTH/2, 686);
  ctx.fillStyle = COLORS.text_secondary;
  ctx.font = '400 20px Arial';
  ctx.fillText('Follow for daily AI lessons', WIDTH/2, 712);

  // Save prompt at bottom
  ctx.fillStyle = 'rgba(255,255,255,0.4)';
  ctx.font = '400 22px Arial';
  ctx.fillText('Save this post — you\'ll need it later', WIDTH/2, HEIGHT - 60);

  drawBrandBar(ctx, 10, 10, theme);
}

const SLIDE_DRAWERS = {
  slide_1:  drawSlide1,
  slide_2:  drawSlide2,
  slide_3:  drawSlide3,
  slide_4:  drawSlide4,
  slide_5:  drawSlide5,
  slide_6:  drawSlide6,
  slide_7:  drawSlide7,
  slide_8:  drawSlide8,
  slide_9:  drawSlide9,
  slide_10: drawSlide10,
};

// ─── UNIVERSAL PATTERN-AWARE SLIDE RENDERER ─────────────────────────────────
// Renders any slide from patterns A/B/C/D/E using each schema's field names.
// Falls back to old SLIDE_DRAWERS for backward-compatible legacy posts.
function drawPatternSlide(ctx, slideNum, post) {
  const s = post.slides[`slide_${slideNum}`] || {};
  const pattern = post.pattern || 'legacy';
  const total = Object.keys(post.slides || {}).length;
  const themeKey = SLIDE_THEMES[((slideNum - 1) % 10) + 1] || SLIDE_THEMES[1];

  // Background always drawn first
  drawBackground(ctx, (slideNum % 5) || 5);

  // Helper: wrap text on canvas
  function wrap(text, maxW, maxLines) {
    const lines = wrapText(ctx, stripEmoji(String(text || '')), maxW);
    return maxLines ? lines.slice(0, maxLines) : lines;
  }

  // Helper: draw a text block
  function block(text, x, y, font, color, align, maxW, maxLines) {
    ctx.font = font;
    ctx.fillStyle = color;
    ctx.textAlign = align || 'center';
    const lines = wrap(text, maxW || WIDTH - 120, maxLines || 5);
    lines.forEach((line, i) => ctx.fillText(line, x, y + i * (parseInt(font) * 1.4)));
    return y + lines.length * (parseInt(font) * 1.4);
  }

  // Helper: draw a rounded pill badge
  function badge(text, cx, y, accent) {
    const t = stripEmoji(String(text || '')).toUpperCase();
    ctx.font = 'bold 26px Arial';
    const tw = ctx.measureText(t).width;
    const bw = tw + 40, bh = 46;
    roundRectPath(ctx, cx - bw / 2, y, bw, bh, 23);
    ctx.fillStyle = accent + '28';
    ctx.fill();
    ctx.strokeStyle = accent;
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.fillStyle = accent;
    ctx.textAlign = 'center';
    ctx.fillText(t, cx, y + 31);
  }

  // Helper: draw a card box
  function card(x, y, w, h) {
    drawGlassCard(ctx, x, y, w, h, 16);
  }

  const acc = themeKey.accent;
  const W = WIDTH, H = HEIGHT;
  const cx = W / 2;

  // ─── PATTERN A: Tool Spotlight ───────────────────────────────────────────
  if (pattern === 'A') {
    if (slideNum === 1) {
      badge(s.label || 'TOOL DROP', cx, 110, acc);
      const name = stripEmoji(s.tool_name || post.headline || '');
      ctx.font = fitTitle(ctx, name, 880, 96, 48);
      ctx.fillStyle = '#ffffff';
      ctx.textAlign = 'center';
      const nameLines = wrapText(ctx, name, 880);
      let ny = nameLines.length > 1 ? 370 : 440;
      nameLines.slice(0, 3).forEach((l, i) => ctx.fillText(l, cx, ny + i * 108));
      ny += nameLines.length * 108;
      block(s.tagline, cx, ny + 20, '400 40px Arial', acc, 'center', 880, 2);
      block(s.subtitle, cx, H - 140, '300 30px Arial', 'rgba(255,255,255,0.55)', 'center', 880, 1);
    } else if (slideNum === 2) {
      let y = 130;
      y = block(s.title || 'What Is It?', cx, y, 'bold 52px Arial', '#fff', 'center', 880, 2) + 30;
      card(60, y, W - 120, 120); block(s.one_liner, cx, y + 44, '500 32px Arial', '#fff', 'center', W - 180, 2); y += 150;
      block(s.analogy, cx, y, 'italic 500 34px Arial', acc, 'center', 880, 3); y += 160;
      card(60, y, W - 120, 100); block(s.key_fact, cx, y + 40, 'bold 28px Arial', themeKey.accent === acc ? '#a78bfa' : acc, 'center', W - 180, 2);
    } else if (slideNum >= 3 && slideNum <= 5) {
      block(s.use_case_title, cx, 120, 'bold 44px Arial', acc, 'center', 880, 2);
      block(s.who_its_for, cx, 195, '400 28px Arial', 'rgba(255,255,255,0.5)', 'center', 880, 1);
      let y = 250;
      [s.step_1, s.step_2, s.step_3].filter(Boolean).forEach((step, i) => {
        card(48, y, W - 96, 118);
        ctx.font = 'bold 30px Arial'; ctx.fillStyle = acc; ctx.textAlign = 'left'; ctx.fillText(`${i + 1}.`, 80, y + 50);
        block(step, 122, y + 38, '500 27px Arial', '#fff', 'left', W - 190, 2); y += 138;
      });
      card(cx - 200, y + 14, 400, 66);
      block(s.time_saved, cx, y + 50, 'bold 26px Arial', '#00ff88', 'center', 380, 1);
    } else if (slideNum === 6) {
      badge(s.slide_label || 'COPY THIS PROMPT', cx, 80, acc);
      block(s.prompt_name, cx, 182, 'bold 38px Arial', '#fff', 'center', 880, 2);
      card(48, 230, W - 96, 520);
      ctx.font = '400 24px Courier New';
      ctx.fillStyle = acc; ctx.textAlign = 'left';
      wrapText(ctx, stripEmoji(s.prompt_text || ''), W - 160).slice(0, 13).forEach((l, i) => ctx.fillText(l, 78, 280 + i * 36));
      block(s.expected_output, cx, 790, '500 26px Arial', '#a78bfa', 'center', 880, 2);
    } else if (slideNum === 7) {
      block(s.title || 'Who Is This For?', cx, 130, 'bold 50px Arial', '#fff', 'center', 880, 2);
      const segs = [['Students', s.for_students], ['Employees', s.for_employees], ['Creators', s.for_creators], ['Business', s.for_business]];
      const cw = (W - 144) / 2; // card width with gap
      segs.forEach(([label, val], i) => {
        const col = i % 2, row = Math.floor(i / 2);
        const cardX = 48 + col * (cw + 24);
        const cardY = 218 + row * 296;
        const cardH = 270;
        const textCx = cardX + cw / 2;
        card(cardX, cardY, cw, cardH);
        block(label, textCx, cardY + 44, 'bold 24px Arial', acc, 'center', cw - 24, 1);
        // Auto-shrink text: try 21px first (3 lines), then 18px (4 lines) if too long
        const valText = stripEmoji(val || '');
        ctx.font = '400 21px Arial';
        const lines21 = wrapText(ctx, valText, cw - 32);
        const fontSize = lines21.length <= 4 ? 21 : 18;
        const maxL = lines21.length <= 4 ? 4 : 5;
        block(val, textCx, cardY + 84, `400 ${fontSize}px Arial`, 'rgba(255,255,255,0.80)', 'center', cw - 32, maxL);
      });
    } else if (slideNum === 8) {
      block(s.title || 'Start in 5 Minutes', cx, 128, 'bold 50px Arial', '#fff', 'center', 880, 2);
      let y = 210;
      [s.step_1, s.step_2, s.step_3].filter(Boolean).forEach((step, i) => {
        const cardH = 152; // taller card = enough room for 2 wrapped lines
        card(48, y, W - 96, cardH);
        ctx.font = 'bold 34px Arial'; ctx.fillStyle = acc; ctx.textAlign = 'left'; ctx.fillText(`${i + 1}`, 82, y + 60);
        // Auto-shrink: try 26px, fall back to 23px for very long steps
        const stepText = stripEmoji(step || '');
        ctx.font = '500 26px Arial';
        const lines26 = wrapText(ctx, stepText, W - 192);
        const fs = lines26.length <= 2 ? 26 : 23;
        block(step, 124, y + 38, `500 ${fs}px Arial`, '#fff', 'left', W - 192, 2);
        y += 168;
      });
      block(s.closing_line || "That's it. You're in.", cx, y + 24, 'bold 30px Arial', '#00ff88', 'center', 880, 2);
    } else if (slideNum === 9) {
      block(s.title || 'The Honest Catch', cx, 128, 'bold 50px Arial', '#fff', 'center', 880, 2);
      let y = 220;
      [s.limitation_1, s.limitation_2].filter(Boolean).forEach(lim => {
        const cardH = 158; // taller = enough for 2 lines at 27px
        drawGlassCard(ctx, 48, y, W - 96, cardH, 14);
        ctx.font = 'bold 30px Arial'; ctx.fillStyle = '#ff8080'; ctx.textAlign = 'left'; ctx.fillText('X', 80, y + 60);
        // Auto-shrink for long limitation text
        const limText = stripEmoji(lim || '');
        ctx.font = '500 26px Arial';
        const limLines = wrapText(ctx, limText, W - 196);
        const limFs = limLines.length <= 2 ? 26 : 22;
        block(lim, 122, y + 40, `500 ${limFs}px Arial`, 'rgba(255,255,255,0.85)', 'left', W - 196, 2);
        y += 178;
      });
      drawGlassCard(ctx, 48, y + 10, W - 96, 158, 14);
      block('Still worth it:', cx, y + 50, 'bold 28px Arial', '#00ff88', 'center', 880, 1);
      block(s.still_worth_it, cx, y + 92, '500 26px Arial', '#fff', 'center', W - 144, 2);
    } else if (slideNum === 10) {
      // Pass verdict→summary so drawSlide10 can render Pattern A's verdict field
      drawSlide10(ctx, { ...s, summary: s.verdict || s.summary || s.comment_question || '' }, post);
    }

  // ─── PATTERN B: Prompt Playbook ──────────────────────────────────────────
  } else if (pattern === 'B') {
    if (slideNum === 1) {
      badge(s.label || 'PROMPT PACK', cx, 118, acc);
      const hl = stripEmoji(s.headline || post.headline || '');
      ctx.font = fitTitle(ctx, hl, 880, 72, 40);
      ctx.fillStyle = '#fff'; ctx.textAlign = 'center';
      let y = 360;
      wrapText(ctx, hl, 880).slice(0, 3).forEach(l => { ctx.fillText(l, cx, y); y += 88; });
      block(s.subtitle || 'Copy-paste ready. Save this.', cx, H - 148, '400 34px Arial', acc, 'center', 880, 1);
    } else if (slideNum === 2) {
      let y = 138;
      y = block(s.title || 'Why These Prompts Work', cx, y, 'bold 50px Arial', '#fff', 'center', 880, 2) + 28;
      card(58, y, W - 116, 160); block(s.context, cx, y + 48, '400 29px Arial', 'rgba(255,255,255,0.8)', 'center', W - 170, 3); y += 196;
      block(s.tease, cx, y + 36, 'italic 500 30px Arial', acc, 'center', 880, 2);
    } else if (slideNum >= 3 && slideNum <= 8) {
      const pNum = s.prompt_number || (slideNum - 2);
      ctx.font = 'bold 26px Arial'; ctx.fillStyle = 'rgba(255,255,255,0.35)'; ctx.textAlign = 'left'; ctx.fillText(`Prompt ${pNum}`, 58, 76);
      let y = 118;
      y = block(s.prompt_name, cx, y, 'bold 44px Arial', acc, 'center', 880, 2) + 20;
      card(48, y, W - 96, 440);
      ctx.font = '400 22px Courier New'; ctx.fillStyle = acc; ctx.textAlign = 'left';
      wrapText(ctx, stripEmoji(s.prompt_text || ''), W - 156).slice(0, 12).forEach((l, i) => ctx.fillText(l, 70, y + 42 + i * 34));
      y += 464;
      block('Use when: ' + stripEmoji(s.use_when || ''), 58, y + 28, '400 24px Arial', 'rgba(255,255,255,0.45)', 'left', W - 120, 1);
      block('Output: ' + stripEmoji(s.output_description || ''), 58, y + 58, '400 24px Arial', '#a78bfa', 'left', W - 120, 1);
    } else if (slideNum === 9) {
      block(s.title || 'The Pro Technique', cx, 128, 'bold 50px Arial', '#fff', 'center', 880, 2);
      card(48, 196, W - 96, 154); block(s.technique, cx, 246, '500 28px Arial', '#fff', 'center', W - 150, 3);
      let y = 376;
      [['Before', s.before_example, '#ff8080'], ['After', s.after_example, '#00ff88']].forEach(([lbl, ex, col]) => {
        drawGlassCard(ctx, 48, y, W - 96, 118, 14);
        ctx.font = 'bold 24px Arial'; ctx.fillStyle = col; ctx.textAlign = 'left'; ctx.fillText(lbl + ':', 78, y + 38);
        block(ex, 78, y + 62, '400 24px Arial', 'rgba(255,255,255,0.75)', 'left', W - 160, 2);
        y += 138;
      });
    } else if (slideNum === 10) { drawSlide10(ctx, { ...s, summary: s.verdict || s.summary || '' }, post); }

  // ─── PATTERN C: Tutorial ─────────────────────────────────────────────────
  } else if (pattern === 'C') {
    if (slideNum === 1) {
      badge(s.label || 'TUTORIAL', cx, 118, acc);
      let y = 340;
      ctx.font = fitTitle(ctx, stripEmoji(s.headline || post.headline || ''), 880, 70, 38);
      ctx.fillStyle = '#fff'; ctx.textAlign = 'center';
      wrapText(ctx, stripEmoji(s.headline || post.headline || ''), 880).slice(0, 3).forEach(l => { ctx.fillText(l, cx, y); y += 86; });
      block(s.subtitle || 'Copy my exact workflow', cx, H - 148, '400 33px Arial', acc, 'center', 880, 1);
    } else if (slideNum === 2) {
      block('What You Will Build', cx, 130, 'bold 46px Arial', '#fff', 'center', 880, 1);
      let y = 210;
      [['Result:', s.deliverable], ['Tools:', s.tools_needed], ['Time:', s.time_required], ['Level:', s.skill_level]].filter(([, v]) => v).forEach(([lbl, val]) => {
        card(48, y, W - 96, 112); 
        ctx.font = 'bold 28px Arial'; ctx.fillStyle = acc; ctx.textAlign = 'left'; ctx.fillText(lbl, 80, y + 44);
        block(val, 200, y + 30, '400 27px Arial', '#fff', 'left', W - 250, 2); y += 132;
      });
    } else if (slideNum >= 3 && slideNum <= 8) {
      const sn = s.step_number || String(slideNum - 2).padStart(2, '0');
      ctx.font = 'bold 160px Arial'; ctx.fillStyle = acc + '18'; ctx.textAlign = 'center'; ctx.fillText(sn, cx, 280);
      ctx.font = 'bold 90px Arial'; ctx.fillStyle = acc; ctx.textAlign = 'left'; ctx.fillText(sn, 52, 206);
      let y = 128;
      block(s.step_title, cx, y, 'bold 44px Arial', '#fff', 'center', 880, 2); y = 320;
      card(48, y, W - 96, 118); block(s.action, 80, y + 36, '500 27px Arial', '#fff', 'left', W - 150, 2); y += 138;
      card(48, y, W - 96, 100);
      ctx.font = '400 22px Courier New'; ctx.fillStyle = acc; ctx.textAlign = 'left';
      ctx.fillText(stripEmoji(s.exact_input || '').substring(0, 58), 76, y + 42);
      y += 120;
      ctx.font = '400 24px Arial'; ctx.fillStyle = '#00ff88'; ctx.textAlign = 'left';
      ctx.fillText('Result: ' + stripEmoji(s.expected_output || ''), 58, y + 22);
      ctx.fillStyle = '#ff8080';
      ctx.fillText('Avoid: ' + stripEmoji(s.common_mistake || ''), 58, y + 56);
    } else if (slideNum === 9) {
      block('Before vs After', cx, 128, 'bold 50px Arial', '#fff', 'center', 880, 1);
      drawGlassCard(ctx, 48, 196, W - 96, 200, 14);
      block('BEFORE: ' + (s.before_state || ''), cx, 228, '500 28px Arial', '#ff8080', 'center', W - 140, 3);
      drawGlassCard(ctx, 48, 420, W - 96, 200, 14);
      block('AFTER: ' + (s.after_state || ''), cx, 452, '500 28px Arial', '#00ff88', 'center', W - 140, 3);
      block(s.time_saved, cx, 658, 'bold 32px Arial', acc, 'center', 880, 1);
      block(s.quality_note, cx, 714, '400 26px Arial', 'rgba(255,255,255,0.6)', 'center', 880, 2);
    } else if (slideNum === 10) { drawSlide10(ctx, { ...s, summary: s.verdict || s.summary || '' }, post); }

  // ─── PATTERN D: Myth Busting ──────────────────────────────────────────────
  } else if (pattern === 'D') {
    if (slideNum === 1) {
      badge(s.label || 'MYTH vs FACT', cx, 118, acc);
      let y = 340;
      ctx.font = fitTitle(ctx, stripEmoji(s.headline || post.headline || ''), 880, 70, 38);
      ctx.fillStyle = '#fff'; ctx.textAlign = 'center';
      wrapText(ctx, stripEmoji(s.headline || post.headline || ''), 880).slice(0, 3).forEach(l => { ctx.fillText(l, cx, y); y += 86; });
      block(s.subtitle, cx, H - 148, '400 32px Arial', acc, 'center', 880, 2);
    } else if (slideNum >= 2 && slideNum <= 6) {
      const mNum = slideNum - 1;
      badge('MYTH ' + mNum, cx, 88, '#ff8080');
      let y = 188;
      card(48, y, W - 96, 260); block(s.myth_text, cx, y + 48, 'bold 34px Arial', '#ff8080', 'center', W - 140, 4); y += 286;
      card(48, y, W - 96, 260); block(s.truth_text, cx, y + 44, '500 30px Arial', '#00ff88', 'center', W - 140, 4); y += 280;
      ctx.font = '400 25px Arial'; ctx.fillStyle = 'rgba(255,255,255,0.55)'; ctx.textAlign = 'center';
      ctx.fillText(stripEmoji(s.why_it_matters || ''), cx, y + 16);
    } else if (slideNum === 7) {
      block(s.title || 'The Big One', cx, 128, 'bold 44px Arial', acc, 'center', 880, 2);
      card(48, 210, W - 96, 200); block(s.myth_text, cx, 248, 'bold 30px Arial', '#ff8080', 'center', W - 140, 4);
      card(48, 430, W - 96, 200); block(s.truth_text, cx, 468, '500 28px Arial', '#00ff88', 'center', W - 140, 4);
      block(s.impact, cx, 666, '400 26px Arial', 'rgba(255,255,255,0.65)', 'center', 880, 2);
    } else if (slideNum === 8) {
      block(s.title || 'What To Do Instead', cx, 128, 'bold 50px Arial', '#fff', 'center', 880, 2);
      let y = 250;
      [s.action_1, s.action_2, s.action_3].filter(Boolean).forEach((a, i) => {
        card(48, y, W - 96, 120); 
        ctx.font = 'bold 30px Arial'; ctx.fillStyle = acc; ctx.textAlign = 'left'; ctx.fillText(`${i + 1}.`, 80, y + 50);
        block(a, 120, y + 36, '500 27px Arial', '#fff', 'left', W - 180, 2); y += 144;
      });
    } else if (slideNum === 9) {
      block(s.title || 'Reality Check', cx, 128, 'bold 50px Arial', '#fff', 'center', 880, 2);
      card(48, 210, W - 96, 380);
      block(s.honest_summary, cx, 260, '400 28px Arial', 'rgba(255,255,255,0.8)', 'center', W - 140, 6);
      block(s.bottom_line, cx, 640, 'bold 30px Arial', acc, 'center', 880, 2);
    } else if (slideNum === 10) { drawSlide10(ctx, { ...s, summary: s.verdict || s.summary || '' }, post); }

  // ─── PATTERN E: Comparison ────────────────────────────────────────────────
  } else if (pattern === 'E') {
    if (slideNum === 1) {
      badge(s.label || 'COMPARISON', cx, 118, acc);
      let y = 340;
      ctx.font = fitTitle(ctx, stripEmoji(s.headline || post.headline || ''), 880, 70, 38);
      ctx.fillStyle = '#fff'; ctx.textAlign = 'center';
      wrapText(ctx, stripEmoji(s.headline || post.headline || ''), 880).slice(0, 3).forEach(l => { ctx.fillText(l, cx, y); y += 86; });
      block(s.subtitle, cx, H - 148, '400 32px Arial', acc, 'center', 880, 2);
    } else if (slideNum === 2) {
      const aLbl = stripEmoji(s.tool_a || 'Tool A'), bLbl = stripEmoji(s.tool_b || 'Tool B');
      const hw = (W - 120) / 2;
      card(48, 130, hw, 100); block(aLbl, 48 + hw / 2, 188, 'bold 36px Arial', acc, 'center', hw - 30, 1);
      card(72 + hw, 130, hw, 100); block(bLbl, 72 + hw * 1.5, 188, 'bold 36px Arial', '#ff006e', 'center', hw - 30, 1);
      block('Categories Tested:', cx, 274, 'bold 28px Arial', 'rgba(255,255,255,0.6)', 'center', 880, 1);
      block(s.categories_tested, cx, 314, '400 26px Arial', '#fff', 'center', 880, 3);
      block(s.disclaimer, cx, H - 130, '400 24px Arial', 'rgba(255,255,255,0.4)', 'center', 880, 2);
    } else if (slideNum >= 3 && slideNum <= 7) {
      block(s.category, cx, 118, 'bold 44px Arial', acc, 'center', 880, 2);
      const hw = (W - 120) / 2;
      const winner = stripEmoji(s.winner || '');
      // Tool A card
      const aCol = winner.toLowerCase().includes(stripEmoji(s.tool_a || '').toLowerCase().split(' ')[0]) ? '#00ff88' : 'rgba(255,255,255,0.08)';
      drawGlassCard(ctx, 48, 190, hw, 580, 16);
      ctx.strokeStyle = aCol; ctx.lineWidth = 2; ctx.stroke();
      block(stripEmoji(s.tool_a || ''), 48 + hw / 2, 238, 'bold 30px Arial', '#fff', 'center', hw - 30, 1);
      block(s.tool_a_score, 48 + hw / 2, 288, 'bold 52px Arial', aCol === '#00ff88' ? '#00ff88' : acc, 'center', hw - 30, 1);
      block(s.tool_a_reason, 48 + hw / 2, 350, '400 24px Arial', 'rgba(255,255,255,0.75)', 'center', hw - 40, 5);
      // Tool B card
      const bCol = !winner.toLowerCase().includes(stripEmoji(s.tool_a || '').toLowerCase().split(' ')[0]) ? '#00ff88' : 'rgba(255,255,255,0.08)';
      drawGlassCard(ctx, 72 + hw, 190, hw, 580, 16);
      ctx.strokeStyle = bCol; ctx.lineWidth = 2; ctx.stroke();
      block(stripEmoji(s.tool_b || ''), 72 + hw * 1.5, 238, 'bold 30px Arial', '#fff', 'center', hw - 30, 1);
      block(s.tool_b_score, 72 + hw * 1.5, 288, 'bold 52px Arial', bCol === '#00ff88' ? '#00ff88' : '#ff006e', 'center', hw - 30, 1);
      block(s.tool_b_reason, 72 + hw * 1.5, 350, '400 24px Arial', 'rgba(255,255,255,0.75)', 'center', hw - 40, 5);
      block('Key difference: ' + stripEmoji(s.key_difference || ''), cx, 818, '500 25px Arial', acc, 'center', 880, 2);
    } else if (slideNum === 8) {
      block('The Verdict', cx, 128, 'bold 52px Arial', '#fff', 'center', 880, 1);
      const hw = (W - 120) / 2;
      card(48, 196, hw, 260); block(stripEmoji(s.tool_a || '') + ' wins for:', 48 + hw / 2, 232, 'bold 26px Arial', acc, 'center', hw - 30, 1);
      block(s.tool_a_wins_for, 48 + hw / 2, 272, '400 24px Arial', '#fff', 'center', hw - 40, 4);
      card(72 + hw, 196, hw, 260); block(stripEmoji(s.tool_b || '') + ' wins for:', 72 + hw * 1.5, 232, 'bold 26px Arial', '#ff006e', 'center', hw - 30, 1);
      block(s.tool_b_wins_for, 72 + hw * 1.5, 272, '400 24px Arial', '#fff', 'center', hw - 40, 4);
      block('Overall Winner: ' + stripEmoji(s.overall_winner || ''), cx, 500, 'bold 36px Arial', '#00ff88', 'center', 880, 1);
      block(s.verdict_reason, cx, 550, '400 26px Arial', 'rgba(255,255,255,0.7)', 'center', 880, 3);
    } else if (slideNum === 9) {
      block('Who Should Use What?', cx, 128, 'bold 46px Arial', '#fff', 'center', 880, 2);
      let y = 224;
      [['Students', s.for_students, acc], ['Professionals', s.for_professionals, '#a78bfa'], ['Budget users', s.for_budget, '#00ff88'], ['Power users', s.for_power_users, '#ff006e']].forEach(([lbl, val, col]) => {
        card(48, y, W - 96, 108); 
        ctx.font = 'bold 26px Arial'; ctx.fillStyle = col; ctx.textAlign = 'left'; ctx.fillText(lbl + ':', 80, y + 42);
        block(val, 80, y + 64, '400 25px Arial', '#fff', 'left', W - 160, 1); y += 128;
      });
    } else if (slideNum === 10) { drawSlide10(ctx, { ...s, summary: s.verdict || s.summary || '' }, post); }

  // ─── LEGACY / UNKNOWN pattern ─────────────────────────────────────────────
  } else {
    const drawer = SLIDE_DRAWERS[`slide_${slideNum}`];
    if (drawer) { drawer(ctx, s, post); return; }
    block(Object.values(s)[0] || `Slide ${slideNum}`, cx, H / 2, 'bold 40px Arial', '#fff', 'center', W - 120, 4);
  }

  // Always draw brand bar on top of everything
  drawBrandBar(ctx, slideNum, total, themeKey);
}


async function renderCarousel(post) {
  console.log(`🎨 Rendering carousel for post #${post.rank}: ${post.headline}`);
  
  const postDir = path.join(OUTPUT_DIR, post.post_id);
  if (!fs.existsSync(postDir)) {
    fs.mkdirSync(postDir, { recursive: true });
  }
  
  const imagePaths = [];
  const imageBase64s = []; // ← also store base64 so images survive disk wipes
  
  const totalSlides = Object.keys(post.slides || {}).length;
  
  for (let slideNum = 1; slideNum <= totalSlides; slideNum++) {
    const slideKey = `slide_${slideNum}`;
    const slideData = post.slides[slideKey];
    
    if (!slideData) {
      console.warn(`  ⚠️  No data for ${slideKey}, skipping`);
      continue;
    }
    
    const canvas = createCanvas(WIDTH, HEIGHT);
    const ctx = canvas.getContext('2d');

    // ─── Dispatch: new pattern-aware renderer OR legacy fallback ─────────────
    const isNewPattern = ['A', 'B', 'C', 'D', 'E'].includes(post.pattern);
    if (isNewPattern) {
      drawPatternSlide(ctx, slideNum, post);
    } else {
      const drawer = SLIDE_DRAWERS[slideKey];
      if (drawer) {
        drawer(ctx, slideData, post);
      } else {
        drawBackground(ctx, (slideNum % 5) || 5);
        const theme = SLIDE_THEMES[(slideNum % 10) || 10];
        ctx.textAlign = 'center';
        ctx.fillStyle = COLORS.text_primary;
        ctx.font = '700 36px Arial';
        ctx.fillText(stripEmoji(Object.values(slideData)[0] || `Slide ${slideNum}`), WIDTH / 2, HEIGHT / 2);
        drawBrandBar(ctx, slideNum, totalSlides, theme);
      }
    }

    
    const filename = `slide_${slideNum}.png`;
    const filepath = path.join(postDir, filename);
    const buffer = canvas.toBuffer('image/png');
    
    // Save to disk (may be lost on Render restart)
    fs.writeFileSync(filepath, buffer);
    imagePaths.push(filepath);
    
    // ALSO store as base64 data URI — survives in memory even after disk wipe
    imageBase64s.push(`data:image/png;base64,${buffer.toString('base64')}`);
    
    console.log(`  ✅ Slide ${slideNum}/${totalSlides} rendered: ${filename}`);
  }
  
  console.log(`  🎉 Carousel complete! ${imagePaths.length} slides rendered`);
  return { imagePaths, imageBase64s };
}


async function renderAllCarousels(contentData, options = {}) {
  const { theme: globalTheme = 'cyber_dark' } = options;
  console.log(`🎨 Starting carousel rendering — theme: ${globalTheme}...`);

  const results = [];

  for (const post of contentData.posts) {
    // If post has its own theme, use it; else use global theme from picker
    const effectiveTheme = post.theme || globalTheme;
    const { imagePaths, imageBase64s } = await renderCarousel(post, effectiveTheme);
    results.push({
      post_id: post.post_id,
      rank: post.rank,
      headline: post.headline,
      image_paths: imagePaths,
      image_base64s: imageBase64s,
      rendered_at: new Date().toISOString()
    });
  }

  console.log(`✅ All carousels rendered! ${results.length} posts complete`);
  return results;
}

// Test mode

if (process.argv.includes('--test')) {
  const testPost = {
    post_id: 'test_post_001',
    rank: 1,
    headline: 'OpenAI Releases GPT-5 with Revolutionary Capabilities',
    category: 'Model Release',
    emoji: '🚀',
    slides: {
      slide_1: {
        label: 'BREAKING',
        title: 'GPT-5 Just Changed Everything',
        subtitle: 'OpenAI drops their most powerful model yet'
      },
      slide_2: {
        title: 'What Is GPT-5?',
        bullet_1: '🧠 200% smarter than GPT-4 on all benchmarks',
        bullet_2: '⚡ Real-time multimodal understanding',
        bullet_3: '🌐 Integrated live web access built-in'
      },
      slide_3: {
        title: 'Why This Changes Everything',
        impact_statement: 'AI just crossed the threshold into true general intelligence',
        detail: 'Every industry will be transformed in the next 12 months.',
        stat_or_quote: '10x more capable than any existing AI model'
      },
      slide_4: {
        title: 'How YOU Can Use This',
        use_case_1: '🎨 Generate viral content in seconds',
        use_case_2: '💼 Automate entire business workflows',
        use_case_3: '🚀 Build software without coding skills',
        pro_tip: 'Start with GPT-5 API today — early adopters win'
      },
      slide_5: {
        title: 'The Bottom Line',
        summary: 'GPT-5 is the biggest AI leap in history. Use it or get left behind.',
        cta_question: 'Will you use GPT-5? 👇',
        cta_action: '🔖 Save this post'
      }
    }
  };
  
  renderCarousel(testPost).then(paths => {
    console.log('\n🖼️  Generated images:');
    paths.forEach(p => console.log(' -', p));
  }).catch(console.error);
}

module.exports = { renderCarousel, renderAllCarousels };
