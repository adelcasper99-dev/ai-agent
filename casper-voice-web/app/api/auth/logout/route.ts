import { NextResponse } from 'next/server';

export async function POST() {
  const response = NextResponse.json({ success: true });
  
  // Clear both cookies to ensure complete local session revocation
  response.cookies.delete('admin_session');
  response.cookies.delete('tenant_session');
  
  return response;
}
