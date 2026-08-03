import { correctTranscriptWithLLM } from "../casper-voice-web/lib/llm_correction";

async function runTest() {
  console.log("==================================================");
  console.log("Isolated LLM Correction Test (Phase 4)");
  console.log("==================================================");

  const testCases = [
    {
      desc: "Egyptian slang with misspellings",
      input: "اتنين كرتونه مسمار ب خمسين جني",
    },
    {
      desc: "Merged words",
      input: "عملاحمد عاوز تلاتهزيت متور",
    },
    {
      desc: "Correct text (should remain mostly unchanged)",
      input: "سجل مبيعات 2 كرتونة مسامير بسعر 50 جنيه لعميل اسمه محمد",
    }
  ];

  for (const tc of testCases) {
    console.log(`\n[Test Case] ${tc.desc}`);
    console.log(`Raw STT Input : "${tc.input}"`);
    
    const startTime = Date.now();
    const corrected = await correctTranscriptWithLLM(tc.input);
    const latency = Date.now() - startTime;

    console.log(`LLM Corrected : "${corrected}"`);
    console.log(`Latency       : ${latency}ms`);
  }
}

runTest().catch(console.error);
