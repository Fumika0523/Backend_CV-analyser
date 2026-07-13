// ===== DEPENDENCIES =====
const fs = require('fs');                                  // Node's built-in file system module — used to read the PDF file from disk
const pdf = require('pdf-parse-new');                       // Extracts raw text out of a PDF buffer
const { WordTokenizer, PorterStemmer } = require('natural'); // "natural" is an NLP toolkit for JS
                                                              // WordTokenizer splits a string into individual word tokens
                                                              // PorterStemmer reduces words to their root form (e.g. "running" -> "run")
const { parse } = require('csv-parse/sync');                // Synchronous CSV parser — turns CSV text into an array of arrays
const axios = require('axios');                              // HTTP client, used here to download the skills CSV from GitHub

const wordtokenizer = new WordTokenizer();                  // Create one reusable tokenizer instance
const stemmer = PorterStemmer;                              // Alias for convenience — PorterStemmer is a static/singleton object in "natural"

// A very small, manually curated stop-word list (words with no semantic value, filtered out before matching)
const stopWords = ['and', 'the', 'is', 'in', 'at', 'of', 'with', 'a', 'to', 'for'];

const pdfPath = './sample.pdf';                             // Local path to the resume/CV PDF being analyzed

// URL of an open-source "skills dataset" CSV (a big list of known skill names) used as the reference vocabulary
const csvUrl = 'https://raw.githubusercontent.com/elit0451/SkillsRecommendationEngine/master/NeptuneSkillImporter/src/data/skills-dataset.csv';


// ===== TEXT NORMALIZATION HELPER =====
// This function must be applied identically to BOTH the skills dataset and the PDF text,
// otherwise stemmed strings won't match each other later.
function preprocessAndStem(text) {
    const tokens = wordtokenizer.tokenize(text.toLowerCase()); // Lowercase the text, then split into word tokens
    return tokens
        .filter(word => !stopWords.includes(word))             // Drop stop-words ("and", "the", etc.)
        .filter(word => /[a-zA-Z0-9]/.test(word))               // Drop tokens that are pure punctuation (keep only tokens containing at least one letter/digit)
        .map(word => stemmer.stem(word))                        // Reduce each remaining word to its stem, e.g. "engineering" -> "engin"
        .join(' ');                                             // Re-join stems with spaces so multi-word skills stay comparable,
                                                                  // e.g. "Data Science" -> tokens ["data","science"] -> stems ["data","scienc"] -> "data scienc"
}


// ===== STEP 1: BUILD THE REFERENCE "SKILLS MODEL" FROM THE CSV =====
async function loadAndTrainSkillsDataset() {
    console.log("Fetching and indexing skills dataset...");

    // 1. Download the CSV as plain text (not auto-parsed) from GitHub
    const response = await axios.get(csvUrl, {
        responseType: 'text',
        transformResponse: [(data) => data],   // Prevents axios from trying to auto-parse the body as JSON
        headers: {
            'User-Agent': 'Mozilla/5.0 (compatible; SkillsBot/1.0)', // Some CDNs/GitHub block requests with no/blank User-Agent
            'Accept': 'text/plain, text/csv, */*'
        }
    });

    const csvContent = response.data;

    // 2. Defensive check: if a proxy/firewall/captive portal intercepted the request,
    //    we'd get back an HTML error/login page instead of CSV — detect that BEFORE parsing,
    //    so the failure message is clear instead of a cryptic CSV-parser error.
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

    // 3. Parse the CSV text into rows of arrays.
    //    "relax_quotes"/"relax_column_count"/"skip_records_with_error" are needed because
    //    this particular dataset has malformed rows (stray quotes, inconsistent column counts).
    const records = parse(csvContent, {
        columns: false,                 // Don't auto-map to objects by header — we handle the header row manually below
        skip_empty_lines: true,
        relax_quotes: true,             // Tolerate stray/unescaped quote characters inside fields
        relax_column_count: true,       // Tolerate rows with a different number of columns than expected
        skip_records_with_error: true   // Silently drop any row that still fails to parse, rather than crashing
    });

    // 4. Build the "model": a Map from a STEMMED skill string -> the ORIGINAL, human-readable skill name
    //    e.g. "data scienc" -> "Data Science"
    const skillsModel = new Map();

    records.forEach(row => {
        // Expected column layout in this CSV: [~id, name, ~label, abbreviation]
        const originalSkill = row[1];                                          // Column index 1 = the skill's display name
        if (!originalSkill) return;                                            // Skip malformed/empty rows
        if (originalSkill.trim().toLowerCase() === 'name:string') return;      // Skip the literal header row (its 2nd column is "name:String")

        const stemmedSkill = preprocessAndStem(originalSkill);                 // Normalize the skill name the same way PDF text will be normalized
        if (stemmedSkill.length > 0) {
            skillsModel.set(stemmedSkill, originalSkill);                      // Store stemmed-key -> original-value for later lookup
        }
    });

    console.log(`Model Training Complete. Indexed ${skillsModel.size} unique skills.`);
    return skillsModel; // Return the lookup table to be used against the resume text
}


// ===== STEP 2: EXTRACT SKILLS FROM THE PDF USING THE MODEL =====
async function processCleanAndStemPDF(skillsModel) {
    try {
        // 1. Read the PDF file from disk into a raw buffer, then extract its plain text
        const dataBuffer = fs.readFileSync(pdfPath);
        const data = await pdf(dataBuffer);
        const rawText = data.text;

        // 2. Split the resume's full text into individual word tokens
        const rawWords = wordtokenizer.tokenize(rawText);

        // 3. Apply the SAME cleaning/stemming pipeline used on the CSV, word-by-word
        //    (Note: this does the steps inline rather than calling preprocessAndStem() directly,
        //     because it needs the stems as a WORD ARRAY, not re-joined into strings, to build n-grams next.)
        const processedWords = rawWords
            .map(word => word.toLowerCase())
            .filter(word => !stopWords.includes(word))
            .filter(word => /[a-zA-Z0-9]/.test(word))
            .map(word => stemmer.stem(word));

        // --- Match extracted stems against the trained skills model ---
        const matchedSkills = new Set(); // Set = automatically de-duplicates, so no repeated skills in the output

        // 4a. Single-word matches: is this one stemmed word, by itself, a known skill? (e.g. "python")
        processedWords.forEach(word => {
            if (skillsModel.has(word)) {
                matchedSkills.add(skillsModel.get(word)); // Add the ORIGINAL (human-readable) name, not the stem
            }
        });

        // 4b. Multi-word matches: build bigrams (2 consecutive words) and trigrams (3 consecutive words)
        //     because many skills are phrases, e.g. "softwar engin" -> "Software Engineering"
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

        // --- Output results to the console ---
        console.log("\n--- Processing Summary ---");
        console.log(`Original Word Count: ${rawWords.length}`);
        console.log(`Final Processed & Stemmed Word Count: ${processedWords.length}`);
        console.log("\n--- Extracted & Matched Skills ---");
        console.log(Array.from(matchedSkills)); // Convert Set back to a plain array for display

    } catch (error) {
        console.error("An error occurred during PDF processing:", error);
    }
}


// ===== ENTRY POINT =====
async function main() {
    try {
        const trainedSkillsModel = await loadAndTrainSkillsDataset(); // Step 1: build reference vocabulary from CSV
        await processCleanAndStemPDF(trainedSkillsModel);             // Step 2: extract matching skills from the PDF
    } catch (err) {
        console.error("Pipeline failed:", err.message || err);
    }
}

main();