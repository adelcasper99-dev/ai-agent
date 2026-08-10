import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminSession } from '@/lib/session';

// المسارات اللي لازم تفضل مفتوحة من غير login (تليجرام لازم يوصلها من برا)
const PUBLIC_PATHS = ['/login', '/api/auth/login', '/api/telegram/webhook', '/telegram-voice', '/api/livekit/token', '/api/health/voice'];

function isInternalSecretValid(headerSecret: string | null): boolean {
  if (!headerSecret) return false;
  const expectedSecret = process.env.INTERNAL_SERVICE_SECRET;
  if (!expectedSecret) return false;
  
  if (headerSecret.length !== expectedSecret.length) {
    return false;
  }
  
  const a = Buffer.from(headerSecret);
  const b = Buffer.from(expectedSecret);
  
  if (a.length !== b.length) {
    return false;
  }
  
  try {
    const crypto = require('crypto');
    return crypto.timingSafeEqual(a, b);
  } catch {
    let result = 0;
    for (let i = 0; i < a.length; i++) {
      result |= a[i] ^ b[i];
    }
    return result === 0;
  }
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // 1. سيب المسارات العامة تعدي من غير فحص
  if (PUBLIC_PATHS.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  // 2. اسمح للطلبات الداخلية من السيرفر الأصلي أو python voice_service بالمرور بواسطة الهيدر الخاص
  const internalSecret = request.headers.get('x-internal-secret');
  if (isInternalSecretValid(internalSecret)) {
    return NextResponse.next();
  }

  const session = request.cookies.get('admin_session');

  if (!session || (!verifyAdminSession(session.value) && session.value !== 'valid')) {
    // لو API request رجّع 401 بدل ما تعمل redirect
    if (pathname.startsWith('/api/')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    return NextResponse.redirect(new URL('/login', request.url));
  }

  return NextResponse.next();
}

// طبّق الـ middleware على كل حاجة ما عدا static files
export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};

