const CV = require("../Model/CVModel");
const User = require("../Model/UserModel");
const path = require("path");
const fs = require("fs/promises");
const { default: PdfParse } = require("pdf-parse-new");
const CVAnalyse = require("../services/CVAnalyse")
const Skill = require('../Model/skillsModel')

const ensureDirExists = async (dirPath) => {
  await fs.mkdir(dirPath, { recursive: true });
};

//signed in user
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

    const analysis = await CVAnalyse(newFilePath);
  
    const cv = await CV.create({
  candidateId,
  version,
  fileName: newFileName,
  filePath: `/uploads/cvs/${candidateId}/${newFileName}`,
  rawText: analysis.rawText,
  skillsDetected: analysis.skillsDetected,
  analysisStatus: "completed",
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

//guest upload and temporary stored the CV and when you signed up. it should link, it can be ID / temporary Id
exports.guestUploadCV = async (req, res) => {
  //try {
    const { guestSessionId } = req.body;

    if (!guestSessionId) {
      return res.status(400).json({
        message: "Guest session ID is required",
      });
    }

    if (!req.file) {
      return res.status(400).json({
        message: "No file uploaded",
      });
    }

    if (req.file.mimetype !== "application/pdf") {
      return res.status(400).json({
        message: "Only PDF files are allowed",
      });
    }

    // const dataBuffer = await fs.readFile(req.file.path);

    // const data = await PdfParse(dataBuffer);

    // console.log("PDF parsed successfully!");
    // console.log(data);

    // const extractedText = data.text;


    // console.log("--- Extracted Text ---");
    // console.log(extractedText);

    const analysis = await CVAnalyse(req.file.path);

   const cv = await CV.create({
  candidateId: null,
  guestSessionId,
  version: 1,
  fileName: req.file.filename,
  filePath: `/uploads/cvs/${req.file.filename}`,
  rawText: analysis.rawText,
  skillsDetected: analysis.skillsDetected,
  analysisStatus: "completed",
});

  const skill = await Skills.create({
    candidateId:null,
    skills:analysis.skillsDetected,
  })

   return res.status(200).json({
  message: "Guest CV uploaded and analysed successfully",
  cv,
  skill,
  extractedText: analysis.rawText,
  skillsDetected: analysis.skillsDetected,
});

  // } catch (error) {
  //   console.error("Guest upload CV error:", error);

  //   return res.status(500).json({
  //     message: "Server error",
  //   });
  // }
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