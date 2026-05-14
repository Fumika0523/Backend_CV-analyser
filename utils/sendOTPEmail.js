// utils/sendOTPEmail.js
const nodemailer = require("nodemailer");

const sendOTPEmail = async (email, otp) => {
  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  });
await transporter.verify();
console.log("SMTP ready");
  await transporter.sendMail({
    from: `"CV-Analyser" <${process.env.EMAIL_USER}>`,
    to: email,
    subject: "Your OTP Code",
    html: `<h2>Your OTP is: ${otp}</h2><p>Valid for 5 minutes</p>`,
  });
};
console.log("EMAIL_USER:", process.env.EMAIL_USER);
console.log("EMAIL_PASS:", process.env.EMAIL_PASS);
module.exports = sendOTPEmail;