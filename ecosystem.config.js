const fs = require('fs');
const path = require('path');

const venvPythonBin = path.join(__dirname, 'voice_service', 'venv', 'bin', 'python');
const venvPythonExe = path.join(__dirname, 'voice_service', 'venv', 'Scripts', 'python.exe');
let pythonInterpreter = 'python3';

if (fs.existsSync(venvPythonBin)) {
  pythonInterpreter = venvPythonBin;
} else if (fs.existsSync(venvPythonExe)) {
  pythonInterpreter = venvPythonExe;
}

if (fs.existsSync(path.join(__dirname, '.env.production'))) {
  require('dotenv').config({ path: path.join(__dirname, '.env.production') });
} else if (fs.existsSync(path.join(__dirname, '.env'))) {
  require('dotenv').config({ path: path.join(__dirname, '.env') });
}
if (fs.existsSync(path.join(__dirname, 'casper-voice-web', '.env'))) {
  require('dotenv').config({ path: path.join(__dirname, 'casper-voice-web', '.env') });
}

module.exports = {
  apps: [
    {
      name: 'casper-voice-web',
      script: 'node_modules/next/dist/bin/next',
      args: 'start -p 3006',
      cwd: './casper-voice-web',
      env: {
        NODE_ENV: 'production',
        PORT: 3006,
        ADMIN_PASSWORD: process.env.ADMIN_PASSWORD,
        PILOT_TENANT_ID: process.env.PILOT_TENANT_ID,
        JWT_SECRET: process.env.JWT_SECRET,
        TELEGRAM_BOT_TOKEN: process.env.TELEGRAM_BOT_TOKEN,
        ADMIN_CHAT_ID: process.env.ADMIN_CHAT_ID,
        TELEGRAM_WEBHOOK_SECRET: process.env.TELEGRAM_WEBHOOK_SECRET,
        INTERNAL_API_KEY: process.env.INTERNAL_API_KEY,
        INTERNAL_SERVICE_SECRET: process.env.INTERNAL_SERVICE_SECRET,
        DATABASE_URL: process.env.DATABASE_URL,
        OPENAI_API_KEY: process.env.OPENAI_API_KEY,
        GEMINI_API_KEY: process.env.GEMINI_API_KEY,
        GROQ_API_KEY: process.env.GROQ_API_KEY,
        DEEPGRAM_API_KEY: process.env.DEEPGRAM_API_KEY,
        FISH_API_KEY: process.env.FISH_API_KEY,
        FISH_VOICE_ID: process.env.FISH_VOICE_ID,
      },
    },
    {
      name: 'casper-livekit-worker',
      script: 'voice_service/agent.py',
      args: 'start',
      interpreter: pythonInterpreter,
      cwd: './',
      max_restarts: 10,
      restart_delay: 3000,
      min_uptime: '10s',
      env: {
        NODE_ENV: 'production',
        LIVEKIT_URL: process.env.LIVEKIT_URL,
        LIVEKIT_API_KEY: process.env.LIVEKIT_API_KEY,
        LIVEKIT_API_SECRET: process.env.LIVEKIT_API_SECRET,
        INTERNAL_SERVICE_SECRET: process.env.INTERNAL_SERVICE_SECRET,
        ELEVENLABS_API_KEY: process.env.ELEVENLABS_API_KEY,
        OPENROUTER_API_KEY: process.env.OPENROUTER_API_KEY,
        GEMINI_API_KEY: process.env.GEMINI_API_KEY,
      },
    },
    {
      name: 'casper-subscription-cron',
      script: 'node_modules/tsx/dist/cli.mjs',
      args: 'scripts/cron-subscription-expiry.ts',
      cwd: './casper-voice-web',
      cron_restart: '0 * * * *', // Run every hour
      autorestart: false,
      env: {
        NODE_ENV: 'production',
        DATABASE_URL: process.env.DATABASE_URL,
        INTERNAL_SERVICE_SECRET: process.env.INTERNAL_SERVICE_SECRET,
        TELEGRAM_BOT_TOKEN: process.env.TELEGRAM_BOT_TOKEN,
      },
    },
  ],
};
