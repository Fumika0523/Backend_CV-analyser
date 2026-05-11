const express = require("express");
const router = express.Router();
const multer = require("multer");
const path =require("path");
const fs = require("fs")
const { uploadCV, getLatestCV } = require("../controllers/cvController");
const authMiddleware = require("../middleware/auth");

// configure multer for file uploads
const storage = multer.diskStorage({
  destination:function(req,file,cb){
    // Temporary directory - will move to user folder after upload
    const tempDir = path.join(__dirname,"../uploads/temp")
    if(!fs.existsSync(tempDir)){
      fs.mkdirSync(tempDir, {
        recursive:true
      })
     }
     cb(null,tempDir)
  },
  filename:function(req, file, cb){
    const uniqueSuffix = Date.now() + "-" +
    Math.round(Math.random() * 1E9)
    cb(null, uniqueSuffix + path.extname(file.originalname))
  }}
);

//file filter
const fileFilter = (req, file, cb)=>{
  const allowedTypes = /pdf|doc|docx/
  const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase())
  const mimetype = allowedTypes.test(file.mimetype)

  if(extname && mimetype){
    cb(null, true)
  }else{
    cb(new Error("Only PDF and Word documents are allowed."))
  }
}

const upload = multer({
  storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB
    fileFilter
  }
});

// CV Routes
// router.post("/cv/upload", auth, upload.single ("cv"),uploadCV)
// router.get("/cv/latest", auth, getLatestCV)


module.exports = router;