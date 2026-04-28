const Cv = require("../Model/CvModel")

const pdfParse = require("pdf-parse");
const CV = require("../Model/CvModel");

exports.uploadCV = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: "Please upload a CV file" });
    }

    const pdfData = await pdfParse(req.file.buffer);

    const cv = await CV.create({
      userId: req.user.id, // from auth middleware
      fileName: req.file.originalname,
      rawText: pdfData.text,
      skills: [], // AI skill extraction can be added next
    });

    return res.status(201).json({
      message: "CV uploaded successfully",
      cv,
    });
  } catch (error) {
    console.error("Upload CV error:", error);
    return res.status(500).json({ message: "Failed to upload CV" });
  }
};