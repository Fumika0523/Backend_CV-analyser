const express = require("express");
const multer = require("multer");
const path = require("path");
const fs = require("fs");

const auth = require("../middleware/auth");

const {
  analyseJobDescriptionPDF,
} = require("../controllers/jobAiController");

const router = express.Router();

/*
 * Store the PDF temporarily.
 *
 * The controller deletes it after Gemini has finished.
 */
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const temporaryDirectory = path.join(
      __dirname,
      "../uploads/temp/job-descriptions"
    );

    if (!fs.existsSync(temporaryDirectory)) {
      fs.mkdirSync(temporaryDirectory, {
        recursive: true,
      });
    }

    cb(null, temporaryDirectory);
  },

  filename: function (req, file, cb) {
    const uniqueFileName = `${Date.now()}-${Math.round(
      Math.random() * 1e9
    )}${path.extname(file.originalname)}`;

    cb(null, uniqueFileName);
  },
});

const fileFilter = (req, file, cb) => {
  const fileExtension = path
    .extname(file.originalname)
    .toLowerCase();

  const isPDFExtension =
    fileExtension === ".pdf";

  const isPDFMimeType =
    file.mimetype === "application/pdf";

  if (isPDFExtension && isPDFMimeType) {
    return cb(null, true);
  }

  return cb(
    new Error(
      "Only PDF job descriptions are allowed."
    )
  );
};

const upload = multer({
  storage,

  limits: {
    fileSize: 5 * 1024 * 1024,
  },

  fileFilter,
});

/*
 * Auth runs before Multer.
 *
 * Therefore, an unauthenticated user cannot upload a temporary file.
 *
 * The frontend FormData field must be named:
 * jobDescription
 */
router.post(
  "/jobs/analyse-pdf",
  auth,
  upload.single("jobDescription"),
  analyseJobDescriptionPDF
);

module.exports = router;