const fs = require('fs');

const pdf = require('pdf-parse-new');

const { WordTokenizer, PorterStemmer } = require('natural'); // Assuming you're using natural

const { parse } = require('csv-parse/sync'); // Synchronous CSV parsing

const axios = require('axios');

const wordtokenizer = new WordTokenizer();

const stemmer = PorterStemmer;

const stopWords = ['and', 'the', 'is', 'in', 'at', 'of', 'with', 'a', 'to', 'for']; // Example stop-words
 
const pdfPath = './sample.pdf';
 
const csvUrl = 'https://raw.githubusercontent.com/elit0451/SkillsRecommendationEngine/master/NeptuneSkillImporter/src/data/skills-dataset.csv';
 
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
 
    // 1. Fetch CSV data (with headers so GitHub/CDNs don't block or redirect us to an HTML page)

    const response = await axios.get(csvUrl, {

        responseType: 'text',

        transformResponse: [(data) => data], // keep axios from trying to JSON-parse it

        headers: {

            'User-Agent': 'Mozilla/5.0 (compatible; SkillsBot/1.0)',

            'Accept': 'text/plain, text/csv, */*'

        }

    });
 
    const csvContent = response.data;
 
    // 2. Sanity-check the payload BEFORE handing it to the CSV parser.

    //    If we got redirected to a login/error/HTML page, fail with a clear message

    //    instead of a confusing "Invalid Opening Quote" error from csv-parse.

    const looksLikeHtml = /<!DOCTYPE html/i.test(csvContent) || /<html[\s>]/i.test(csvContent);

    const contentType = (response.headers['content-type'] || '').toLowerCase();
 
    if (looksLikeHtml || contentType.includes('text/html')) {

        console.error('--- Received HTML instead of CSV ---');

        console.error('Content-Type:', contentType);

        console.error('First 300 chars of response:\n', csvContent.slice(0, 300));

        throw new Error(

            'Expected CSV but received an HTML page. This usually means a proxy/firewall/antivirus ' +

            'is intercepting the request, or the request was blocked/redirected. ' +

            'Try opening the URL directly in a browser to confirm it still serves raw CSV, ' +

            'check your network/VPN/antivirus settings, or download the file locally and read it from disk instead.'

        );

    }
 
    // 3. Parse CSV (relaxed settings, since this dataset has stray quote characters e.g. in "s@t markup language"

    //    and some rows have extra commas, e.g. "708,unix,platforms,solaris,compaq tru 64")

    const records = parse(csvContent, {

        columns: false, // The file DOES have a header row (~id,name:String,~label,abbreviation:String) - we skip it manually below

        skip_empty_lines: true,

        relax_quotes: true,

        relax_column_count: true,

        skip_records_with_error: true

    });
 
    // 4. Build a "Model" Map: { "stemmed_version": "Original Skill Name" }

    const skillsModel = new Map();
 
    records.forEach(row => {

        // Column layout is: [~id, name, ~label, abbreviation]

        // row[0] is just the numeric ID - the actual skill name is row[1].

        const originalSkill = row[1];

        if (!originalSkill) return;

        if (originalSkill.trim().toLowerCase() === 'name:string') return; // skip header row
 
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

            const twoWords = `${processedWords[i]} ${processedWords[i + 1]}`;

            if (skillsModel.has(twoWords)) {

                matchedSkills.add(skillsModel.get(twoWords));

            }
 
            if (i < processedWords.length - 2) {

                const threeWords = `${processedWords[i]} ${processedWords[i + 1]} ${processedWords[i + 2]}`;

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

        console.error("Pipeline failed:", err.message || err);

    }

}
 
main();
 

// make sure it returns in json add this to the services folder, add it as required, in this file you should have the function. from here we will return the function.

// independent, effective as possible.