require("dotenv").config();

const fs = require("fs");
const pdfParse = require("pdf-parse-new");
const { GoogleGenAI, Type } = require("@google/genai");

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
});

const CVAnalyse = async (filePath) => {
  const dataBuffer = fs.readFileSync(filePath);

  const pdfData = await pdfParse(dataBuffer);

  const resumeText = pdfData.text;

  const prompt = `
Analyze the following resume text.
Extract all professional skills, technical proficiencies, tools, frameworks, and soft skills.
Return them as a clean list.

Resume Text:
${resumeText}
`;

  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          skillsDetected: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
          },
        },
        required: ["skillsDetected"],
      },
    },
  });

  const result = JSON.parse(response.text);

  return {
    rawText: resumeText,
    skillsDetected: result.skillsDetected || [],
  };
};

module.exports = CVAnalyse;