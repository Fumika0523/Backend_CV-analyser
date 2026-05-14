const CV = require("../Model/CVModel");
const User = require("../Model/UserModel");
const path = require("path");
const fs = require("fs/promises");

const ensureDirExists = async (dirPath) => {
  await fs.mkdir(dirPath, { recursive: true });
};

exports.uploadCV = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: "No file uploaded" });
    }

    if (req.file.mimetype !== "application/pdf") {
      return res.status(400).json({ message: "Only PDF files are allowed" });
    }

    const mongoUserId = req.user.id;

    const user = await User.findById(mongoUserId);

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    if (user.role !== "candidate") {
      return res.status(403).json({
        message: "Only candidates can upload CV",
      });
    }

    const candidateId = user.userId;

    const cvCount = await CV.countDocuments({ candidateId });
    const version = cvCount + 1;

    const uploadsDir = path.join(
      __dirname,
      "../uploads/cvs",
      candidateId.toString()
    );

    await ensureDirExists(uploadsDir);

    const newFileName = `${candidateId}_v${version}.pdf`;
    const newFilePath = path.join(uploadsDir, newFileName);

    await fs.rename(req.file.path, newFilePath);

    const cv = await CV.create({
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

exports.getLatestCV = async (req, res) => {
  try {
    const mongoUserId = req.user.id;

    const user = await User.findById(mongoUserId);

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const candidateId = user.userId;

    const cv = await CV.findOne({ candidateId }).sort({ version: -1 });

    if (!cv) {
      return res.status(404).json({ message: "No CV found" });
    }

    res.status(200).json(cv);
  } catch (error) {
    console.error("Get latest CV error:", error);
    res.status(500).json({ message: "Server error" });
  }
};