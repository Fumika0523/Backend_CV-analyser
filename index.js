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

  app.use(require("./routes/jobRoutes"));

  app.use("/uploads", express.static("uploads"));

  app.use("/api",require('./routes/checkout'))
 
  app.listen(Port, () => {

    console.log(`Server started at Port no.-${Port}`)

  });

};
 
startServer();
 
 //pm2 start index.js // command to start the cronjobs