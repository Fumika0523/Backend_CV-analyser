const fs = require('fs');
const pdfParse = require('pdf-parse-new'); // Use the modern package
 
async function parsePDF(filePath) {
    try {
        if (!fs.existsSync(filePath)) {
            console.error(`Error: File not found at ${filePath}`);
            return;
        }
        const dataBuffer = fs.readFileSync(filePath);
        console.log("Parsing PDF... Please wait.");
        console.log("--------------------------------------------------\n");
        // The packag exposes the correct executable function directly
        const data = await pdfParse(dataBuffer);
        console.log("--- EXTRACTED TEXT ---");
        console.log(data.text);
        console.log("--------------------------------------------------\n");
        return data.text;
 
    } catch (error) {
        console.error("An error occurred during PDF parsing:", error);
    }
}
parsePDF('sample.pdf'); // replace with actual path
 