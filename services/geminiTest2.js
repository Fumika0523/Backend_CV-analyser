require("dotenv").config();
 
// Fixes "AggregateError: All promises were rejected, code: UNKNOWN" on some

// networks/VPNs where Node's dual-stack (IPv4+IPv6) DNS resolution fails.

require("dns").setDefaultResultOrder("ipv4first");
 
const fs = require("fs");

const pdfParse = require("pdf-parse-new");

const { GoogleGenAI, Type } = require("@google/genai");
 
const ai = new GoogleGenAI({

  apiKey: process.env.GEMINI_API_KEY,

});
 
const filePath = process.argv[2] || "./sample.pdf";
 
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

  return result.skillsDetected || [];

};
 
CVAnalyse(filePath)

  .then((skills) => {

    console.log("--- Skills Detected ---");

    console.log(skills);

  })

  .catch((err) => {

    console.error("CV analysis failed:", err.message || err);

    // AggregateError hides the real underlying network errors inside err.errors - log them

    if (err.errors) {

      console.error("Underlying causes:");

      err.errors.forEach((e, i) => console.error(`  [${i}]`, e.message || e));

    }

    if (err.cause) {

      console.error("Cause:", err.cause);

    }

  });
 