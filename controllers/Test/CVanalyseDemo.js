const fs = require('fs');
const pdfParse = require('pdf-parse-new'); // Use the modern package
 
// Create an asynchronous function called parsePDF
// filePath = 'sample.pdf'
// PDF parsing can take time, so we use async/await


async function parsePDF(filePath) {


    // Start a try block
    // If something fails, execution jumps to catch
    try {

        // Check if the file exists
        if (!fs.existsSync(filePath)) {
            console.error(`Error: File not found at ${filePath}`);
            return;
        }

        // readFileSync() reads the file synchronously
        // It waits until file reading is finished
        // dataBuffer stores the file as binary data (Buffer object) << fs.readFileSync()
        // PDF parsers need binary data instead of plain text

        const dataBuffer = fs.readFileSync(filePath);

        console.log("Parsing PDF... Please wait.");
        console.log("--------------------------------------------------\n");

        // pdfParse(dataBuffer) sends PDF binary data into the parser
        // The parser extracts:
        // - text
        // - metadata
        // - page count
        // await waits until parsing is completed

        const data = await pdfParse(dataBuffer);

        console.log("--- EXTRACTED TEXT ---");

        // data.text contains the extracted PDF text
        console.log(data.text);

        console.log("--------------------------------------------------\n");

        // Return extracted text
        return data.text;
 
    } catch (error) {

        // Handle parsing errors
        console.error("An error occurred during PDF parsing:", error);
    }
}

// Call the function
parsePDF('Sample.pdf'); // replace with actual path