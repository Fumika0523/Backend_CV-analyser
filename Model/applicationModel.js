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
      enum: ["pending", "reviewing", "interview", "rejected", "accepted"],
      default: "pending",
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
 
module.exports = mongoose.model("Application", applicationSchema);