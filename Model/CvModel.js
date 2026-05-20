const mongoose = require("mongoose");

const CvSchema = new mongoose.Schema(
  {
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

    uploadedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("CV", CvSchema);