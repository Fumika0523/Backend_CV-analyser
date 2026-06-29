const fs = require('fs');
const pdf = require('pdf-parse-new');
const pdfPath = './sample.pdf';

// Read the PDF file into a buffer
const dataBuffer = fs.readFileSync(pdfPath);
pdf(dataBuffer)
    .then(function(data) {
        // The extracted text is stored in data.text
        console.log("--- Extracted Text ---");
        console.log(data.text);
        
         // const words = data.text.match(/\b\w+\b/g);
        // console.log(words);
    })
    .catch(function(error) {
        console.error("Error parsing the PDF:", error);
    })

    