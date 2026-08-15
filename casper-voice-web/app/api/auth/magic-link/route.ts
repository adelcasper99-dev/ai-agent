import { NextRequest, NextResponse } from "next/server";
import { verifyMagicLink, signCustomerSession } from "@/lib/session";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const token = searchParams.get("token");

    if (!token) {
      return NextResponse.redirect(new URL("/login?error=missing_token", request.url));
    }

    const customerId = await verifyMagicLink(token);
    if (!customerId) {
      return NextResponse.redirect(new URL("/login?error=link_expired", request.url));
    }

    // Sign session cookie
    const sessionToken = await signCustomerSession(customerId);

    const response = NextResponse.redirect(new URL("/customer/dashboard", request.url));
    response.cookies.set("customer_session", sessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 30, // 30 days
      path: "/",
    });

    return response;
  } catch (err: any) {
    console.error("[Magic Link Error]", err);
    return NextResponse.redirect(new URL("/login?error=auth_failed", request.url));
  }
}
