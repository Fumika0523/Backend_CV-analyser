const jwt = require("jsonwebtoken");
const User = require("../Model/UserModel");
const bcrypt = require("bcryptjs");
const sendOTPEmail = require("../utils/sendOTPEmail")
const getNextSequence = require("../utils/getNextSequence");


const generateOTP = () => Math.floor(100000 + Math.random() * 900000).toString();

const generateToken = (user) => {
  return jwt.sign(
    { id: user._id, role: user.role },
    process.env.JWT_SECRET_KEY,
    { expiresIn: "1h" }
  );
};

//req = request from frontend
//res= response back to frontend
exports.signUp = async (req, res) => {
 // try {
    const {
      firstName,
      lastName,
      email,
      password,
      role,
      phoneNumber,
      companyName,
      companyDescription,
      location,
    } = req.body;

    const userExists = await User.findOne({
      $or: [{ email }, { phoneNumber }],
    });

    if (userExists) {
      return res.status(400).json({
        message: "User already exists. Please login.",
      });
    }

    if (role === "company" && !companyName) {
      return res.status(400).json({
        message: "Company name is required for company account.",
      });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const otp = generateOTP();
    const userId = await getNextSequence("userId");

    const userData = {
      userId,
      firstName,
      lastName,
      email,
      password: hashedPassword,
      role,
      phoneNumber,
      location,
      otp,
      otpExpiry: Date.now() + 5 * 60 * 1000,
      isVerified: false,
    };

    if (role === "company") {
      userData.companyName = companyName;
      userData.companyDescription = companyDescription;
    }

    const user = await User.create(userData);

    await sendOTPEmail(email, otp);

    return res.status(201).json({
      success: true,
      message: "OTP sent to your email",
      mongoId: user._id,
      userId: user.userId,
    });
  // } catch (error) {
  //   console.error("SignUp error:", error);
  //   return res.status(500).json({
  //     message: "Server error",
  //   });
  // }
};

//Verify OTP
exports.verifyOtp = async (req, res) => {
  try {
    const { _id, otp } = req.body;
    console.log(_id,otp)
    if (!_id || !otp) {
      return res.status(400).json({
        message: "_id and otp are required",
      });
    }

    const user = await User.findById(_id);

    if (!user) {
      return res.status(404).json({
        message: "User not found. Please try signing up or signing in again.",
      });
    }

    if (String(user.otp) !== String(otp)) {
      return res.status(400).json({
        message: "Invalid OTP",
      });
    }

    if (user.otpExpiry < Date.now()) {
      return res.status(400).json({
        message: "OTP expired. Please request a new OTP.",
      });
    }

    user.isVerified = true;
    user.otp = null;
    user.otpExpiry = null;

    await user.save();

    return res.status(200).json({
      success: true,
      message: "OTP verified successfully",
      token: generateToken(user),
      user: {
        _id: user._id,
        userId: user.userId,
        name: user.firstName,
        email: user.email,
        role: user.role,
      },
    });
  } catch (error) {
    console.error("Verify OTP error:", error);
    return res.status(500).json({
      message: "Server error",
    });
  }
};

//_id     → MongoDB real ID (use for DB queries)
//userId  → your custom number ID (use for UI)
//mongoId → just a variable name (not needed)

exports.resendOtp = async (req, res) => {
  try {
    const { _id } = req.body;

    const user = await User.findById(_id);

    if (!user) {
      return res.status(400).json({ message: "User not found" });
    }

    const otp = generateOTP();

    user.otp = otp;
    user.otpExpiry = Date.now() + 5 * 60 * 1000;

    await user.save();
    await sendOTPEmail(user.email, otp);

    return res.status(200).json({
      message: "A new OTP has been sent.",
    });
  } catch (error) {
    console.error("Resend OTP error:", error);
    return res.status(500).json({ message: "Server error" });
  }
};

//sign in
exports.signIn = async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email });

    if (!user) {
      return res.status(400).json({ message: "Email not found" });
    }

    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch) {
      return res.status(400).json({ message: "Invalid password" });
    }

    if (!user.isVerified) {
      const otp = generateOTP()
      user.otp = otp
      user.otpExpiry = Date.now() + 5* 60*1000

      await user.save()
      await sendOTPEmail(user.email, otp)

      return res.status(403).json({
        success:false,
        message:"Please verify your email. A new OTP has been sent.",
        _id:user._id,
        email:user.email
      })
    }

    return res.status(200).json({
      success: true,
      message: "Login successful",
      token: generateToken(user),
      user: {
        _id: user._id,
        userId: user.userId,
        name: user.firstName,
        email: user.email,
        role: user.role,
      },
    });
  } catch (error) {
    console.error("SignIn error:", error);
    return res.status(500).json({ message: "Server error" });
  }
};

