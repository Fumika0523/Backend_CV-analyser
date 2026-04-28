const express = require("express");
const router = express.Router();

const {
  signUp,
  signIn,
  verifyOtp,
  getUser,
  resendOtp
} = require("../controllers/authController.js");

// test route
router.get("/test", (req, res) => {
  res.send("User route working");
});

// AUTH ROUTES
router.post("/signup", signUp);
router.post("/signin", signIn);
router.post("/verify-otp", verifyOtp);
router.get("/user-profile",getUser)
router.post("/resend-otp", resendOtp);
module.exports = router;