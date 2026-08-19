const express = require("express");
const router = express.Router();

const {
  signUp,
  signIn,
  verifyOtp,
  resendOtp,

  forgotPassword,
  verifyResetOtp,
  resetPassword,

} = require("../controllers/authController.js");
const validateEmailForOtp = require("../utils/validateEmail");
// test route
// router.get("/test", (req, res) => {
//   res.send("User route working");
// });

// AUTH ROUTES
router.post("/signup", signUp);
router.post("/signin", signIn);

router.post("/verify-otp", verifyOtp);
router.post("/resend-otp", resendOtp);

// FORGOT PASSWORD ROUTES
router.post("/forgot-password", forgotPassword);

router.post("/verify-reset-otp", verifyResetOtp);

router.post("/reset-password", resetPassword);

module.exports = router;