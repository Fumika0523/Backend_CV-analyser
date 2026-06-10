const Application = require("../Model/applicationModel");
const User = require("../Model/UserModel");
const Job = require("../Model/jobModel")
const sendEmail = require("../utils/sendEmail");

const {
  candidateApplicationTemplate,
  companyApplicationTemplate,
} = require("../utils/emailTemplates");

// ===============================
// APPLY FOR JOB
// ===============================

const applyForJob = async (req, res) => {
  try {
    const { jobId, cvId } = req.body;

    const user = await User.findById(req.user.id).lean();

    if (!user || user.role !== "candidate") {
      return res.status(403).json({
        success: false,
        message: "Only candidates can apply for jobs",
      });
    }

    const job = await Job.findById(jobId)
  .populate("companyId", "userId companyName email firstName lastName")
  .lean();

    if (!job) {
      return res.status(404).json({
        success: false,
        message: "Job not found",
      });
    }

    const alreadyApplied = await Application.findOne({
      candidateId: user.userId,
      jobId,
    }).lean();

    if (alreadyApplied) {
      return res.status(400).json({
        success: false,
        message: "You already applied for this job",
      });
    }

console.log("REQ BODY:", req.body);
console.log("JOB FROM DB:", job);
console.log("JOB TITLE VALUE:", job.jobTitle || job.title);
console.log("COMPANY VALUE:", job.companyId);

  const application = await Application.create({
  candidateId: user.userId,
  companyId: job.companyId.userId,
  jobId: job._id,
  title: job.title,
  companyName: job.companyId.companyName || "Company",
  cvId,
  status: "pending",
});

const candidateHtml =
  candidateApplicationTemplate(user, job);

const companyHtml =
  companyApplicationTemplate(user, job);

// Email to candidate
await sendEmail({
  to: user.email,
  subject: "Application submitted successfully",
  html:candidateHtml,
})

// Email  to company
await sendEmail({
   to: job.companyId.email,
  subject: "New job application received",
  html: companyHtml,
})

    res.status(201).json({
      success: true,
      message: "Application submitted successfully",
      application,
    });
  } catch (error) {
    console.log("Apply Job Error:", error);

    res.status(500).json({
      success: false,
      message: "Server Error",
    });
  }
};

// ===============================
// GET APPLICATIONS
// ===============================
const getApplications = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).lean();

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    let applications = [];

    if (user.role === "candidate") {
      applications = await Application.find({
        candidateId: user.userId,
      })
        .sort({ appliedDate: -1 })
        .lean();
    }

    if (user.role === "company") {
      applications = await Application.find({
        companyId: user.userId,
      })
        .sort({ appliedDate: -1 })
        .lean();
    }

    res.status(200).json({
      success: true,
      count: applications.length,
      applications,
    });
  } catch (error) {
    console.log("Get Applications Error:", error);

    res.status(500).json({
      success: false,
      message: "Server Error",
    });
  }
};

// ===============================
// UPDATE APPLICATION STATUS
// ===============================
const updateApplicationStatus = async (req, res) => {
  try {
    const { status } = req.body;

    const application = await Application.findById(req.params.id);

    if (!application) {
      return res.status(404).json({
        success: false,
        message: "Application not found",
      });
    }

    const user = await User.findById(req.user.id);

if (application.companyId !== user.userId) {
  return res.status(403).json({
    success: false,
    message: "Unauthorized",
  });
} {
      return res.status(403).json({
        success: false,
        message: "Unauthorized",
      });
    }

    application.status = status;

    await application.save();

    res.status(200).json({
      success: true,
      message: "Application status updated",
      application,
    });
  } catch (error) {
    console.log("Update Status Error:", error);

    res.status(500).json({
      success: false,
      message: "Server Error",
    });
  }
};

module.exports = {
  applyForJob,
  getApplications,
  updateApplicationStatus,
};