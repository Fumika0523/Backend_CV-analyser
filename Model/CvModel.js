const mongoose = require("mongoose");

const CvSchema = new mongoose.Schema(
  {
    // cvId:{
    //    type: mongoose.Schema.Types.ObjectId,
    //    required:true,
    // },
    // same as userId
    candidateId: {
      type: Number,
      required: false,
      default: null,
    },

    guestSessionId: {
      type: String,
      required: false,
      default: null,
    },

    version: {
      type: Number,
      default: 1,
    },

    fileName: {
      type: String,
      required: true,
    },

    filePath: {
      type: String,
      required: true,
    },

    rawText: {
      type: String,
      default: "",
    },

    skillsDetected: {
      type: [String],
      default: [],
    },

    suggestedRoles: {
      type: [String],
      default: [],
    },

    improvements: {
      type: [String],
      default: [],
    },

    resumeScore: {
      type: Number,
      default: null,
    },

    uploadedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.models.CV || mongoose.model("CV", CvSchema);