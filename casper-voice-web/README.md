# Casper Voice & ERP — AI Support & Management System

Enterprise-grade AI Voice Agent & ERP Dashboard built with Next.js 16 (App Router), React 19, LiveKit WebRTC, and Python Voice Service.

## 🚀 System Architecture

- **`casper-voice-web`**: Next.js 16 App Router interface for Tenant Management, Sales & Expenses Analytics, Knowledge Base RAG, and LiveKit Admin Control.
- **`voice_service`**: Python-based real-time LiveKit Agent handling voice streams (OpenAI / Gemini / Fish Audio TTS / Silero VAD).
- **Dual-Core Database**: SQLite (Local / Dev) & PostgreSQL (Cloud) with Prisma ORM.

## 🛠️ Environment Setup

1. Copy `.env.example` to `.env`:
   ```bash
   cp .env.example .env
   ```
2. Fill in required API keys (`GEMINI_API_KEY`, `LIVEKIT_API_KEY`, `JWT_SECRET`, `INTERNAL_SERVICE_SECRET`).

## 🧪 Development & Testing

Run unit tests with Vitest:
```bash
npm test
```

Start development server:
```bash
npm run dev
```

Build for production:
```bash
npx prisma generate
npx prisma migrate deploy
npm run build
npm run start
```

## 🛰️ Deployment

Deploy to production VPS via automated pipeline:
```bash
python scripts/rebuild_vps_dashboard.py
```
