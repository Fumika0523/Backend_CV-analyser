const express = require('express')

const app = express()

const dotenv = require('dotenv')

dotenv.config();

const Port = process.env.PORT || 8002

const cors = require('cors')

const connection = require('./db/connection')

const startCronJobs = require('./services/Cron_Jobs')

const jwt = require("jsonwebtoken");

const multer = require ('multer');

const { default: PdfParse } = require("pdf-parse-new");

const mongoose = require ('mongoose');

const fs = require ('fs');

const { createObjectCsvWriter } = require ('csv-writer');

const OpenAI = require ('openai');
 
 
app.use(cors());

app.use(express.json());
 
const startServer = async () => {

  await connection();

  startCronJobs();
 
  app.use(require("./routes/userRoutes"));

  app.use(require("./routes/authRoutes"));

  app.use(require("./routes/cvRoutes"));

  app.use(
    "/applications",
    require("./routes/applicationRoutes")
  );

  app.use("/skills", require("./routes/skillsRoute"));

  app.use(require('./routes/jobAiRoutes'))

  app.use(require("./routes/jobRoutes"));
const path = require("path");

// PROTECT PRIVATE CV FILES
// CVs must NEVER be downloaded directly through:
// /uploads/cvs/...
//
// Users must instead use:
// GET /cv/:id/download
//
// That protected route checks:
// - candidate owns the CV
// - OR company has an application referencing the CV
app.use("/uploads/cvs", (req, res) => {
  return res.status(403).json({
    message: "You are not allowed to access this CV.",
  });
});


// PROTECT TEMPORARY UPLOADS
// Temporary guest/upload files should not be publicly
// accessible either.
app.use("/uploads/temp", (req, res) => {
  return res.status(403).json({
    message: "Direct access to temporary files is not allowed.",
  });
});


// Other non-sensitive files can still be served publicly.
app.use(
  "/uploads",
  express.static(path.join(__dirname, "uploads"))
);

  app.use("/api",require('./routes/checkout'))
 
  app.listen(Port, () => {
    console.log(`Server started at Port no.-${Port}`)
  })
};
 
startServer();
 
 //pm2 start index.js // command to start the cronjobs