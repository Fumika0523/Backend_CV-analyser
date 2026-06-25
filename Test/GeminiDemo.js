require("dotenv").config({
  path: require("path").resolve(__dirname, "../../.env"),
});
console.log("GEMINI KEY EXISTS:", !!process.env.GEMINI_API_KEY);
const fs = require('fs');
const path = require("path");
// node file system module so it can read the uploaded PDF file
const pdfParse = require('pdf-parse-new');
// Imports PDF parser, it converts PDF binary data into text.
// PDF is not normal readable text, it's a binary Buffer, PDF is not plain so parser needs Buffer(temporary holding area in a computer's memoty(usually RAM) here information is stored while it is being moved fromo one place to another)
const { GoogleGenAI, Type } = require('@google/genai');
 
// const ai = new GoogleGenAI();

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
});

async function extractAndAnalyzeResume(filePath) {

    try {

        // 1. Read and parse the PDF

        console.log("Reading PDF file...");
        // Reads PDF file as binary Buffer.
        const dataBuffer = fs.readFileSync(filePath);

        console.log("Parsing PDF text... Please wait.");

        const pdfData = await pdfParse(dataBuffer);

        const resumeText = pdfData.text;
 
        console.log("Analyzing skills with GenAI...");

        console.log("--------------------------------------------------\n");
 
        // 2. Define the prompt and the expected JSON structure

        const prompt = `

            Analyze the following resume text. Extract all professional skills, 

            technical proficiencies, tools, frameworks, and soft skills mentioned. 

            Return them as a clean list.

            Resume Text:

            ${resumeText}

        `;
 
        // 3. Call the Gemini model
        // sending prompt to Gemini
        //  ai.models.generateContent >> the core function in the Google Gen AI SDK used to send requests to multimodal AI models like Gemini.
        // the API supports:
        // Multimodal Processing : ANalyses text, images, audio and large PDF files
        // Streaming : delivers model responses in real-time chunks instead of waiting for the full output
        // Structured Outputs: Forces the model to return data in predefined JSON schemas, making it easy to parse.
        // Tool calling: integrates directly with Google Search, web data, and external APIs
        const response = await ai.models.generateContent({

            model: 'gemini-2.5-flash', // Using a fast, cost-effective model for text analysis

            contents: prompt,

            config: {

                // Enforce a strict JSON output structure

                responseMimeType: 'application/json',

                responseSchema: {

                    type: Type.OBJECT,

                    properties: {

                        skillsDetected: {

                            type: Type.ARRAY,

                            items: { type: Type.STRING },

                            description: "List of unique skills extracted from the text."

                        }

                    },

                    required: ["skillsDetected"],

                }

            }

        });
 
        // 4. Parse and return the JSON result

        const result = JSON.parse(response.text);

        return result.skillsDetected;
 
    } catch (error) {

        console.error("An error occurred during processing:", error);

        throw error;

    }

}
 
// Example usage:

// (Make sure to set your export GEMINI_API_KEY="your-api-key" in your terminal)

// const filePath = './sample.pdf'; 
const filePath = path.join(__dirname, "sample.pdf");
extractAndAnalyzeResume(filePath)

    .then(skills => {

        console.log("Skills Detected dynamically by Gemini:");

        console.log(skills);

    });
 
    //Storing skills in DB
    //match skills with JD
    //show suggestion to the candidate