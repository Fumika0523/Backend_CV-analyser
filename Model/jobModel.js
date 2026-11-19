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

    postedByName: {
  type: String,
  required: true,
  trim: true,
},

postedByPosition: {
  type: String,
  trim: true,
  default: "",
},

    requirements: {
      type: [String],
      default: [],
    },

    location: {
  
city: {
  type: String,

  required: function () {
    // Is Mongoose validating an update query?
    const isUpdateQuery =
      typeof this.getUpdate === "function";

    // Get the update payload if this is a query.
    const update = isUpdateQuery
      ? this.getUpdate()
      : null;

    // Check both nested and dotted update formats.
    const locationType = isUpdateQuery
      ? (
          update?.$set?.location?.locationType ??
          update?.$set?.["location.locationType"] ??
          update?.location?.locationType ??
          update?.["location.locationType"] ??
          this.get("location.locationType")
        )
      : this.location?.locationType;

    // Temporary diagnostic information.
    console.log("=== CITY VALIDATOR DEBUG ===", {
      isUpdateQuery,
      locationType,
      locationUpdateKeys: Object.keys(
        update?.$set ?? update ?? {}
      ).filter(
        (key) =>
          key === "location" ||
          key.startsWith("location.")
      ),
    });

    // Require city for city and legacy locations.
    // Country, county and region locations may omit city.
    return !locationType || locationType === "city";
  },
},

      country: {
        type: String,
        required: true,
      },

      county: {
        type: String,
        trim: true,
      },

      region: {
        type: String,
        trim: true,
      },

      locationType: {
        type: String,
        enum: ["city", "county", "region", "country"],
      },

      displayName: {
        type: String,
        trim: true,
      },

      providerPlaceId: {
        type: String,
        trim: true,
      },
    },

      county: {
    type: String,
    default: "",
  },

  state: {
    type: String,
    default: "",
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
