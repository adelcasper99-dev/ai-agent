const fs = require('fs');
const { GoogleGenerativeAI } = require('@google/generative-ai');

async function test() {
  const envFile = fs.readFileSync('.env', 'utf8');
  const keyLine = envFile.split('\n').find(l => l.startsWith('GEMINI_API_KEY='));
  const key = keyLine.split('=')[1].replace(/["']/g, '').trim();

  const genAI = new GoogleGenerativeAI(key);
  const model = genAI.getGenerativeModel({ model: 'gemini-3.6-flash' });

  try {
    const r = await model.generateContent('Hi');
    console.log(r.response.text());
  } catch (err) {
    console.error(err);
  }
}
test();
