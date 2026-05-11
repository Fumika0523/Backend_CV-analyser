const CV = require("../Model/CVModel");
const Application = require("../Model/ApplicationModel");
const path = require("path");
const fs = require("fs");

// Ensure upload directory exists
const ensureDirExists = (dirPath) => {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
};

// Upload CV
exports.uploadCV = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: "No file uploaded" });
    }

    const userId = req.user.id;
    const uploadsDir = path.join(__dirname, "../uploads/cvs", userId.toString());
    
    ensureDirExists(uploadsDir);

    // Move file to user's folder
    const newFileName = `cv_${Date.now()}_${req.file.originalname}`;
    const newFilePath = path.join(uploadsDir, newFileName);
    
    fs.renameSync(req.file.path, newFilePath);

    // Save to database
    const cv = new CV({
      userId,
      fileName: req.file.originalname,
      filePath: `/uploads/cvs/${userId}/${newFileName}`,
    });

    await cv.save();

    res.status(201).json({
      message: "CV uploaded successfully",
      cv,
    });
  } catch (error) {
    console.error("Upload CV error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// Get latest CV for user
exports.getLatestCV = async (req, res) => {
  try {
    const userId = req.user.id;
    
    const cv = await CV.findOne({ userId }).sort({ uploadedAt: -1 });
    
    if (!cv) {
      return res.status(404).json({ message: "No CV found" });
    }

    res.json(cv);
  } catch (error) {
    console.error("Get CV error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// Apply for a job
exports.applyForJob = async (req, res) => {
  try {
    const userId = req.user.id;
    const { jobId, jobTitle, company, companyId } = req.body;

    // Get latest CV
    const cv = await CV.findOne({ userId }).sort({ uploadedAt: -1 });

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

// Get user's applications with optional status filter
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

// Update application status (for company to use)
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