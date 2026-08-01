import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import fs from 'fs';
import path from 'path';

async function requireAdmin() {
  const cookieStore = await cookies();
  if (cookieStore.get('admin_session')?.value !== 'valid') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  return null;
}

let lastClearedTime = 0;

export async function GET() {
  const authError = await requireAdmin();
  if (authError) return authError;

  try {
    const logPath = path.join(process.cwd(), '..', 'voice_service', 'agent_log.txt');
    if (!fs.existsSync(logPath)) {
      return NextResponse.json({ logs: ["لا تزال السجلات فارغة..."] });
    }

    try {
      const stat = fs.statSync(logPath);
      if (lastClearedTime > 0 && stat.mtimeMs <= lastClearedTime) {
        return NextResponse.json({ logs: ["تم مسح وتصفير السجلات... في انتظار سجلات جديدة 📡"] });
      }
    } catch (e) {}

    const content = fs.readFileSync(logPath, 'utf-8');
    let lines = content.split('\n');

    if (lastClearedTime > 0) {
      lines = lines.slice(-30);
    } else {
      lines = lines.slice(-150);
    }

    return NextResponse.json({ logs: lines });
  } catch (err: any) {
    return NextResponse.json({ logs: [`خطأ في قراءة السجلات: ${err.message}`] }, { status: 500 });
  }
}

export async function DELETE() {
  const authError = await requireAdmin();
  if (authError) return authError;

  try {
    const logPath = path.join(process.cwd(), '..', 'voice_service', 'agent_log.txt');
    lastClearedTime = Date.now();
    try {
      fs.writeFileSync(logPath, '', 'utf-8');
    } catch (e) {
      console.warn("Could not wipe locked log file on disk (locked by Tee-Object), memory clear filter active.");
    }
    return NextResponse.json({ success: true, message: 'تم مسح السجلات بنجاح' });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
