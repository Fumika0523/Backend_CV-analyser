const CV = require("../Model/CVModel");
const path = require("path");
const fs = require("fs");

const ensureDirExists = (dirPath) => {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
};

exports.uploadCV = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: "No file uploaded" });
    }

    const userId = req.user.id;

    const userCVDir = path.join(
      __dirname,
      "../uploads/cvs",
      userId.toString()
    );

    ensureDirExists(userCVDir);

    const safeOriginalName = req.file.originalname.replace(/\s+/g, "_");

    const newFileName = `${userId}_cv_${Date.now()}_${safeOriginalName}`;

    const newFilePath = path.join(userCVDir, newFileName);

    fs.renameSync(req.file.path, newFilePath);

    const cv = await CV.create({
      userId,
      fileName: req.file.originalname,
      filePath: `/uploads/cvs/${userId}/${newFileName}`,
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

exports.getLatestCV = async (req, res) => {
  try {
    const userId = req.user.id;

    const cv = await CV.findOne({ userId }).sort({ uploadedAt: -1 });

    if (!cv) {
      return res.status(404).json({ message: "No CV found" });
    }

    res.status(200).json(cv);
  } catch (error) {
    console.error("Get latest CV error:", error);
    res.status(500).json({ message: "Server error" });
  }
};