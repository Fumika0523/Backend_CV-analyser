const User = require("../Model/UserModel");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

// 🔐 Generate JWT
const generateToken = (user) => {
  return jwt.sign(
    {
      id: user._id,
      role: user.role
    },
    process.env.JWT_SECRET_KEY || "nodejs",
    { expiresIn: "7d" }
  );
};


// SIGN UP
exports.signUp = async (req, res) => {
  try {
    const { firstName, lastName, email, password, role, phoneNumber, companyName, location } = req.body;

    const userExists = await User.findOne({ email });

    if (userExists) {
      return res.status(400).json({ message: "User already exists" });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const otp = generateOTP();

    const user = await User.create({
      firstName,
      lastName,
      email,
      password: hashedPassword,
      role,
      phoneNumber,
      companyName,
      location,
      otp,
      otpExpiry: Date.now() + 5 * 60 * 1000,
      isVerified: false,
    });

    await sendOTPEmail(email, otp);

    res.status(201).json({
      message: "OTP sent to your email",
      userId: user._id,
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
};

exports.verifyOTP = async (req, res) => {
  try {
    const { userId, otp } = req.body;

    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    if (user.otp !== otp) {
      return res.status(400).json({ message: "Invalid OTP" });
    }

    if (user.otpExpiry < Date.now()) {
      return res.status(400).json({ message: "OTP expired" });
    }

    user.isVerified = true;
    user.otp = null;
    user.otpExpiry = null;

    await user.save();

    res.status(200).json({
      message: "OTP verified successfully",
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
};

// SIGN IN
exports.signIn = async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email });

    if (!user) {
      return res.status(400).json({
        message: "Email not found"
      });
    }

    // ❗ NEW: block unverified users
    if (!user.isVerified) {
      return res.status(403).json({
        message: "Please verify your email with OTP before logging in",
        userId: user._id // send this so frontend can trigger OTP modal
      });
    }

    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch) {
      return res.status(400).json({
        message: "Invalid password"
      });
    }

    res.status(200).json({
      message: "Login successful",
      user: {
        id: user._id,
        name: user.firstName,
        email: user.email,
        role: user.role
      },
      token: generateToken(user)
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
};