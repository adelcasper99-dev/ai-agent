import { NextRequest, NextResponse } from 'next/server';

// المسارات اللي لازم تفضل مفتوحة من غير login (تليجرام لازم يوصلها من برا)
const PUBLIC_PATHS = ['/login', '/api/auth/login', '/api/telegram/webhook'];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // سيب المسارات العامة تعدي من غير فحص
  if (PUBLIC_PATHS.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  const session = request.cookies.get('admin_session');

  if (!session || session.value !== 'valid') {
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
