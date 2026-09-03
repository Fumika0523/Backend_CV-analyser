const express = require("express");
const router = express.Router();
const multer = require("multer");
const path = require("path");
const fs = require("fs");

const { uploadCV, getLatestCV , guestUploadCV, getMyCVs, downloadCV,} = require("../controllers/cvController");
const auth = require("../middleware/auth");

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const tempDir = path.join(__dirname, "../uploads/temp");

    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }

    cb(null, tempDir);
  },

  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  },
});

const fileFilter = (req, file, cb) => {
  const allowedTypes = /pdf|doc|docx/;
  const extname = allowedTypes.test(
    path.extname(file.originalname).toLowerCase()
  );

  const mimetype =
    file.mimetype === "application/pdf" ||
    file.mimetype === "application/msword" ||
    file.mimetype ===
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

  if (extname && mimetype) {
    cb(null, true);
  } else {
    cb(new Error("Only PDF and Word documents are allowed."));
  }
};

const upload = multer({
  storage,
  limits: {
    fileSize: 5 * 1024 * 1024,
  },
  fileFilter,
});

router.post("/cv/upload", auth, upload.single("cv"), uploadCV);
router.post("/cv/guest-upload", upload.single("cv"), guestUploadCV);
router.get("/cv/latest", auth, getLatestCV);
router.get("/cv/my-cvs", auth, getMyCVs);
router.get("/cv/:id/download", auth, downloadCV );

module.exports = router;