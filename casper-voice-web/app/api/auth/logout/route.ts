import { NextResponse } from 'next/server';

export async function POST() {
  const response = NextResponse.json({ success: true });
  
  // Clear all cookies to ensure complete local session revocation
  response.cookies.delete('admin_session');
  response.cookies.delete('tenant_session');
  response.cookies.delete('customer_session');
  
  return response;
}
