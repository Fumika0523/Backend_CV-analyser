const fs = require('fs');
const pdf = require('pdf-parse-new');
const { WordTokenizer, PorterStemmer } = require('natural'); // Assuming you're using natural
const { parse } = require('csv-parse/sync'); // Synchronous CSV parsing
const axios = require('axios');
const wordtokenizer = new WordTokenizer();
const stemmer = PorterStemmer; 
const stopWords = ['and', 'the', 'is', 'in', 'at', 'of', 'with', 'a', 'to', 'for']; // Example stop-words
 
const pdfPath = './sample.pdf';
 
const csvUrl = 'https://raw.githubusercontent.com/elit0451/SkillsRecommendationEngine/master/NeptuneSkillImporter/src/data/skills-dataset.csv%27';
 
// Helper function to process single words/phrases the exact same way as the PDF
function preprocessAndStem(text) {
    const tokens = wordtokenizer.tokenize(text.toLowerCase());
    return tokens
        .filter(word => !stopWords.includes(word))
        .filter(word => /[a-zA-Z0-9]/.test(word))
        .map(word => stemmer.stem(word))
        .join(' '); // Join back for multi-word skills like "Data Science" -> "data scienc"
}
 
async function loadAndTrainSkillsDataset() {
    console.log("Fetching and indexing skills dataset...");
    // 1. Fetch CSV data
    const response = await axios.get(csvUrl)
    const csvContent = response.data
 
    // 2. Parse CSV
    const records = parse(csvContent, {
        columns: false, // Set to true if the CSV has a header row like 'skill_name'
        skip_empty_lines: true
    });
 
    // 3. Build a "Model" Map: { "stemmed_version": "Original Skill Name" }
    const skillsModel = new Map();
 
    records.forEach(row => {
        const originalSkill = row[0];
        if (!originalSkill) return;
 
        const stemmedSkill = preprocessAndStem(originalSkill);
        if (stemmedSkill.length > 0) {
            // Map the processed string back to its proper display name
            skillsModel.set(stemmedSkill, originalSkill);
        }
    });
 
    console.log(`Model Training Complete. Indexed ${skillsModel.size} unique skills.`);
    return skillsModel;
}
async function processCleanAndStemPDF(skillsModel) {
    try {
        // 1. Read and parse PDF
        const dataBuffer = fs.readFileSync(pdfPath);
        const data = await pdf(dataBuffer);
        const rawText = data.text;
 
        // 2. Tokenize 
        const rawWords = wordtokenizer.tokenize(rawText);
 
        // 3. Clean and Stem
        const processedWords = rawWords
            .map(word => word.toLowerCase()) 
            .filter(word => !stopWords.includes(word)) 
            .filter(word => /[a-zA-Z0-9]/.test(word)) 
            .map(word => stemmer.stem(word));
 
        // --- Match Extracted Words with Trained Skills Model ---
        const matchedSkills = new Set();
 
        // Check for Single-word matches
        processedWords.forEach(word => {
            if (skillsModel.has(word)) {
                matchedSkills.add(skillsModel.get(word));
            }
        });
 
        // Check for Multi-word matches (e.g., "softwar engin" -> "Software Engineering")
        // we create combinations of consecutive words (bi-grams and tri-grams)
        for (let i = 0; i < processedWords.length - 1; i++) {
            const twoWords = `${processedWords[i]} ${processedWords[i+1]}`;
            if (skillsModel.has(twoWords)) {
                matchedSkills.add(skillsModel.get(twoWords));
            }
 
            if (i < processedWords.length - 2) {
                const threeWords = `${processedWords[i]} ${processedWords[i+1]} ${processedWords[i+2]}`;
                if (skillsModel.has(threeWords)) {
                    matchedSkills.add(skillsModel.get(threeWords));
                }
            }
        }
 
        // --- Output Results ---
        console.log("\n--- Processing Summary ---");
        console.log(`Original Word Count: ${rawWords.length}`);
        console.log(`Final Processed & Stemmed Word Count: ${processedWords.length}`);
        console.log("\n--- Extracted & Matched Skills ---");
        console.log(Array.from(matchedSkills));
 
    } catch (error) {
        console.error("An error occurred during PDF processing:", error);
    }
}
 
async function main() {
    try {
        const trainedSkillsModel = await loadAndTrainSkillsDataset();
        await processCleanAndStemPDF(trainedSkillsModel);
    } catch (err) {
        console.error("Pipeline failed:", err);
    }
}
 
main();