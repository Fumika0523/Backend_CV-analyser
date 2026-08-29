const mongoose = require("mongoose");

const JOB_CATEGORIES = [
  "Accounting & Finance",
  "Administration",
  "Customer Service",
  "Design & Creative",
  "Education & Training",
  "Engineering",
  "Healthcare",
  "Hospitality",
  "Human Resources & Recruitment",
  "IT & Software",
  "Legal",
  "Logistics & Supply Chain",
  "Management & Operations",
  "Manufacturing",
  "Marketing",
  "Retail",
  "Sales",
  "Science & Research",
  "Security & Emergency Services",
  "Skilled Trades & Construction",
  "Other",
];

const INDUSTRIES = [
  "Technology",
  "Banking & Financial Services",
  "Healthcare",
  "Education",
  "Retail",
  "Construction",
  "Manufacturing",
  "Hospitality & Leisure",
  "Automotive",
  "Aviation",
  "Logistics & Transport",
  "Energy & Environment",
  "Professional Services",
  "Public Sector",
  "Charity & Non-profit",
  "Other",
];

const jobSchema = new mongoose.Schema(
  {
     companyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Company",
      required: true,
    },

    /*
     * Records WHICH recruiter created the job.
     *
     * Example:
     * companyId = Google
     * createdBy = Alice
     */
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    title: {
      type: String,
      required: true,
      trim: true,
    },

    companyUrl: {
      type: String,
      required: true,
      trim: true,
    },

    jobType: {
      type: String,

      enum: [
        "Full-time",
        "Part-time",
        "Contract",
        "Internship",
      ],

      default: "Full-time",
    },

    workMode: {
      type: String,

      enum: [
        "Office",
        "Hybrid",
        "Remote",
      ],

      default: "Office",
    },

    education: {
      type: String,
      required: true,
    },

    experience: {
      type: String,
      required: true,
    },

    keySkills: {
      type: [String],
      default: [],
    },

    requirements: {
      type: [String],
      default: [],
    },

    /*
     * Job location is different from
     * Company.location.
     *
  Company: ABC Recruitment Ltd
Company office: London

Job: Software Engineer
Actual workplace: Manchester
     */
    location: {
      city: {
        type: String,
        required: true,
      },

      country: {
        type: String,
        required: true,
      },
    },

    responsibilities: {
      type: [String],
      default: [],
    },

    roleSummary: {
      type: String,
      required: true,
    },

    compensationBenefits: {
      type: String,
      required: true,
    },

    category: {
      type: String,
      required: true,
      enum: JOB_CATEGORIES,
    },

    industry: {
      type: String,
      required: true,
      enum: INDUSTRIES,
    },

    applicationEndDate: {
      type: Date,
      required: true,
    },

    salary: {
      type: String,
      required: true,
    },

    status: {
      type: String,

      enum: [
        "Open",
        "Closed",
        "Expired",
      ],

      default: "Open",
    },

    vacancies: {
      type: Number,
      default: 1,
      min: 1,
    },

    filledPositions: {
      type: Number,
      default: 0,
      min: 0,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model(
  "Job",
  jobSchema
);