const fs = require("fs/promises");

const JOB_TYPES = [
  "Full-time",
  "Part-time",
  "Contract",
  "Internship",
];

const WORK_MODES = [
  "Office",
  "Hybrid",
  "Remote",
];

const SALARY_OPTIONS = [
  "£15,000 - £20,000",
  "£20,000 - £25,000",
  "£25,000 - £30,000",
  "£30,000 - £35,000",
  "£35,000 - £40,000",
  "£40,000 - £50,000",
  "£50,000 - £60,000",
  "£60,000 - £70,000",
  "£70,000+",
  "Competitive",
];

/*
 * This schema tells Gemini exactly what JSON structure it must return.
 *
 * We include an empty string in some enums because job-description PDFs
 * frequently omit information. Gemini should not invent missing values.
 */
const jobExtractionSchema = {
  type: "object",

  properties: {
    title: {
      type: "string",
      description: "The job title, or an empty string when not available.",
    },

    companyUrl: {
      type: "string",
      description:
        "The application URL explicitly written in the document. Never invent a URL.",
    },

    jobType: {
      type: "string",
      enum: [...JOB_TYPES, ""],
      description:
        "Normalised job type. Return an empty string when it cannot be determined.",
    },

    workMode: {
      type: "string",
      enum: [...WORK_MODES, ""],
      description:
        "Office, Hybrid or Remote only when supported by the document.",
    },

    education: {
      type: "string",
      description:
        "Required education or qualifications, or an empty string.",
    },

    experience: {
      type: "string",
      description:
        "Required experience, for example 2-3 years, or an empty string.",
    },

    keySkills: {
      type: "array",
      items: {
        type: "string",
      },
      description:
        "A unique list of high-level technical and professional skills.",
    },

    location: {
      type: "string",
      description:
        "Location formatted exactly as City, Country, or an empty string.",
    },

    responsibilities: {
      type: "array",
      items: {
        type: "string",
      },
      description:
        "Individual responsibilities without numbering or duplicated entries.",
    },

    roleSummary: {
      type: "string",
      description:
        "A concise summary of the role based only on the document.",
    },

    compensationBenefits: {
      type: "string",
      description:
        "Salary-related benefits, pension, holidays, training and other benefits.",
    },

    requirements: {
      type: "array",
      items: {
        type: "string",
      },
      description:
        "Individual candidate requirements without duplicated entries.",
    },

    applicationEndDate: {
      type: "string",
      description:
        "Closing date formatted YYYY-MM-DD, or an empty string when not stated.",
    },

    salary: {
      type: "string",
      enum: [...SALARY_OPTIONS, ""],
      description:
        "Map an explicitly stated salary to the closest supported salary option.",
    },

    vacancies: {
      type: "integer",
      minimum: 1,
      description:
        "Explicit number of vacancies. Use 1 when it is not stated.",
    },

    missingFields: {
      type: "array",
      items: {
        type: "string",
      },
      description:
        "Names of important form fields that were not present in the PDF.",
    },

    warnings: {
      type: "array",
      items: {
        type: "string",
      },
      description:
        "Ambiguous or potentially unreliable information the company should review.",
    },
  },

  required: [
    "title",
    "companyUrl",
    "jobType",
    "workMode",
    "education",
    "experience",
    "keySkills",
    "location",
    "responsibilities",
    "roleSummary",
    "compensationBenefits",
    "requirements",
    "applicationEndDate",
    "salary",
    "vacancies",
    "missingFields",
    "warnings",
  ],
};

/*
 * Removes empty strings and duplicate array values.
 */
const cleanStringArray = (items) => {
  if (!Array.isArray(items)) {
    return [];
  }

  const cleanedItems = items
    .filter((item) => typeof item === "string")
    .map((item) => item.trim())
    .filter(Boolean);

  /*
   * Compare lower-case values to prevent duplicates such as:
   * "Node.js" and "node.js".
   */
  return cleanedItems.filter(
    (item, index, array) =>
      index ===
      array.findIndex(
        (otherItem) =>
          otherItem.toLowerCase() === item.toLowerCase()
      )
  );
};

const cleanString = (value) => {
  return typeof value === "string" ? value.trim() : "";
};

/*
 * Gemini's structured output controls the response shape.
 *
 * We still validate the response because business validation should never
 * depend entirely on an external AI provider.
 */
const normaliseExtractedJob = (rawJob = {}) => {
  const extractedJob = {
    title: cleanString(rawJob.title),
    companyUrl: cleanString(rawJob.companyUrl),

    jobType: JOB_TYPES.includes(rawJob.jobType)
      ? rawJob.jobType
      : "",

    workMode: WORK_MODES.includes(rawJob.workMode)
      ? rawJob.workMode
      : "",

    education: cleanString(rawJob.education),
    experience: cleanString(rawJob.experience),

    keySkills: cleanStringArray(rawJob.keySkills),

    location: cleanString(rawJob.location),

    responsibilities: cleanStringArray(
      rawJob.responsibilities
    ),

    roleSummary: cleanString(rawJob.roleSummary),

    compensationBenefits: cleanString(
      rawJob.compensationBenefits
    ),

    requirements: cleanStringArray(rawJob.requirements),

    applicationEndDate: cleanString(
      rawJob.applicationEndDate
    ),

    salary: SALARY_OPTIONS.includes(rawJob.salary)
      ? rawJob.salary
      : "",

    vacancies:
      Number.isInteger(rawJob.vacancies) &&
      rawJob.vacancies >= 1
        ? rawJob.vacancies
        : 1,

    missingFields: cleanStringArray(
      rawJob.missingFields
    ),

    warnings: cleanStringArray(rawJob.warnings),
  };

  /*
   * Validate the AI date before sending it to the frontend.
   */
  if (
    extractedJob.applicationEndDate &&
    !/^\d{4}-\d{2}-\d{2}$/.test(
      extractedJob.applicationEndDate
    )
  ) {
    extractedJob.applicationEndDate = "";

    extractedJob.missingFields.push(
      "applicationEndDate"
    );

    extractedJob.warnings.push(
      "The closing date could not be converted to YYYY-MM-DD."
    );
  }

  return extractedJob;
};

/*
 * POST /jobs/analyse-pdf
 *
 * This endpoint analyses the PDF only.
 * It does not create a Job document in MongoDB.
 */
exports.analyseJobDescriptionPDF = async (req, res) => {
  const temporaryFilePath = req.file?.path;

  try {
    if (req.user?.role !== "company") {
      return res.status(403).json({
        message:
          "Only company accounts can analyse job descriptions.",
      });
    }

    if (!req.file) {
      return res.status(400).json({
        message: "Please upload a job-description PDF.",
      });
    }

    if (!process.env.GEMINI_API_KEY) {
      return res.status(500).json({
        message:
          "The Gemini API key has not been configured.",
      });
    }

    /*
     * Your backend uses CommonJS.
     *
     * Dynamic import allows us to load the modern ESM Gemini SDK
     * without changing your whole backend to type: module.
     */
    const { GoogleGenAI } = await import(
      "@google/genai"
    );

    const ai = new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY,
    });

    /*
     * Gemini expects the PDF as a base64 string when using
     * inline document input.
     */
    const pdfBuffer = await fs.readFile(
      temporaryFilePath
    );

    const pdfBase64 = pdfBuffer.toString("base64");

    const prompt = `
You are a job-description extraction system.

Read the uploaded PDF and produce structured job data.

Rules:

1. Extract information only from the PDF.
2. Do not invent missing information.
3. Use an empty string for a missing string field.
4. Use an empty array for a missing list field.
5. Add missing important fields to missingFields.
6. Remove duplicate skills, requirements and responsibilities.
7. Keep keySkills high-level and suitable for candidate matching.
8. Format location exactly as "City, Country".
9. Never invent companyUrl from a company name or email address.
10. Format applicationEndDate as YYYY-MM-DD only when a closing date is explicitly stated.
11. If vacancies are not stated, return 1 and add "vacancies" to missingFields.
12. Map job types as follows:
    - permanent or full time -> Full-time
    - part time -> Part-time
    - fixed-term, freelance or temporary contract -> Contract
    - internship, placement or graduate internship -> Internship
13. Map work mode only when supported by the PDF:
    - on-site or office-based -> Office
    - hybrid -> Hybrid
    - remote or home-based -> Remote
14. The salary value must be one of the supplied salary options.
15. When an exact annual salary is present, choose the closest salary range.
16. When the salary says competitive, return "Competitive".
17. Keep roleSummary concise, normally two to four sentences.
18. Do not place responsibilities inside requirements unless the PDF treats them as requirements.
`;

    /*
     * The current Gemini Interactions API accepts a PDF document and
     * a JSON Schema response format in the same request.
     */
    const interaction =
      await ai.interactions.create({
        model:
          process.env.GEMINI_MODEL ||
          "gemini-3.6-flash",

        input: [
          {
            type: "text",
            text: prompt,
          },
          {
            type: "document",
            data: pdfBase64,
            mime_type: "application/pdf",
          },
        ],

        response_format: {
          type: "text",
          mime_type: "application/json",
          schema: jobExtractionSchema,
        },
      });

    if (!interaction.output_text) {
      throw new Error(
        "Gemini returned an empty response."
      );
    }

    let parsedOutput;

    try {
      parsedOutput = JSON.parse(
        interaction.output_text
      );
    } catch (parseError) {
      console.error(
        "Gemini JSON parsing error:",
        parseError
      );

      throw new Error(
        "Gemini returned invalid JSON."
      );
    }

    const jobData =
      normaliseExtractedJob(parsedOutput);

    return res.status(200).json({
      message:
        "Job description analysed successfully.",
      jobData,
      missingFields: jobData.missingFields,
      warnings: jobData.warnings,
    });
  } catch (error) {
    console.error(
      "Job-description analysis error:",
      error
    );

    return res.status(502).json({
      message:
        "The AI could not analyse this job description.",

      /*
       * Do not expose provider details in production.
       */
      details:
        process.env.NODE_ENV === "development"
          ? error.message
          : undefined,
    });
  } finally {
    /*
     * The PDF is used only for temporary analysis.
     * Delete it whether the analysis succeeds or fails.
     */
    if (temporaryFilePath) {
      await fs
        .unlink(temporaryFilePath)
        .catch((deleteError) => {
          console.error(
            "Temporary PDF deletion error:",
            deleteError
          );
        });
    }
  }
};