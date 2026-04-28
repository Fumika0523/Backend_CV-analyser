const express = require('express')
const app = express()
const dotenv = require('dotenv')
const Port = 8002
const cors = require('cors')
const connection=require('./db/connection')
const jwt = require("jsonwebtoken");
const multer = require ('multer');
const pdfParse = require ('pdf-parse');
const mongoose = require ('mongoose');
const fs = require ('fs');
const { createObjectCsvWriter } = require ('csv-writer');
const OpenAI = require ('openai');

app.use(cors());
app.use(express.json());

dotenv.config();

connection();

app.use("/api/users", require("./routes/userRoutes"));
app.use("/api/cv", require("./routes/cvRoutes"));

app.listen(Port,()=>{
    console.log(`Server started at Port no.-${Port}`)
})
