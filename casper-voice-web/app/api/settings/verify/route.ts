import { NextResponse } from 'next/server';
import { RoomServiceClient } from 'livekit-server-sdk';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { provider, key, secret, url } = body;

    if (provider === 'OPENAI') {
      if (!key) return NextResponse.json({ valid: false, message: 'المفتاح فارغ' });
      const res = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${key}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [{ role: 'user', content: 'hi' }],
          max_tokens: 1
        })
      });

      if (res.status === 200) return NextResponse.json({ valid: true, message: 'مفتاح صحيح ومتاح به رصيد ✅' });
      const data = await res.json().catch(() => ({}));
      if (res.status === 429 || data?.error?.code === 'insufficient_quota') {
        return NextResponse.json({ valid: false, message: 'انتهت الباقة أو الرصيد (Quota Exceeded) ❌' });
      }
      if (res.status === 401 || data?.error?.code === 'invalid_api_key') {
        return NextResponse.json({ valid: false, message: 'مفتاح غير صحيح ❌' });
      }
      return NextResponse.json({ valid: false, message: data?.error?.message || 'فشل الفحص ❌' });
    }

    if (provider === 'GEMINI') {
      if (!key) return NextResponse.json({ valid: false, message: 'المفتاح فارغ' });
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${key}`);
      if (res.status === 200) return NextResponse.json({ valid: true, message: 'مفتاح صحيح وشغال ✅' });
      return NextResponse.json({ valid: false, message: 'مفتاح غير صحيح ❌' });
    }

    if (provider === 'GROQ') {
      if (!key) return NextResponse.json({ valid: false, message: 'المفتاح فارغ' });
      const res = await fetch('https://api.groq.com/openai/v1/models', {
        headers: { Authorization: `Bearer ${key}` }
      });
      if (res.status === 200) return NextResponse.json({ valid: true, message: 'مفتاح Groq صحيح ومتاح ✅' });
      return NextResponse.json({ valid: false, message: 'مفتاح Groq غير صحيح ❌' });
    }

    if (provider === 'DEEPGRAM') {
      if (!key) return NextResponse.json({ valid: false, message: 'المفتاح فارغ' });
      const res = await fetch('https://api.deepgram.com/v1/projects', {
        headers: { Authorization: `Token ${key}` }
      });
      if (res.status === 200) return NextResponse.json({ valid: true, message: 'مفتاح Deepgram صحيح ومتاح ✅' });
      return NextResponse.json({ valid: false, message: 'مفتاح Deepgram غير صحيح ❌' });
    }

    if (provider === 'FISH') {
      if (!key) return NextResponse.json({ valid: false, message: 'المفتاح فارغ' });
      try {
        const res = await fetch('https://api.fish.audio/wallet/self/package', {
          headers: { Authorization: `Bearer ${key}` }
        });
        if (res.status === 200) return NextResponse.json({ valid: true, message: 'مفتاح Fish Audio صحيح ومتاح ✅' });
        return NextResponse.json({ valid: false, message: 'مفتاح Fish Audio غير صحيح ❌' });
      } catch (e) {
        return NextResponse.json({ valid: false, message: 'فشل الفحص والاتصال بـ Fish Audio ❌' });
      }
    }

    if (provider === 'TELEGRAM') {
      if (!key) return NextResponse.json({ valid: false, message: 'توكن بوت التليجرام فارغ' });
      try {
        const res = await fetch(`https://api.telegram.org/bot${key}/getMe`);
        const data = await res.json();
        if (data.ok) {
          return NextResponse.json({ valid: true, message: `البوت متصل بنجاح: @${data.result.username} ✅` });
        }
        return NextResponse.json({ valid: false, message: 'توكن التليجرام غير صحيح ❌' });
      } catch (e) {
        return NextResponse.json({ valid: false, message: 'فشل الاتصال بسيرفر التليجرام ❌' });
      }
    }

    if (provider === 'LIVEKIT') {
      if (!key || !secret || !url) return NextResponse.json({ valid: false, message: 'أكمل جميع حقول LiveKit أولاً' });
      try {
        const client = new RoomServiceClient(url, key, secret);
        await client.listRooms();
        return NextResponse.json({ valid: true, message: 'تم الاتصال بنجاح ✅' });
      } catch (e: any) {
        if (e.message?.includes('invalid API key')) {
          return NextResponse.json({ valid: false, message: 'مفتاح API غير صحيح ❌' });
        }
        return NextResponse.json({ valid: false, message: 'فشل الاتصال: تأكد من صحة الرابط والمفاتيح ❌' });
      }
    }

    return NextResponse.json({ valid: false, message: 'مزود غير معروف' });
  } catch (err: any) {
    return NextResponse.json({ valid: false, message: 'حدث خطأ أثناء الفحص' }, { status: 500 });
  }
}
