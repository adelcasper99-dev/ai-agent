const { GoogleGenerativeAI } = require('@google/generative-ai');

async function main() {
  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  const model = genAI.getGenerativeModel({
    model: "gemini-1.5-flash",
    tools: [{
      functionDeclarations: [{
        name: "test_func",
        description: "test",
        parameters: { type: "OBJECT", properties: {} }
      }]
    }]
  });
  
  const chat = model.startChat();
  let result = await chat.sendMessage("test_func");
  console.log("Model response:", result.response.text(), result.response.functionCalls());
  
  const calls = result.response.functionCalls();
  if (calls && calls.length > 0) {
    const call = calls[0];
    result = await chat.sendMessage([{
      functionResponse: {
        name: call.name,
        response: { result: "success" }
      }
    }]);
    console.log("Followup response:", result.response.text());
  }
}

main().catch(console.error);
