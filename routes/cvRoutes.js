const express = require("express");
const multer = require("multer");
const { uploadCV } = require("../controllers/cvController");
const authMiddleware = require("../middleware/auth");

const router = express.Router();

const storage = multer.memoryStorage();

const upload = multer({
  storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype !== "application/pdf") {
      return cb(new Error("Only PDF files are allowed"));
    }
    cb(null, true);
  },
});

router.post("/upload", authMiddleware, upload.single("cv"), uploadCV);

module.exports = router;