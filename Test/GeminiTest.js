require("dotenv").config({ path: "../../.env" });

const { GoogleGenAI } = require("@google/genai");

console.log("GEMINI_API_KEY loaded?", !!process.env.GEMINI_API_KEY);

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
});

async function testGemini() {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.0-flash-lite",
      contents: "Why is the sky blue?",
    });

    console.log(response.text);
  } catch (error) {
    console.error("Gemini error:", error);
  }
}

testGemini();