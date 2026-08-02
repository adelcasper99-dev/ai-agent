import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const { keyString } = await req.json();
    if (!keyString) {
      return NextResponse.json({ success: false, error: "Missing keyString" });
    }

    // Call the Gemini API directly to check status
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${keyString}`;
    
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: "hi" }] }]
      }),
    });

    const data = await response.json();

    if (response.ok) {
      return NextResponse.json({ success: true, status: "VALID", message: "المفتاح صالح ويعمل بنجاح" });
    } else {
      // Check for 429 quota exceeded
      if (response.status === 429) {
        return NextResponse.json({ success: false, status: "EXHAUSTED", message: "الرصيد المجاني مستنفد (429 Too Many Requests)" });
      }
      
      return NextResponse.json({ 
        success: false, 
        status: "INVALID", 
        message: data?.error?.message || "مفتاح غير صالح أو خطأ مجهول" 
      });
    }

  } catch (error: any) {
    return NextResponse.json({ success: false, status: "ERROR", message: error.message });
  }
}
