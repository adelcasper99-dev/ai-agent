const { GoogleGenerativeAI } = require('@google/generative-ai');
const fs = require('fs');

async function main() {
  const env = fs.readFileSync('.env', 'utf8');
  const apiKey = env.split('\n').find(l=>l.startsWith('GEMINI_API_KEY')).split('=')[1].trim().replace(/['\"]+/g, '');
  const genAI = new GoogleGenerativeAI(apiKey);
  
  const modelsToTest = ["gemini-2.0-flash", "gemini-3.5-flash", "gemini-3.6-flash", "gemini-flash-latest"];
  
  for (const modelName of modelsToTest) {
      console.log(`\n--- Testing ${modelName} ---`);
      try {
          const model = genAI.getGenerativeModel({
            model: modelName,
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
          } else {
             console.log("No function calls returned.");
          }
      } catch (e) {
          console.log(`Error with ${modelName}:`, e.message);
      }
  }
}

main().catch(console.error);
