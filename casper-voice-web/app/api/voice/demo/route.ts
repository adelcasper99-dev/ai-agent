import { prisma } from "@/lib/prisma";
import { NextResponse } from 'next/server';
import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';


export async function POST(req: Request) {
  try {
    const { text, voice = 'salma' } = await req.json();
    const demoText = text || 'خلاص يا باشا، سجلتلك 50 جنيه بنزين في المصاريف وزي الفل!';

    // Load saved settings from database
    const settingsMap: Record<string, string> = {};
    try {
      const dbSettings = await prisma.setting.findMany();
      for (const row of dbSettings) settingsMap[row.key] = row.value;
    } catch (e) {
      console.warn("Prisma findMany warning in demo route:", e);
    }

    const geminiApiKey = settingsMap['GEMINI_API_KEY'] || process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || '';
    const fishApiKey = settingsMap['FISH_API_KEY'] || process.env.FISH_API_KEY || '';
    const fishVoiceId = settingsMap['FISH_VOICE_ID'] || process.env.FISH_VOICE_ID || '';
    const voiceProvider = settingsMap['VOICE_PROVIDER'] || 'openai';
    const voiceTone = settingsMap['VOICE_TONE'] || voice;

    const tmpDir = path.join(process.cwd(), 'tmp');
    if (!fs.existsSync(tmpDir)) {
      fs.mkdirSync(tmpDir, { recursive: true });
    }
    const filename = `demo_${Date.now()}.mp3`;
    const filePath = path.join(tmpDir, filename);

    const safeVoice = voiceTone === 'shakir' ? 'ar-EG-ShakirNeural' : 'ar-EG-SalmaNeural';
    const scriptPath = path.resolve(process.cwd(), '..', 'voice_service', 'gen_demo.py');

    await new Promise<void>((resolve, reject) => {
      const proc = spawn('python', [scriptPath], {
        env: { ...process.env, PYTHONIOENCODING: 'utf-8' },
      });

      let stderr = '';
      proc.stderr.on('data', (d) => { stderr += d.toString(); });

      proc.on('close', (code) => {
        if (code === 0 && fs.existsSync(filePath)) {
          resolve();
        } else {
          reject(new Error(stderr || `Python exit code ${code}`));
        }
      });

      const payload = JSON.stringify({
        text: demoText,
        voice: safeVoice,
        out_path: filePath,
        provider: voiceProvider,
        gemini_key: geminiApiKey,
        fish_key: fishApiKey,
        fish_voice_id: fishVoiceId,
      });
      proc.stdin.write(payload, 'utf-8');
      proc.stdin.end();
    });

    const audioBuffer = fs.readFileSync(filePath);
    fs.unlink(filePath, () => {});

    return new Response(audioBuffer, {
      headers: {
        'Content-Type': 'audio/mpeg',
        'Content-Length': audioBuffer.length.toString(),
      },
    });
  } catch (error: unknown) {
    console.error('Error generating audio demo:', error);
    return NextResponse.json({ error: 'فشل توليد العينة الصوتية' }, { status: 500 });
  }
}
