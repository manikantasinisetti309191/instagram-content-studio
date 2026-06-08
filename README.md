# ⚡ AI Instagram News Automation System

A fully autonomous AI-powered Instagram automation system that researches AI news daily, generates premium carousel posts, and publishes them automatically at 9:00 AM.

## 🚀 Quick Start

```bash
# 1. Install dependencies
npm install

# 2. Configure your credentials in .env (already pre-filled with Gemini key)
# Add Instagram credentials when ready

# 3. Start the system
npm start

# 4. Open the dashboard
# http://localhost:3000
```

## 📋 Daily Automation Schedule

| Time | Action |
|------|--------|
| 8:00 AM | AI news research starts (13+ sources) |
| 8:05 AM | Top 5 stories filtered by AI |
| 8:15 AM | Captions & carousel content generated |
| 8:45 AM | 25 premium carousel images rendered |
| 9:00 AM | All 5 posts published to Instagram |

## 🔑 Configuration

Edit `.env` file:

```env
# Required — already set
GEMINI_API_KEY=your_key_here

# Add when ready for live publishing
INSTAGRAM_ACCESS_TOKEN=your_token
INSTAGRAM_BUSINESS_ACCOUNT_ID=your_account_id
```

## 📱 Instagram Setup

To enable auto-publishing:

1. Create a [Facebook Developer App](https://developers.facebook.com/)
2. Add Instagram Graph API permission
3. Get a long-lived access token
4. Add credentials to `.env`

Without credentials, the system runs in **Preview Mode** — all content is generated and displayed on the dashboard.

## 🎛️ Dashboard Features

- **Live Pipeline Status** — Real-time step-by-step progress
- **Today's Top 5** — AI-selected news with viral scores
- **Carousel Previews** — View all generated slides
- **Captions & Hashtags** — Copy-ready content
- **Automation Logs** — Live activity feed
- **Performance Analytics** — Engagement charts

## 🤖 Manual Trigger

Click **"Run Now"** on the dashboard to trigger the full pipeline manually at any time.

Or run from terminal:
```bash
node backend/agents/pipelineRunner.js
```

## 📁 Project Structure

```
Instagram/
├── backend/
│   ├── server.js              # Express + WebSocket server
│   ├── scheduler.js           # Cron job orchestrator
│   ├── agents/
│   │   ├── researchAgent.js   # Gemini AI news research
│   │   ├── filterAgent.js     # Top-5 scoring & selection
│   │   ├── contentAgent.js    # Caption & slide generation
│   │   └── pipelineRunner.js  # Full pipeline orchestrator
│   ├── services/
│   │   ├── carouselRenderer.js  # 1080×1080 PNG generation
│   │   ├── instagramPublisher.js # Instagram Graph API
│   │   └── analyticsService.js  # Metrics tracking
│   └── data/                  # Generated posts & images
├── frontend/
│   ├── index.html             # Dashboard UI
│   ├── styles.css             # Premium futuristic design
│   └── app.js                 # Dashboard JavaScript
└── .env                       # API credentials
```

## 🎨 Carousel Design

Each post contains 5 premium 1080×1080px slides:
- **Slide 1** — Hook headline with breaking news label
- **Slide 2** — Clear explanation with bullet points
- **Slide 3** — Why it matters + real-world impact
- **Slide 4** — How YOU can use it + use cases
- **Slide 5** — Summary + engagement CTA

Built with Node.js Canvas — no external design tools needed.
