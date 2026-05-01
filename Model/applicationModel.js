const mongoose = require("mongoose");
 
const applicationSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  jobId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
  },
  jobTitle: {
    type: String,
    required: true,
  },
  company: {
    type: String,
    required: true,
  },
  companyId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
  },
  status: {
    type: String,
    enum: ["notapplied" , "pending", "review", "interview", "rejected", "accepted"],
    default: "pending",
  },
  appliedDate: {
    type: Date,
    default: Date.now,
  },
  cvId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "CV",
  },
});
 
module.exports = mongoose.model("Application", applicationSchema);