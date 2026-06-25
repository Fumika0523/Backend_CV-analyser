const fs = require('fs');

const pdfParse = require('pdf-parse-new'); // Use the modern package
const IT_SKILLS_DICTIONARY = [

    // Languages
    'javascript', 'typescript', 'python', 'java', 'c\\++', 'c#', 'php', 'ruby', 'go', 'rust', 'html', 'css',

    // Frameworks & Libraries
    'react', 'angular', 'vue', 'node\\.js', 'express', 'django', 'flask', 'spring boot', 'laravel',

    // Cloud & DevOps
    'aws', 'azure', 'gcp', 'docker', 'kubernetes', 'jenkins', 'git', 'ci/cd', 'terraform',

    // Databases
    'sql', 'mysql', 'postgresql', 'mongodb', 'redis', 'oracle',

    // Concepts & Others
    'agile', 'scrum', 'rest api', 'graphql', 'machine learning', 'data science', 'cybersecurity'

];
 
function analyzeSkills(rawText) {
    // if empty, then return empty
    if (!rawText) return [];
 
    // Convert to lowercase to make the search case-insensitive
    const lowerText = rawText.toLowerCase();

    const foundSkills = new Set(); // Use a Set to avoid duplicate skills
 
    console.log("--- ANALYZING IT SKILLS ---");
 
    IT_SKILLS_DICTIONARY.forEach(skill => {
        // regular express - module that provided by node
        // validate the actual data. (replace, search, )
        // match \\
        let regex;

        if (skill === 'c\\++') {

            regex = /c\+\+/g;

        } else if (skill === 'node\\.js') {
            regex = /node\.js/g;
        } else {
            regex = new RegExp(`\\b${skill}\\b`, 'g');
        }
 
        if (regex.test(lowerText)) {

            // Convert back to a readable format for display
            const displaySkill = skill.replace(/\\/g, '').toUpperCase();
            foundSkills.add(displaySkill);

        }

    });


    const lines = rawText.split('\n');

    console.log("\n[Context Clues from PDF]:");

    lines.forEach(line => {

        const containsSkill = IT_SKILLS_DICTIONARY.some(skill => {

            const cleanSkill = skill.replace(/\\/g, '');

            return line.toLowerCase().includes(cleanSkill);

        });
        // it must be longer than 3 characters
        if (containsSkill && line.trim().length > 3) {

            console.log(`- ${line.trim()}`);

        }

    });
 
    return Array.from(foundSkills);

}

async function parseAndAnalysePDF(filePath) {

    try {

        if (!fs.existsSync(filePath)) {

            console.error(`Error: File not found at ${filePath}`);

            return;

        }

        const dataBuffer = fs.readFileSync(filePath);

        console.log("Parsing PDF... Please wait.");

        console.log("--------------------------------------------------\n");
        // pdsParse pdf to text. awaiti >> need to wait until finish the parsing
        const data = await pdfParse(dataBuffer);

        // Run the skills analysis
        
        const skillsDetected = analyzeSkills(data.text);

        console.log("\n--------------------------------------------------");

        console.log("--- IDENTIFIED IT SKILLS ---");

        if (skillsDetected.length > 0) {

            console.log(skillsDetected.join(', '));

        } else {

            console.log("No explicit IT skills from the dictionary were identified.");

        }

        console.log("--------------------------------------------------\n");

        return skillsDetected;

    } catch (error) {

        console.error("An error occurred during PDF parsing:", error);

    }

}
 
parseAndAnalysePDF('sample.pdf'); // replace with actual path
 