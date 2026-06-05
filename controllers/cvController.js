const CV = require("../Model/CVModel");
const User = require("../Model/UserModel");
const path = require("path");
const fs = require("fs/promises");
const { default: PdfParse } = require("pdf-parse-new");
const CVAnalyse = require("../services/CVAnalyse")
const Skill = require('../Model/skillsModel')


// fs.mkdir() >> Make directory
/// A helper function called ensureDirExists which uses fs.mkfir() with recursive: true. This guarantees the candidate's upload directory exists before moving the PDF file into it and prevents file-system error when a folder is missing.
const ensureDirExists = async (dirPath) => {
  await fs.mkdir(dirPath,
    //Node creates everything automatically:
     { recursive: true }
    );
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

    // MongoDB _id from JWT , eg) "665fabc123..."
    const mongoUserId = req.user.id;

    // find User from user collection 
    const user = await User.findById(mongoUserId);

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    if (user.role !== "candidate") {
      return res.status(403).json({
        message: "Only candidates can upload CV",
      });
    }

    // Numeric candidate Id
    const candidateNumericId = user.userId;

    // Count how many CVs this candidate already has
    const cvCount = await CV.countDocuments({
      candidateId: candidateNumericId,
    });

    //create next CV version
    const version = cvCount + 1;

    // e.g) Backend/uploads/cvs/14
    const uploadsDir = path.join(
      __dirname,
      "../uploads/cvs",
      candidateNumericId.toString()
    );

    // Make sure the folder exists
    await ensureDirExists(uploadsDir);

    // create new PDF file name
    const newFileName = `${candidateNumericId}_v${version}.pdf`;

    // create full file path
    // e.g) uploadsDir = Backend/uploads/cvs/14
    // newFileName = 14_v3.pdf
    // result: Backend/uploads/cvs/14/14_v3.pdf
    const newFilePath = path.join(uploadsDir, newFileName);
    // Move uploaded PDF from temporary place to the candidate’s own CV folder.
    await fs.rename(req.file.path, newFilePath);
    //Analyse the saved PDF
    const analysis = await CVAnalyse(newFilePath);

    const cv = await CV.create({
      candidateId: candidateNumericId,
      version,
      fileName: newFileName,
      filePath: `/uploads/cvs/${candidateNumericId}/${newFileName}`,
      rawText: analysis.rawText,
      skillsDetected: analysis.skillsDetected,
      analysisStatus: "completed",
    });

   await Skill.findOneAndUpdate(
  {
    candidateId: candidateNumericId,
  },
  {
    $set: {
      candidateId: candidateNumericId,
      userMongoId: mongoUserId,
      guestSessionId: null,
      skills: analysis.skillsDetected || [],
    },
  },
  {
    new: true,
    upsert: true,
  }
);

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
  try {
  //Get guestSessionId from frontend FormData
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

    // CV collection should store only Latest guest CV.
 const cv = await CV.findOneAndUpdate(
  { guestSessionId },
  {
    $set: {
      candidateId: null,
      guestSessionId,
      fileName: req.file.filename,
      filePath: `/uploads/cvs/${req.file.filename}`,
      rawText: analysis.rawText,
      skillsDetected: analysis.skillsDetected || [],
      uploadedAt: new Date(),
    },
  },
  {
    new: true,
    upsert: true,
  }
);

  // Skill collection stores EVERY upload history.
const skill = await Skill.findOneAndUpdate(
  { guestSessionId },
  {
    $set: {
      candidateId: null,
      guestSessionId,
      skills: analysis.skillsDetected || [],
    },
  },
  {
    new: true,
    upsert: true,
  }
);

   return res.status(200).json({
  message: "Guest CV uploaded and analysed successfully",
  cv,
  skill,
  extractedText: analysis.rawText,
  skillsDetected: analysis.skillsDetected,
});

  } catch (error) {
    console.error("Guest upload CV error:", error);

    return res.status(500).json({
      message: "Server error",
    });
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


//If you want to show candidate name later, numeric candidateId: 13 cannot use normal Mongoose populate() unless your User schema uses userId as the reference field.


exports.getMyCVs = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    if (user.role !== "candidate") {
      return res.status(403).json({ message: "Only candidates can view CVs" });
    }

    const cvs = await CV.find({ candidateId: user.userId }).sort({
      version: -1,
    });

    res.status(200).json(cvs);
  } catch (error) {
    console.error("Get my CVs error:", error);
    res.status(500).json({ message: "Server error" });
  }
};