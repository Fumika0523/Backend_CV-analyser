const mongoose = require("mongoose");

const applicationSchema = new mongoose.Schema(
  {
    candidateId: {
      type: Number,
      required: true,
    },

    companyId: {
      type: Number,
      required: true,
    },

    jobId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Job",
      required: true,
    },

    cvId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "CV",
      default: null,
    },

    title: {
      type: String,
      required: true,
    },

    companyName: {
      type: String,
      required: true,
    },

    status: {
      type: String,
      enum: ["pending", "reviewing", "interview", "rejected", "accepted"],
      default: "pending",
    },

    acceptedAt: {
      type: Date,
      default: null,
    },

    appliedDate: {
      type: Date,
      default: Date.now,
    },

    matchScore: {
      type: Number,
      default: 0,
    },

    matchedSkills: {
      type: [String],
      default: [],
    },

    missingSkills: {
      type: [String],
      default: [],
    },

    locationMatch: {
      type: Boolean,
      default: false,
    },

    note: {
      type: String,
      default: "",
    },
  },
  { timestamps: true }
);

// Prevent a candidate from applying for the same job twice.
applicationSchema.index(
  { candidateId: 1, jobId: 1 },
  { unique: true }
);

module.exports = mongoose.model("Application", applicationSchema);