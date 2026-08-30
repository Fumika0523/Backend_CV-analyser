const mongoose = require("mongoose");

const applicationSchema =
  new mongoose.Schema(
    {
    
      candidateId: {
        type: Number,
        required: true,
      },

  
      companyId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Company",
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

      /*
       * Snapshot of job title.
       *
       * Keeping snapshots is useful because
       * the job title could later be edited.
       */
      title: {
        type: String,
        required: true,
      },

      /*
       * Snapshot of company name.
       *
       * Even though Company contains the real
       * name, keeping this in Application is useful
       * for application history.
       */
      companyName: {
        type: String,
        required: true,
      },

      status: {
        type: String,

        enum: [
          "pending",
          "reviewing",
          "interview",
          "rejected",
          "accepted",
        ],

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
    {
      timestamps: true,
    }
  );

/*
 * A candidate cannot apply twice
 * for the same job.
 */
applicationSchema.index(
  {
    candidateId: 1,
    jobId: 1,
  },
  {
    unique: true,
  }
);

module.exports =
  mongoose.model(
    "Application",
    applicationSchema
  );