const CV = require("../Model/CVModel");
const Application = require("../Model/ApplicationModel");
const path = require("path");
const fs = require("fs").promises;

// Ensure upload directory exists
const ensureDirExists = async (dirPath) => {
  try {
    await fs.mkdir(dirPath, { recursive: true });
  } catch (err) {
    console.error("Directory creation error:", err);
    throw err;
  }
};

// ==========================
// Upload CV
// ==========================


exports.uploadCV = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: "No file uploaded" });
    }

    if (req.file.mimetype !== "application/pdf") {
      return res.status(400).json({ message: "Only PDF files are allowed" });
    }

    // MongoDB _id from JWT
    const mongoUserId = req.user.id;

    // Find user to get custom userId: 1,2,3...
    const user = await User.findById(mongoUserId);

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const candidateId = user.userId;

    // Count previous CVs
    const cvCount = await CV.countDocuments({ userId: mongoUserId });

    const version = cvCount + 1;

    // uploads/cvs/1
    const uploadsDir = path.join(
      __dirname,
      "../uploads/cvs",
      candidateId.toString()
    );

    await ensureDirExists(uploadsDir);

    // 1_v1.pdf, 1_v2.pdf
    const newFileName = `${candidateId}_v${version}.pdf`;
    const newFilePath = path.join(uploadsDir, newFileName);

    await fs.rename(req.file.path, newFilePath);

    const cv = await CV.create({
      userId: mongoUserId,
      candidateId,
      version,
      fileName: newFileName,
      filePath: `/uploads/cvs/${candidateId}/${newFileName}`,
    });

    res.status(201).json({
      message: "CV uploaded successfully",
      cv,
    });
  } catch (error) {
    console.error("Upload CV error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// ==========================
// Get Latest CV
// ==========================
exports.getLatestCV = async (req, res) => {
  try {
    const userId = req.user.id;

    const cv = await CV.findOne({ userId });

    if (!cv) {
      return res.status(404).json({ message: "No CV found" });
    }

    res.json(cv);

  } catch (error) {
    console.error("Get CV error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// ==========================
// Apply for Job
// ==========================
exports.applyForJob = async (req, res) => {
  try {
    //
    const userId = req.user.id;
    const { jobId, jobTitle, company, companyId } = req.body;

    const cv = await CV.findOne({ userId });

    if (!cv) {
      return res.status(400).json({ message: "Please upload a CV first" });
    }

    const application = new Application({
      userId,
      jobId,
      jobTitle,
      company,
      companyId,
      cvId: cv._id,
    });

    await application.save();

    res.status(201).json({
      message: "Application submitted successfully",
      application,
    });

  } catch (error) {
    console.error("Apply job error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// ==========================
// Get Applications
// ==========================
exports.getApplications = async (req, res) => {
  try {
    const userId = req.user.id;
    const { status } = req.query;

    let query = { userId };

    if (status && status !== "all") {
      query.status = status;
    }

    const applications = await Application.find(query)
      .sort({ appliedDate: -1 });

    res.json(applications);

  } catch (error) {
    console.error("Get applications error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// ==========================
// Update Application Status
// ==========================
exports.updateApplicationStatus = async (req, res) => {
  try {
    const { applicationId } = req.params;
    const { status } = req.body;

    const application = await Application.findByIdAndUpdate(
      applicationId,
      { status },
      { new: true }
    );

    if (!application) {
      return res.status(404).json({ message: "Application not found" });
    }

    res.json(application);

  } catch (error) {
    console.error("Update status error:", error);
    res.status(500).json({ message: "Server error" });
  }
};