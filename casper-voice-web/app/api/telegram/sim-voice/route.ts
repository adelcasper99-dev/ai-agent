import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import { spawn } from "child_process";
import fs from "fs";
import path from "path";
import { correctTranscriptWithLLM } from "@/lib/llm_correction";
import { buildWhisperPrompt } from "@/lib/whisper_prompt";


export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const audioFile = formData.get("audio") as File | null;

    if (!audioFile) {
      return NextResponse.json({ error: "لم يتم استلام أي ملف صوتي" }, { status: 400 });
    }

    // Load settings from DB
    const dbSettings = await prisma.setting.findMany();
    const settingsMap: Record<string, string> = {};
    for (const row of dbSettings) settingsMap[row.key] = row.value;

    const groqKey = settingsMap["GROQ_API_KEY"] || process.env.GROQ_API_KEY || "";
    const geminiKey = settingsMap["GEMINI_API_KEY"] || process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || "";
    const openaiKey = settingsMap["OPENAI_API_KEY"] || process.env.OPENAI_API_KEY || "";
    const voiceTone = settingsMap["VOICE_TONE"] || "shakir";

    // 1. Save uploaded audio to temp directory
    const tmpDir = path.join(process.cwd(), "tmp");
    if (!fs.existsSync(tmpDir)) {
      fs.mkdirSync(tmpDir, { recursive: true });
    }

    const arrayBuffer = await audioFile.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const inputAudioPath = path.join(tmpDir, `input_${Date.now()}.webm`);
    fs.writeFileSync(inputAudioPath, buffer);

    // 2. Perform STT via Groq Whisper API
    let userTranscript = "";
    if (groqKey) {
      try {
        const groqFormData = new FormData();
        const blob = new Blob([buffer], { type: audioFile.type || "audio/webm" });
        groqFormData.append("file", blob, "audio.webm");
        groqFormData.append("model", "whisper-large-v3-turbo");
        groqFormData.append("language", "ar");
        const dynamicPrompt = await buildWhisperPrompt(null);
        groqFormData.append("prompt", dynamicPrompt);

        const sttRes = await fetch("https://api.groq.com/openai/v1/audio/transcriptions", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${groqKey}`,
          },
          body: groqFormData,
        });

        if (sttRes.ok) {
          const sttData = await sttRes.json() as { text?: string };
          const rawText = sttData.text?.trim() || "";
          if (rawText) {
            console.log(`\n[Sim Voice STT] Raw STT: "${rawText}"`);
            userTranscript = await correctTranscriptWithLLM(rawText);
            console.log(`[Sim Voice STT] Corrected STT: "${userTranscript}"\n`);
          }
        }
      } catch (e) {
        console.error("STT Error:", e);
      }
    }

    // Clean up input file
    fs.unlink(inputAudioPath, () => {});

    if (!userTranscript) {
      userTranscript = "سجل مصروف بنزين 50 جنيه"; // Fallback demo transcript if STT failed
    }

    // 3. Generate LLM Reply
    const SYSTEM_PROMPT = `أنت "المساعد الشخصي الذكي" الخاص بمدير أو صاحب العمل بنظام Casper ERP & POS.
تحدث بالعامية المصرية الحية كأنك صديق أو مساعد شخصي بيكلمه في التليفون.
- ممنوع: جمل رسمية مثل "تم تسجيل" أو "بنجاح" أو "يرجى"
- المطلوب: "خلاص يا باشا"، "سجلتلك"، "زي الفل يا هندسة"، "تحت أمرك"
الإجابات مختصرة ومباشرة (8-15 كلمة فقط).`;

    let replyText = "";
    if (geminiKey) {
      try {
        const { GoogleGenerativeAI } = await import("@google/generative-ai");
        const genai = new GoogleGenerativeAI(geminiKey);
        const model = genai.getGenerativeModel({ model: "gemini-3.1-flash-lite" });
        const result = await model.generateContent(`${SYSTEM_PROMPT}\n\nرسالة العميل الصوتية: ${userTranscript}`);
        replyText = result.response.text().trim();
      } catch (e) {
        console.error("Gemini Error:", e);
      }
    }

    if (!replyText && groqKey) {
      const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${groqKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "llama-3.3-70b-versatile",
          messages: [
            { role: "system", content: SYSTEM_PROMPT },
            { role: "user", content: userTranscript },
          ],
          max_tokens: 200,
        }),
      });
      if (res.ok) {
        const data = await res.json() as { choices: Array<{ message: { content: string } }> };
        replyText = data.choices[0]?.message?.content?.trim() || "";
      }
    }

    if (!replyText) {
      replyText = `تمام يا باشا، استلمت كلامك: "${userTranscript}" وسجلت العملية زي الفل!`;
    }

    // 4. Generate Voice Note Response Audio via Python script (gen_demo.py)
    const replyAudioFilename = `reply_${Date.now()}.mp3`;
    const replyAudioPath = path.join(tmpDir, replyAudioFilename);
    const safeVoice = voiceTone === "salma" ? "ar-EG-SalmaNeural" : "ar-EG-ShakirNeural";
    const scriptPath = path.resolve(process.cwd(), "..", "voice_service", "gen_demo.py");

    await new Promise<void>((resolve) => {
      const proc = spawn("python", [scriptPath], {
        env: { ...process.env, PYTHONIOENCODING: "utf-8" },
      });

      proc.on("close", () => resolve());

      const payload = JSON.stringify({
        text: replyText,
        voice: safeVoice,
        out_path: replyAudioPath,
        provider: settingsMap["VOICE_PROVIDER"] || "gemini",
        gemini_key: geminiKey,
      });
      proc.stdin.write(payload, "utf-8");
      proc.stdin.end();
    });

    let audioBase64 = "";
    if (fs.existsSync(replyAudioPath)) {
      const audioBuf = fs.readFileSync(replyAudioPath);
      audioBase64 = `data:audio/mp3;base64,${audioBuf.toString("base64")}`;
      fs.unlink(replyAudioPath, () => {});
    }

    // Log conversation
    await prisma.conversation.create({
      data: {
        channel: "telegram_sim",
        transcript: `User Voice: ${userTranscript}\nAssistant: ${replyText}`,
        summary: replyText.slice(0, 100),
      },
    }).catch(() => {});

    return NextResponse.json({
      userTranscript,
      replyText,
      audioUrl: audioBase64,
    });
  } catch (error) {
    console.error("Telegram Sim Voice Error:", error);
    return NextResponse.json({ error: "فشل معالجة الرسالة الصوتية" }, { status: 500 });
  }
}
