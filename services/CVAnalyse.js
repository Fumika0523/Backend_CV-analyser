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

Extract:
1. Professional skills, technical skills, tools, frameworks, and soft skills
2. Education history
3. Qualifications / certificates

Return JSON only.

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
    education: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
    },
    qualifications: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
    },
  },
  required: ["skillsDetected", "education", "qualifications"],
},
    },
  });

  const result = JSON.parse(response.text);

  return {
  rawText: resumeText,
  skillsDetected: result.skillsDetected || [],
  education: result.education || [],
  qualifications: result.qualifications || [],
};
};

module.exports = CVAnalyse;