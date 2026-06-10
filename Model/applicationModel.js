const mongoose = require("mongoose");
 
const applicationSchema = new mongoose.Schema(
  {
    //Mongoose ref normally works with MongoDB _id ObjectId.
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
      enum: ["pending", "review", "interview", "rejected", "accepted"],
      default: "pending",
    },

    appliedDate: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true }
);
 
module.exports = mongoose.model("Application", applicationSchema);