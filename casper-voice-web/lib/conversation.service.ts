import { getValidApiKey, markKeyExhausted } from "./apiKeyManager";

export class TranscriptionFailedError extends Error {
  constructor(message?: string) {
    super(message || "Transcription failed across all providers");
    this.name = "TranscriptionFailedError";
  }
}

/**
 * Transcribes a voice note using Gemini 3.1 Flash Lite with API Key rotation and Deepgram fallback.
 */
export async function transcribeVoiceNote(audioBuffer: Buffer, tenantId?: string): Promise<string> {
  const maxRetries = 3;
  let lastError: any = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    let geminiKey: string;
    try {
      geminiKey = await getValidApiKey("gemini");
    } catch {
      break; // No more Gemini keys available — fall back to Deepgram
    }

    if (!geminiKey) {
      break;
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000); // 15s timeout

    try {
      const base64Audio = audioBuffer.toString('base64');
      const model = process.env.GEMINI_MODEL || "gemini-3.1-flash-lite";
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${geminiKey}`;

      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  text: "أنت متخصص في تفريغ الصوت باللغة العربية بما فيها العامية المصرية. فرّغ هذا الصوت بدقة. اكتب النص المُفرَّغ فقط بدون أي تعليق إضافي."
                },
                {
                  inlineData: {
                    mimeType: "audio/ogg",
                    data: base64Audio
                  }
                }
              ]
            }
          ]
        }),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (response.status === 429) {
        console.warn(`[STT Retry] Gemini 429 Rate Limit hit on key. Marking exhausted (Attempt ${attempt}/${maxRetries}).`);
        await markKeyExhausted(geminiKey, "gemini");
        continue; // Try next key
      }

      if (!response.ok) {
        throw new Error(`Gemini API error: ${response.statusText}`);
      }

      const data = await response.json();
      const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
      
      if (!text) {
        throw new Error("Empty transcript returned from Gemini");
      }

      return text.trim();
    } catch (error: any) {
      lastError = error;
      console.error(`Gemini STT attempt ${attempt} failed:`, error?.message || error);
      if (error?.name === "AbortError") {
        continue; // Timeout occurred, attempt with next key
      }
    } finally {
      clearTimeout(timeoutId);
    }
  }

  console.warn("All Gemini STT attempts exhausted. Falling back to Deepgram.");
  return await deepgramSTT(audioBuffer);
}

async function deepgramSTT(audioBuffer: Buffer): Promise<string> {
  const deepgramKey = process.env.DEEPGRAM_API_KEY;
  if (!deepgramKey) {
    throw new TranscriptionFailedError("Deepgram API key not configured");
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15000);

  try {
    const response = await fetch("https://api.deepgram.com/v1/listen?model=nova-2&smart_format=true&language=ar", {
      method: "POST",
      headers: {
        "Authorization": `Token ${deepgramKey}`,
        "Content-Type": "audio/ogg" // Defaulting to ogg for Telegram voice notes
      },
      body: new Blob([new Uint8Array(audioBuffer)], { type: 'audio/ogg' }),
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new TranscriptionFailedError(`Deepgram API error: ${response.statusText}`);
    }

    const data = await response.json();
    const text = data?.results?.channels?.[0]?.alternatives?.[0]?.transcript;

    if (!text) {
      throw new TranscriptionFailedError("Empty transcript returned from Deepgram");
    }

    return text.trim();
  } catch (error) {
    console.error("Deepgram fallback transcription failed:", error);
    throw new TranscriptionFailedError();
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Processes an image using Gemini 3.1 Flash Lite Vision to extract data with API Key rotation.
 */
export async function processImage(imageBuffer: Buffer, mimeType: string, prompt: string): Promise<string> {
  const allowedMimeTypes = ["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"];
  if (!allowedMimeTypes.includes(mimeType)) {
    throw new Error(`Unsupported image MIME type: ${mimeType}`);
  }

  const maxRetries = 3;
  let lastError: any = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    let geminiKey: string;
    try {
      geminiKey = await getValidApiKey("gemini");
    } catch {
      break;
    }

    if (!geminiKey) {
      break;
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);

    try {
      const base64Image = imageBuffer.toString('base64');
      const model = process.env.GEMINI_MODEL || "gemini-3.1-flash-lite";
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${geminiKey}`;

      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                { text: prompt },
                {
                  inlineData: {
                    mimeType,
                    data: base64Image
                  }
                }
              ]
            }
          ],
          generationConfig: {
            responseMimeType: "application/json",
          }
        }),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (response.status === 429) {
        console.warn(`[Vision Retry] Gemini 429 Rate Limit hit on key. Marking exhausted (Attempt ${attempt}/${maxRetries}).`);
        await markKeyExhausted(geminiKey, "gemini");
        continue; // Try next key
      }

      if (!response.ok) {
        throw new Error(`Gemini Vision API error: ${response.statusText}`);
      }

      const data = await response.json();
      const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
      
      if (!text) {
        throw new Error("Empty response from Gemini Vision");
      }

      return text;
    } catch (error: any) {
      lastError = error;
      console.error(`Gemini Vision processing attempt ${attempt} failed:`, error?.message || error);
      if (error?.name === "AbortError") {
        continue;
      }
    } finally {
      clearTimeout(timeoutId);
    }
  }

  throw lastError || new Error("No valid Gemini API key available for vision processing after retries.");
}
