const nodemailer = require("nodemailer");
const express = require("express");
const app = express();

app.use(express.json());

// Function to send OTP email
async function sendOTPEmail(email, otp) {
  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: process.env.EMAIL_USER, // your Gmail address
      pass: process.env.EMAIL_PASS, // your Gmail App Password
    },
  });

  await transporter.sendMail({
    from: `"JobBoard AI" <${process.env.EMAIL_USER}>`,
    to: email,
    subject: "Your OTP Code",
    html: `<h2>Your OTP is: ${otp}</h2><p>Valid for 5 minutes</p>`,
  });
}

// API route
app.post("/api/send-otp", async (req, res) => {
  const { email } = req.body;
  const otp = Math.floor(100000 + Math.random() * 900000); // 6-digit OTP

  try {
    await sendOTPEmail(email, otp);
    res.json({ success: true, message: "OTP sent" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Error sending OTP" });
  }
});

app.listen(5000, () => console.log("Server running on port 5000"));