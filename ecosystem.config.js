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
        TELEGRAM_BOT_TOKEN: process.env.TELEGRAM_BOT_TOKEN,
        ADMIN_CHAT_ID: process.env.ADMIN_CHAT_ID,
        TELEGRAM_WEBHOOK_SECRET: process.env.TELEGRAM_WEBHOOK_SECRET,
        JWT_SECRET: process.env.JWT_SECRET,
        INTERNAL_API_KEY: process.env.INTERNAL_API_KEY,
      },
    },
    {
      name: 'casper-livekit-worker',
      script: 'voice_service/agent.py',
      args: 'start',
      interpreter: pythonInterpreter,
      cwd: './',
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
  ],
};
