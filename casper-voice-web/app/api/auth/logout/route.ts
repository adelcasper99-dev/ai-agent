import { NextRequest, NextResponse } from 'next/server';
import { extractSessionDetails } from '@/lib/session';
import { revokeSession } from '@/lib/session-store';

export async function POST(req: NextRequest) {
  const cookieNames = ['admin_session', 'tenant_session', 'customer_session'];

  // Perform server-side blacklist revocation for all active session cookies
  for (const name of cookieNames) {
    const cookieVal = req.cookies.get(name)?.value;
    if (cookieVal) {
      try {
        const details = await extractSessionDetails(cookieVal);
        if (details && details.jti) {
          await revokeSession(details.jti, details.expiresAt);
        }
      } catch (err) {
        console.error(`[LOGOUT] Failed to revoke session for cookie ${name}:`, err);
      }
    }
  }

  const response = NextResponse.json({ success: true, message: 'Logged out and sessions revoked.' });

  // Clear all session cookies
  for (const name of cookieNames) {
    response.cookies.delete(name);
  }

  return response;
}
