const express = require('express')
const app = express()
const dotenv = require('dotenv')
const Port = 8002
const cors = require('cors')
const connection=require('./db/connection')
const jwt = require("jsonwebtoken");

dotenv.config();

connection();

app.use(cors());
app.use(express.json());


dotenv.config();

connection();

app.use(cors());
app.use(express.json());

// ✅ ADD THIS
app.use("/api/users", require("./routes/userRoutes"));


app.listen(Port,()=>{
    console.log(`Server started at Port no.-${Port}`)
})
