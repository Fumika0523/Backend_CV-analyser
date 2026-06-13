const express = require('express')
const app = express()
const dotenv = require('dotenv')
dotenv.config();
const Port = 8002
const cors = require('cors')
const connection=require('./db/connection')
const jwt = require("jsonwebtoken");
const multer = require ('multer');
const { default: PdfParse } = require("pdf-parse-new");
const mongoose = require ('mongoose');
const fs = require ('fs');
const { createObjectCsvWriter } = require ('csv-writer');
const OpenAI = require ('openai');
const path = require('path');


app.use(cors());
app.use(express.json());

connection();

app.use("/uploads", express.static(path.join(__dirname, "uploads")));


app.use( require("./routes/userRoutes"));
app.use(require("./routes/authRoutes"));
app.use( require("./routes/cvRoutes"));
app.use( require("./routes/applicationRoutes"));
app.use("/skills", require("./routes/skillsRoute"));
app.use(require("./routes/jobRoutes"));
app.listen(Port,()=>{
    console.log(`Server started at Port no.-${Port}`)
})

