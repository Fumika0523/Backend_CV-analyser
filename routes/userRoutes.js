const express = require("express");
const router = express.Router();

const {
  signUp,
  signIn
} = require("../controllers/authController.js");

// test route
router.get("/test", (req, res) => {
  res.send("User route working");
});

// AUTH ROUTES
router.post("/signup", signUp);
router.post("/signin", signIn);

module.exports = router;