const Application = require("../Model/applicationModel");

// ===============================
// APPLY FOR JOB
// ===============================
const applyForJob = async (req, res) => {
  try {
    const {
      jobId,
      jobTitle,
      company,
      companyId,
      cvId,
    } = req.body;

    // Check if already applied
    const alreadyApplied = await Application.findOne({
      userId: req.user.id,
      jobId,
    });

    if (alreadyApplied) {
      return res.status(400).json({
        success: false,
        message: "You already applied for this job",
      });
    }

    // Create application
    const application = await Application.create({
      candidateId: req.user.id,
      jobId,
      jobTitle,
      company,
      companyId,
      cvId,
      status: "pending",
    });

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
    let applications;

    // Candidate → get own applications
    if (req.user.role === "candidate") {
      applications = await Application.find({
        userId: req.user.id,
      }).sort({ appliedDate: -1 });
    }

    // Company → get applications for their jobs
    if (req.user.role === "company") {
      applications = await Application.find({
        companyId: req.user.id,
      }).sort({ appliedDate: -1 });
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

    // Only company owner can update
    if (
      application.companyId.toString() !== req.user.id
    ) {
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