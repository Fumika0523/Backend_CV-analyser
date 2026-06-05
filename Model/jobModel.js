const mongoose = require("mongoose");

const jobSchema = new mongoose.Schema(
  {
    companyId: {
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
      enum: ["Full-time", "Part-time", "Contract", "Internship"],
      default: "Full-time",
    },

    workMode: {
      type: String,
      enum: ["Office", "Hybrid", "Remote"],
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

        location: {
  city: { type: String, required: true },
  country: { type: String, required: true },
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

    //CompanyDescription is stored in the User collection
    // description: {
    //   type: String,
    //   required: false,
    // },

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
      enum: ["Open", "Closed"],
      default: "Open",
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Job", jobSchema);