const express = require("express");
const router = express.Router();
const multer = require("multer");
const path = require("path");
const fs = require("fs");

const { uploadCV, getLatestCV , guestUploadCV, getMyCVs} = require("../controllers/cvController");
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
  // CV Analyser currently accepts PDF files only.
  const isPdfExtension =
    path.extname(file.originalname).toLowerCase() === ".pdf";

  const isPdfMimeType =
    file.mimetype === "application/pdf";

  if (isPdfExtension && isPdfMimeType) {
    cb(null, true);
  } else {
    cb(new Error("Only PDF files are allowed."));
  }
};

const upload = multer({
  storage,
  limits: {
    fileSize: 5 * 1024 * 1024,
  },
  fileFilter,
});

router.post("/cv/upload", auth, upload.single("cv"),
 uploadCV);
 router.post("/cv/guest-upload", upload.single("cv"),
 guestUploadCV);
router.get("/cv/latest", auth, getLatestCV);
router.get("/cv/my-cvs", auth, getMyCVs);

module.exports = router;