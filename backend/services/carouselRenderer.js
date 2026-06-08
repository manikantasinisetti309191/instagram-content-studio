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
  
  // Label badge
  const label = stripEmoji(slideData.label || 'BREAKING');
  ctx.save();
  const badgeW = ctx.measureText(label).width + 40;
  const badgeX = 60;
  const badgeY = 100;
  
  ctx.beginPath();
  roundRectPath(ctx, badgeX, badgeY, badgeW + 20, 36, 18);
  ctx.fillStyle = `${theme.accent}20`;
  ctx.fill();
  ctx.strokeStyle = `${theme.accent}60`;
  ctx.lineWidth = 1;
  ctx.stroke();
  
  ctx.fillStyle = theme.accent;
  ctx.font = '700 14px Arial';
  ctx.letterSpacing = '2px';
  ctx.fillText(label.toUpperCase(), badgeX + 15, badgeY + 23);
  ctx.restore();
  
  // Emoji
  ctx.font = '900 72px Arial';
  ctx.textAlign = 'left';
  ctx.fillText(postData.emoji || '🤖', 60, 250);
  
  // Main title - large and bold
  ctx.font = '900 82px Arial';
  ctx.fillStyle = COLORS.text_primary;
  ctx.textAlign = 'left';
  
  const titleLines = wrapText(ctx, stripEmoji(slideData.title || postData.headline), WIDTH - 120);
  let titleY = 360;
  titleLines.slice(0, 3).forEach(line => {
    // Gradient text effect via shadow
    ctx.save();
    ctx.shadowColor = theme.accent;
    ctx.shadowBlur = 30;
    ctx.fillStyle = COLORS.text_primary;
    ctx.fillText(line, 60, titleY);
    ctx.restore();
    titleY += 95;
  });
  
  // Subtitle
  const subtitleY = Math.min(titleY + 20, 730);
  ctx.font = '400 34px Arial';
  ctx.fillStyle = COLORS.text_secondary;
  
  const subLines = wrapText(ctx, stripEmoji(slideData.subtitle || ''), WIDTH - 120);
  subLines.slice(0, 2).forEach((line, i) => {
    ctx.fillText(line, 60, subtitleY + i * 45);
  });
  
  // Bottom accent line
  const lineGrad = ctx.createLinearGradient(60, 0, 500, 0);
  lineGrad.addColorStop(0, theme.accent);
  lineGrad.addColorStop(1, 'transparent');
  ctx.fillStyle = lineGrad;
  ctx.fillRect(60, HEIGHT - 130, 440, 3);
  
  // "Swipe →" prompt
  ctx.fillStyle = 'rgba(255,255,255,0.4)';
  ctx.font = '400 22px Arial';
  ctx.textAlign = 'left';
  ctx.fillText('Swipe for more →', 60, HEIGHT - 100);
  
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
  
  // Title
  ctx.font = '900 68px Arial';
  ctx.fillStyle = COLORS.text_primary;
  const titleLines = wrapText(ctx, stripEmoji(slideData.title || 'What Is This?'), WIDTH - 120);
  let yPos = 230;
  titleLines.slice(0, 2).forEach(line => {
    ctx.fillText(line, 60, yPos);
    yPos += 82;
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

  // Title
  ctx.font = '900 66px Arial';
  ctx.fillStyle = COLORS.text_primary;
  const titleLines = wrapText(ctx, stripEmoji(slideData.title || 'What Does This Actually Mean?'), WIDTH - 120);
  let yPos = 210;
  titleLines.slice(0, 2).forEach(line => {
    ctx.fillText(line, 60, yPos);
    yPos += 82;
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

  // Title
  ctx.font = '900 66px Arial';
  ctx.fillStyle = COLORS.text_primary;
  const titleLines = wrapText(ctx, stripEmoji(slideData.title || 'Why YOU Should Care'), WIDTH - 120);
  let yPos = 210;
  titleLines.slice(0, 2).forEach(line => {
    ctx.fillText(line, 60, yPos);
    yPos += 80;
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

  // Title
  ctx.font = '900 66px Arial';
  ctx.fillStyle = COLORS.text_primary;
  const titleLines = wrapText(ctx, stripEmoji(slideData.title || 'How It Actually Works'), WIDTH - 120);
  let yPos = 210;
  titleLines.slice(0, 2).forEach(line => {
    ctx.fillText(line, 60, yPos);
    yPos += 80;
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

  drawGlowText(ctx, stripEmoji(slideData.title || 'How YOU Can Use This'), WIDTH/2, 180, 42, theme.accent, theme.glow, 'center');

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
  [[slideData.pro_1, 310], [slideData.pro_2, 390]].forEach(([txt, y]) => {
    ctx.fillStyle = COLORS.accent_green;
    ctx.font = '700 28px Arial';
    ctx.fillText('+', 90, y);
    ctx.fillStyle = COLORS.text_primary;
    ctx.font = '500 24px Arial';
    ctx.textAlign = 'left';
    const lines = wrapText(ctx, stripEmoji(txt || ''), 370);
    lines.slice(0, 2).forEach((l, li) => ctx.fillText(l, 115, y + li * 30));
    ctx.textAlign = 'center';
  });

  // CONS box
  drawGlassCard(ctx, 565, 210, 455, 330, 18);
  ctx.fillStyle = COLORS.accent_pink;
  ctx.font = '700 26px Arial';
  ctx.fillText('CONS', 790, 258);
  [[slideData.con_1, 310], [slideData.con_2, 390]].forEach(([txt, y]) => {
    ctx.fillStyle = COLORS.accent_pink;
    ctx.font = '700 28px Arial';
    ctx.fillText('-', 595, y);
    ctx.fillStyle = COLORS.text_primary;
    ctx.font = '500 24px Arial';
    ctx.textAlign = 'left';
    const lines = wrapText(ctx, stripEmoji(txt || ''), 370);
    lines.slice(0, 2).forEach((l, li) => ctx.fillText(l, 620, y + li * 30));
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
  drawGlowText(ctx, stripEmoji(slideData.title || 'Pro Tips to Get Started'), WIDTH/2, 175, 44, theme.accent, theme.glow, 'center');

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

async function renderCarousel(post) {
  console.log(`🎨 Rendering carousel for post #${post.rank}: ${post.headline}`);
  
  const postDir = path.join(OUTPUT_DIR, post.post_id);
  if (!fs.existsSync(postDir)) {
    fs.mkdirSync(postDir, { recursive: true });
  }
  
  const imagePaths = [];
  
  // Dynamically detect how many slides are in this post (supports 5 or 10)
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
    
    const drawer = SLIDE_DRAWERS[slideKey];
    if (drawer) {
      drawer(ctx, slideData, post);
    } else {
      // Generic fallback for unknown slides
      drawBackground(ctx, (slideNum % 5) || 5);
      const theme = SLIDE_THEMES[(slideNum % 10) || 10];
      ctx.textAlign = 'center';
      ctx.fillStyle = COLORS.text_primary;
      ctx.font = '700 36px Arial';
      ctx.fillText(stripEmoji(Object.values(slideData)[0] || `Slide ${slideNum}`), WIDTH/2, HEIGHT/2);
      drawBrandBar(ctx, slideNum, totalSlides, theme);
    }
    
    const filename = `slide_${slideNum}.png`;
    const filepath = path.join(postDir, filename);
    const buffer = canvas.toBuffer('image/png');
    fs.writeFileSync(filepath, buffer);
    
    imagePaths.push(filepath);
    console.log(`  ✅ Slide ${slideNum}/${totalSlides} rendered: ${filename}`);
  }
  
  console.log(`  🎉 Carousel complete! ${imagePaths.length} slides rendered`);
  return imagePaths;
}

async function renderAllCarousels(contentData) {
  console.log('🎨 Starting carousel rendering for all posts...');
  
  const results = [];
  
  for (const post of contentData.posts) {
    const imagePaths = await renderCarousel(post);
    results.push({
      post_id: post.post_id,
      rank: post.rank,
      headline: post.headline,
      image_paths: imagePaths,
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
