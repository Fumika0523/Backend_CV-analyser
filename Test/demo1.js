const fs = require('fs');
const pdf = require('pdf-parse-new');
const natural = require('natural');
const stemmer = natural.PorterStemmer;
const pdfPath = './sample.pdf'; 


// 1. tokenizers
const wordTokenizer = new natural.WordTokenizer();

const stopWords = natural.stopwords

const sentenceTokenizer = new natural.SentenceTokenizer();

async function processPDF() {
    try {
        // Read and parse PDF
        const dataBuffer = fs.readFileSync(pdfPath);
        const data = await pdf(dataBuffer);
        const rawText = data.text;

        console.log("--- Extraction Complete. Starting Tokenization --- \n");

        //  Professional Word Tokenization (via NLP library)
        // Splits words clean, removes punctuation entirely
        const nlpWords = wordTokenizer.tokenize(rawText);
        
        // Professional Sentence Tokenization
        // not to break on abbreviations like "Dr." or "Inc."
        const nlpSentences = sentenceTokenizer.tokenize(rawText);

        // Pure JavaScript Regex Tokenization (No npm packages required)
        // \b\w+\b captures alpha-numeric words
        const regexWords = rawText.match(/\b\w+\b/g) || [];

        // --- Output Results ---
        console.log(`Total Characters Extracted: ${rawText.length}`);
        console.log(`Total Words (NLP): ${nlpWords.length}`);
        console.log(`Total Sentences: ${nlpSentences.length}\n`);

        console.log("First 10 words (NLP):", nlpWords.slice(0, 10));
        console.log("First 2 sentences:", nlpSentences.slice(0, 2));
        console.log("First 10 words (Regex Alternative):", regexWords.slice(0, 10));

    } catch (error) {
        console.error("An error occurred:", error);
    }
}

async function processAndCleanPDF() {
    try {
        // 1. Read and parse PDF
        const dataBuffer = fs.readFileSync(pdfPath);
        const data = await pdf(dataBuffer);
        const rawText = data.text;

        // 2. Tokenize (this automatically strips out punctuation marks like .,!?;:)
        const rawWords = wordTokenizer.tokenize(rawText);

        // 3. Clean: Convert to lowercase and filter out stop words
        const cleanedWords = rawWords
            .map(word => word.toLowerCase()) // Normalize to lowercase
            .filter(word => {
                // Remove stop words
                if (stopWords.includes(word)) return false;
                
                // Extra safety: Remove single-character punctuation/symbols regex missed
                // or standalone numbers if you don't want them (e.g., matching only text)
                if (/^[^a-zA-Z0-9]+$/.test(word)) return false; 

                return true;
            });

        // --- Output Results ---
        console.log("--- Processing Summary ---");
        console.log(`Original Word Count: ${rawWords.length}`);
        console.log(`Cleaned Word Count (No Stop Words): ${cleanedWords.length}\n`);

        console.log("Sample of Cleaned Words (First 20):");
        console.log(cleanedWords.slice(0, 20));

    } catch (error) {
        console.error("An error occurred:", error);
    }
}

async function processCleanAndStemPDF() {
    try {
        // 1. Read and parse PDF
        const dataBuffer = fs.readFileSync(pdfPath);
        const data = await pdf(dataBuffer);
        const rawText = data.text;

        // 2. Tokenize (Strips punctuation out of the box)
        const rawWords = wordTokenizer.tokenize(rawText);

        // 3. Clean and Stem - we dont need to always use stemming
        const processedWords = rawWords
            .map(word => word.toLowerCase()) // Lowercase for consistency
            .filter(word => !stopWords.includes(word)) // Remove stop words
            .filter(word => /[a-zA-Z0-9]/.test(word)) // Ensure it's not a stray symbol
            .map(word => stemmer.stem(word)); // Apply Stemming

        // --- Output Results ---
        console.log("--- Processing Summary ---");
        console.log(`Original Word Count: ${rawWords.length}`);
        console.log(`Final Processed & Stemmed Word Count: ${processedWords.length}\n`);

        console.log("Sample of Stemmed Words (First 20):");
        console.log(processedWords.slice(0, 20));

    } catch (error) {
        console.error("An error occurred:", error);
    }
}

// processAndCleanPDF();

// processPDF();

processCleanAndStemPDF()

