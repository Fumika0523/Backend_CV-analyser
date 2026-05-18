const express = require('express')
const app = express()
const dotenv = require('dotenv')
dotenv.config();
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

connection();

app.use( require("./routes/userRoutes"));
app.use(require("./routes/authRoutes"));
app.use( require("./routes/cvRoutes"));
app.use( require("./routes/applicationRoutes"));
app.use(require("./routes/jobRoutes"));
app.use("/uploads", express.static("uploads"));
app.listen(Port,()=>{
    console.log(`Server started at Port no.-${Port}`)
})

